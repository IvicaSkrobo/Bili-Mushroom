#!/usr/bin/env python3
"""Repeatable SQLite scalability baseline for Bili Mushroom read paths.

This intentionally benchmarks SQL and serialized payload size, not React rendering or
Tauri IPC overhead. It uses no project/database files and deletes its temporary DB.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import statistics
import tempfile
import time
from pathlib import Path


INTERNAL = "LOWER(TRIM(f.species_name)) NOT IN ('tile-cache', '.bili-cache', '.bili-cache-tiles')"

QUERIES = {
    "collection_page": f"""
        SELECT f.species_name, COUNT(*),
               COALESCE(SUM((SELECT COUNT(*) FROM find_photos fp WHERE fp.find_id=f.id)), 0),
               COALESCE(SUM(CASE WHEN f.is_favorite=1 THEN 1 ELSE 0 END), 0),
               MAX(f.date_found)
        FROM finds f WHERE {INTERNAL}
        GROUP BY f.species_name
        ORDER BY MAX(f.date_found) DESC, f.species_name COLLATE NOCASE ASC LIMIT 200 OFFSET 0
    """,
    "search_page": f"""
        SELECT f.species_name, COUNT(*), MAX(f.date_found)
        FROM finds f WHERE {INTERNAL}
          AND (LOWER(f.species_name) LIKE ? OR LOWER(f.notes) LIKE ? OR LOWER(f.location_note) LIKE ?)
        GROUP BY f.species_name ORDER BY MAX(f.date_found) DESC LIMIT 200
    """,
    "map_points": f"""
        SELECT f.id, f.species_name, f.date_found, f.lat, f.lng, f.notes, f.location_note,
               fp.id, fp.photo_path, fp.is_primary
        FROM finds f
        LEFT JOIN find_photos fp ON fp.id=(
          SELECT p.id FROM find_photos p WHERE p.find_id=f.id
          ORDER BY p.is_primary DESC, p.id ASC LIMIT 1
        )
        WHERE f.lat IS NOT NULL AND f.lng IS NOT NULL AND {INTERNAL}
        ORDER BY f.date_found DESC, f.id DESC
    """,
    "map_metadata": f"""
        SELECT f.species_name, COUNT(*), MIN(f.lat), MIN(f.lng), MAX(f.lat), MAX(f.lng)
        FROM finds f
        WHERE f.lat IS NOT NULL AND f.lng IS NOT NULL AND {INTERNAL}
        GROUP BY f.species_name ORDER BY f.species_name COLLATE NOCASE ASC
    """,
    "map_viewport": f"""
        SELECT f.id, f.species_name, f.date_found, f.lat, f.lng, f.notes, f.location_note,
               fp.id, fp.photo_path, fp.is_primary
        FROM finds f
        LEFT JOIN find_photos fp ON fp.id=(
          SELECT p.id FROM find_photos p WHERE p.find_id=f.id
          ORDER BY p.is_primary DESC, p.id ASC LIMIT 1
        )
        WHERE f.lat BETWEEN ? AND ? AND f.lng BETWEEN ? AND ? AND {INTERNAL}
        ORDER BY f.date_found DESC, f.id DESC
    """,
    "map_clusters_zoom_7": f"""
        SELECT AVG(f.lat), AVG(f.lng), COUNT(*), COUNT(DISTINCT f.species_name)
        FROM finds f
        WHERE f.lat BETWEEN ? AND ? AND f.lng BETWEEN ? AND ? AND {INTERNAL}
        GROUP BY CAST((f.lat + 90.0) / ? AS INTEGER),
                 CAST((f.lng + 180.0) / ? AS INTEGER)
        ORDER BY COUNT(*) DESC
    """,
    "stats_lean": f"""
        SELECT f.id, f.species_name, f.date_found, f.country, f.region,
               f.location_note, f.notes, f.observed_count, f.observed_count_min,
               f.observed_count_max,
               (SELECT COUNT(*) FROM find_photos fp WHERE fp.find_id=f.id)
        FROM finds f WHERE {INTERNAL} ORDER BY f.date_found DESC, f.id DESC
    """,
    "stats_legacy_full": f"""
        SELECT f.id, f.original_filename, f.species_name, f.date_found, f.country, f.region,
               f.lat, f.lng, f.notes, f.location_note, f.observed_count, f.observed_count_min,
               f.observed_count_max, f.is_favorite, f.created_at, f.edibility_note,
               f.weather, f.determiner, f.finder,
               (SELECT COUNT(*) FROM find_photos fp WHERE fp.find_id=f.id)
        FROM finds f WHERE {INTERNAL} ORDER BY f.date_found DESC, f.id DESC
    """,
}


def create_library(path: Path, find_count: int) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.executescript("""
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        CREATE TABLE finds (
          id INTEGER PRIMARY KEY, original_filename TEXT NOT NULL, species_name TEXT NOT NULL,
          date_found TEXT NOT NULL, country TEXT NOT NULL, region TEXT NOT NULL,
          lat REAL, lng REAL, notes TEXT NOT NULL, location_note TEXT NOT NULL,
          observed_count INTEGER, observed_count_min INTEGER, observed_count_max INTEGER,
          is_favorite INTEGER NOT NULL, created_at TEXT NOT NULL, edibility_note TEXT NOT NULL,
          weather TEXT NOT NULL, determiner TEXT NOT NULL, finder TEXT NOT NULL
        );
        CREATE TABLE find_photos (
          id INTEGER PRIMARY KEY, find_id INTEGER NOT NULL, photo_path TEXT NOT NULL,
          is_primary INTEGER NOT NULL
        );
        CREATE INDEX idx_finds_species_name ON finds(species_name);
        CREATE INDEX idx_finds_date_found ON finds(date_found);
        CREATE INDEX idx_finds_lat_lng ON finds(lat, lng);
        CREATE INDEX idx_find_photos_find_id ON find_photos(find_id);
    """)
    species_count = max(50, min(2000, find_count // 20))
    find_rows = []
    photo_rows = []
    for i in range(1, find_count + 1):
        species = f"Species {i % species_count:04d}"
        date = f"{2020 + i % 7:04d}-{1 + i % 12:02d}-{1 + i % 28:02d}"
        mapped = i % 5 != 0
        find_rows.append((
            i, f"IMG_{i:07d}.jpg", species, date, "Croatia", f"Region {i % 30}",
            42.0 + (i % 5000) / 1000 if mapped else None,
            13.0 + (i % 4000) / 1000 if mapped else None,
            f"Field note for specimen {i} in mixed forest", f"Location {i % 500}",
            i % 12 or None, None, None, int(i % 17 == 0), "2026-01-01T12:00:00Z",
            "", "sunny", "Local expert", "Forager",
        ))
        for photo_index in range(3):
            photo_rows.append((i, f"{species}/photo-{i}-{photo_index}.jpg", int(photo_index == 0)))
    conn.executemany("INSERT INTO finds VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", find_rows)
    conn.executemany(
        "INSERT INTO find_photos(find_id,photo_path,is_primary) VALUES (?,?,?)", photo_rows
    )
    conn.commit()
    conn.execute("ANALYZE")
    return conn


def measure(conn: sqlite3.Connection, sql: str, params: tuple = (), repeats: int = 5):
    conn.execute(sql, params).fetchall()
    samples = []
    rows = []
    for _ in range(repeats):
        started = time.perf_counter()
        rows = conn.execute(sql, params).fetchall()
        samples.append((time.perf_counter() - started) * 1000)
    payload = len(json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    return statistics.median(samples), len(rows), payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sizes", nargs="*", type=int, default=[5_000, 50_000, 100_000])
    args = parser.parse_args()
    print("| Finds | Query | Median ms | Rows | JSON MiB |")
    print("|---:|---|---:|---:|---:|")
    # Keep the transient database beside the checkout. Microsoft Store Python can
    # be denied access to the system temp directory in restricted environments.
    with tempfile.TemporaryDirectory(prefix=".bili-benchmark-", dir=Path.cwd()) as temp:
        for size in args.sizes:
            path = Path(temp) / f"library-{size}.sqlite"
            conn = create_library(path, size)
            for name, query in QUERIES.items():
                if name == "search_page":
                    params = ("%species 0001%",) * 3
                elif name == "map_viewport":
                    params = (44.0, 45.0, 14.0, 15.0)
                elif name == "map_clusters_zoom_7":
                    params = (42.0, 47.0, 13.0, 17.0, 360 / 2**7, 360 / 2**7)
                else:
                    params = ()
                elapsed, rows, payload = measure(conn, query, params)
                print(f"| {size:,} | {name} | {elapsed:.2f} | {rows:,} | {payload / 1048576:.2f} |")
            conn.close()


if __name__ == "__main__":
    main()
