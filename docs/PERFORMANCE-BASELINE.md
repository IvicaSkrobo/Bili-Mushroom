# Performance baseline

Measured on 2026-08-21 with `python scripts/benchmark-library.py` on this Windows
development machine. The benchmark creates disposable SQLite databases with three
photos per find and measures warm SQL execution plus JSON payload size. It does not
include Tauri IPC, image decoding, React work, or marker painting.

| Finds | Query | Median ms | Rows | JSON MiB |
|---:|---|---:|---:|---:|
| 5,000 | collection page | 6.51 | 200 | 0.01 |
| 5,000 | search page | 6.79 | 1 | 0.00 |
| 5,000 | map points | 16.06 | 4,000 | 0.57 |
| 5,000 | lean statistics | 14.81 | 5,000 | 0.63 |
| 5,000 | legacy full statistics | 22.75 | 5,000 | 1.08 |
| 50,000 | collection page | 81.04 | 200 | 0.01 |
| 50,000 | search page | 80.14 | 1 | 0.00 |
| 50,000 | map points | 491.12 | 40,000 | 5.90 |
| 50,000 | lean statistics | 389.68 | 50,000 | 6.41 |
| 50,000 | legacy full statistics | 485.57 | 50,000 | 10.85 |
| 100,000 | collection page | 167.85 | 200 | 0.01 |
| 100,000 | search page | 164.29 | 1 | 0.00 |
| 100,000 | map points | 1,008.78 | 80,000 | 11.85 |
| 100,000 | lean statistics | 809.86 | 100,000 | 12.84 |
| 100,000 | legacy full statistics | 995.85 | 100,000 | 21.73 |

## Conclusions

- Current collection and search SQL have ample headroom beyond 5,000 finds.
- The lean statistics endpoint reduces its 100k payload by about 41% and query time by
  about 19% compared with the previous full-row path. At tens of thousands of finds,
  backend aggregation should replace loading every lean row if statistics becomes slow.
- Map clustering or viewport-bound loading is not justified for the current library.
  Re-measure around 25,000 mapped finds and implement it before 50,000 mapped finds;
  that is where SQL alone approaches half a second and the payload approaches 6 MiB.
- Photo count and find count are different scaling axes. A library with 5,000 photos
  across 700 finds is substantially below the 5,000-find row in this test.

Run the benchmark again after changing collection, search, map, or statistics SQL:

```powershell
python scripts/benchmark-library.py
```
