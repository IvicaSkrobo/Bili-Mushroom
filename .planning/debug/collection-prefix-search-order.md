---
status: resolved
slug: collection-prefix-search-order
trigger: "U Zbirci pretraga po abecedi opet ne radi: mora reagirati već na prvo slovo i tražiti vrste koje počinju upisanim slovima, ne slovo usred riječi; abecedni poredak također nije ispravan."
created: 2026-08-21
updated: 2026-08-21
---

## Symptoms

- expected: U Zbirci, unos prvog slova odmah prikazuje samo vrste čije ime počinje tim slovom/prefiksom. Abecedni način daje stvarni A-Z poredak.
- actual: Tražilica podudara upisano slovo i usred riječi, pa korisnik ne može pregledavati zbirku po početnom slovu; abecedni rezultat/poredak djeluje pogrešno.
- errors: Nema prijavljene poruke greške.
- timeline: Ponovno primijećeno nakon aktualnih v0.3.40 promjena; ranije je popravljen toggle za abecedni sort, ali ne i semantika tekstualne pretrage.
- reproduction: Otvoriti Zbirku, uključiti/koristiti abecedno traženje i upisati jedno slovo. Rezultati s tim slovom usred naziva ostaju, umjesto samo naziva koji počinju tim slovom; provjeriti i A-Z redoslijed.

## Current Focus

- hypothesis: Frontend ili SQL koristi substring obrazac `%query%` umjesto prefiksa `query%`, a abecedni comparator možda sortira formatirano umjesto kanonskog/plain imena ili se server-side paginacija sortira prije klijentskog preslagivanja.
- test: Pronaći generiranje Collection search filtera i ORDER BY; dodati regresijski test s vrstama gdje se isto slovo nalazi na početku i u sredini.
- expecting: Upit `b` vraća vrste koje počinju s B, ne Amanita rubescens; rezultati su po punom abecednom redoslijedu već od prvog znaka.
- next_action: add mutation-proven backend regressions, then implement prefix matching and server-side alphabetical pagination

## Evidence

- timestamp: 2026-08-21T00:00:00+02:00
  checked: `push_find_search_filters` and `normalized_like_query` in `src-tauri/src/commands/import.rs`
  found: species filtering shares the generic pattern `%query%` with location filtering, so a one-letter species query matches the middle of the name.
  implication: species needs its own escaped prefix pattern `query%`; changing the shared helper would incorrectly change location search.
- timestamp: 2026-08-21T00:00:01+02:00
  checked: `get_collection_folders_for_connection` and `CollectionTab` sort handling
  found: SQL always paginates by `latest_date DESC`; the alpha toggle only sorts the folders already loaded in the frontend.
  implication: alphabetical order is not global once the library has more folders than one page. Sort mode must reach SQL and be applied before LIMIT/OFFSET.
- timestamp: 2026-08-21T00:00:02+02:00
  checked: mutation of the prefix matcher back from `query%` to `%query%`
  found: regression test failed with 4 results instead of 2.
  implication: the test proves middle-of-name matches cannot return unnoticed.
- timestamp: 2026-08-21T00:00:03+02:00
  checked: mutation of alphabetical SQL back to recent-first ordering
  found: pagination test failed with `Cantharellus, Boletus` instead of `Amanita, Boletus`.
  implication: the test proves ordering happens before LIMIT/OFFSET rather than only on the loaded frontend page.

## Eliminated

## Resolution

- root_cause: Species search reused a generic contains-LIKE pattern, while folder pagination was always recent-first and only the already-loaded frontend page was re-sorted alphabetically.
- fix: Added a dedicated escaped species prefix matcher, passed Collection sort mode to Rust, and applied markup-stripped alphabetical ordering in SQL before pagination.
- verification: Prefix and order mutations both made their dedicated tests fail; final Rust suite 154 passed/1 fixture ignored, frontend 374 passed, TypeScript and cargo all-targets checks clean.
- files_changed: `src-tauri/src/commands/import.rs`, `src/lib/finds.ts`, `src/tabs/CollectionTab.tsx`, `src/tabs/CollectionTab.test.tsx`
