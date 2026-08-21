# Performance baseline

Measured on 2026-08-21 with `python scripts/benchmark-library.py` on this Windows
development machine. The benchmark creates disposable SQLite databases with three
photos per find and measures warm SQL execution plus JSON payload size. It does not
include Tauri IPC, image decoding, React work, or marker painting.

| Finds | Query | Median ms | Rows | JSON MiB |
|---:|---|---:|---:|---:|
| 5,000 | collection page | 6.46 | 200 | 0.01 |
| 5,000 | search page | 6.75 | 1 | 0.00 |
| 5,000 | all map points (legacy comparison) | 15.89 | 4,000 | 0.57 |
| 5,000 | map metadata | 3.93 | 200 | 0.01 |
| 5,000 | map viewport | 0.08 | 0 | 0.00 |
| 5,000 | map clusters, zoom 7 | 4.51 | 6 | 0.00 |
| 5,000 | lean statistics | 15.59 | 5,000 | 0.63 |
| 5,000 | legacy full statistics | 22.12 | 5,000 | 1.08 |
| 50,000 | collection page | 81.45 | 200 | 0.01 |
| 50,000 | search page | 80.82 | 1 | 0.00 |
| 50,000 | all map points (legacy comparison) | 488.96 | 40,000 | 5.90 |
| 50,000 | map metadata | 51.30 | 1,600 | 0.08 |
| 50,000 | map viewport | 7.83 | 1,600 | 0.24 |
| 50,000 | map clusters, zoom 7 | 73.14 | 8 | 0.00 |
| 50,000 | lean statistics | 398.73 | 50,000 | 6.41 |
| 50,000 | legacy full statistics | 476.80 | 50,000 | 10.85 |
| 100,000 | collection page | 169.47 | 200 | 0.01 |
| 100,000 | search page | 165.25 | 1 | 0.00 |
| 100,000 | all map points (legacy comparison) | 1,016.01 | 80,000 | 11.85 |
| 100,000 | map metadata | 104.47 | 1,600 | 0.08 |
| 100,000 | map viewport | 21.89 | 4,000 | 0.59 |
| 100,000 | map clusters, zoom 7 | 147.16 | 8 | 0.00 |
| 100,000 | lean statistics | 840.20 | 100,000 | 12.84 |
| 100,000 | legacy full statistics | 1,019.42 | 100,000 | 21.73 |

## Conclusions

- Current collection and search SQL have ample headroom beyond 5,000 finds.
- The lean statistics endpoint reduces its 100k payload by about 41% and query time by
  about 19% compared with the previous full-row path. At tens of thousands of finds,
  backend aggregation should replace loading every lean row if statistics becomes slow.
- The map now uses bounded server clusters below zoom 12 and viewport-bound points at
  zoom 12 and above. At 100,000 finds the wide view returns 8 aggregate rows instead of
  80,000 point rows (effectively zero JSON MiB instead of 11.85 MiB), while the measured
  SQL drops from about 1.0 s to 147 ms. A detailed viewport is 22 ms in this synthetic
  distribution. The aggregate still scans mapped rows, so re-measure beyond 100,000;
  persisted spatial cells are only justified if that scan becomes a real bottleneck.
- Photo count and find count are different scaling axes. A library with 5,000 photos
  across 700 finds is substantially below the 5,000-find row in this test.

Run the benchmark again after changing collection, search, map, or statistics SQL:

```powershell
python scripts/benchmark-library.py
```
