# Closer

A daily estimation game. Each puzzle lays several items along one numerical scale — how long
events last, how far apart places are, how much things weigh — and asks you to place each one where
you think it belongs. Submit, and Closer reveals the true positions and scores how close you were,
out of 100.

Puzzles are content, not code: each one is a JSON file in [`content/puzzles/`](content/puzzles/),
validated on every build. Adding a puzzle means adding a file.

---

## Screenshots

_Add screenshots here once captured._

| Home | Playing a puzzle | The reveal |
| --- | --- | --- |
| _`docs/home.png`_ | _`docs/play.png`_ | _`docs/reveal.png`_ |

---

## Local setup

Requires Node 18+.

```bash
npm install
npm run dev             # start the dev server (http://localhost:5173)
npm run build           # validate content + type-check + production build into dist/
npm run preview         # preview the production build locally
npm run test            # run the Vitest unit tests
npm run puzzles:check   # validate content/puzzles/ on its own
```

`puzzles:check` also accepts `-- --strict`, which fails on warnings as well as errors — useful in
CI once the content is clean.

No environment variables or backend are required — the app runs entirely from bundled puzzle data
and `localStorage`.

---

## Deploying to Netlify

1. Push this repository to GitHub.
2. In Netlify, **Add new site → Import an existing project** and pick the repo.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy. After it finishes, confirm the SPA redirects work.
6. Confirm direct navigation to a nested route such as `/play/how-long-does-it-take` loads
   correctly (rather than a 404) on both first visit and refresh.

### SPA redirects

Because this is a single-page app using the HTML5 history API, the server must serve `index.html`
for any route that isn't a real file — otherwise refreshing `/play/:slug` returns a 404. Two
redundant configs are included:

- [`public/_redirects`](public/_redirects) — `/*  /index.html  200`
- [`netlify.toml`](netlify.toml) — the same rule as a `[[redirects]]` block.

Either one is sufficient; both are present so the project works whichever Netlify picks up.

---

## Project structure

```text
content/puzzles/     one JSON file per puzzle — the authored content
scripts/
  check-puzzles.mjs  the validator behind `npm run puzzles:check`
src/
  components/        UI + game components (GameScale, ScaleMarker, ResultSummary, …)
  composables/       usePuzzleSession, useScaleInteraction, useLocalStorage, usePuzzles
  data/
    content.ts       globs content/puzzles/ into authored sources
    resolve.ts       fills in ids, display values and end labels
    validate.ts      the rules the checker enforces
    puzzles.ts       the resolved, playable set
  repositories/      PuzzleRepository interface + Local (active) & Supabase (placeholder)
  router/            Vue Router routes
  services/          scale.ts, scoring.ts, sharing.ts, daily.ts, format.ts (+ *.test.ts)
  types/             puzzle.ts, session.ts
  views/             HomeView, PuzzleView, BrowseView, AboutView
```

Domain logic (scoring, scale math, daily selection) lives in `services/` and is unit-tested. The
game components consume puzzles generically — there is no puzzle-specific logic in any component.

---

## Adding a puzzle

Add a file to [`content/puzzles/`](content/puzzles/) named `<number padded to 4>-<slug>.json`.
Nothing else needs editing — the set is globbed from the directory.

```json
{
  "number": 19,
  "slug": "a-unique-url-slug",
  "title": "How ... is each thing?",
  "prompt": "Place each one from least to most.",
  "category": "Distance",
  "unit": "meters",
  "scaleType": "logarithmic",
  "minValue": 1,
  "maxValue": 1000,
  "difficulty": "medium",
  "items": [
    {
      "label": "A thing",
      "shortLabel": "Thing",
      "value": 42,
      "fact": "A short, surprising fact.",
      "sourceLabel": "NOAA",
      "sourceUrl": "https://…"
    }
  ]
}
```

Then run `npm run puzzles:check`.

### What's derived, and what you can override

Only `value` is required per item — [`resolve.ts`](src/data/resolve.ts) fills in the rest:

| Field | Derived from | Override when |
| --- | --- | --- |
| item `id` | `<slug>-<index>` | never — it's the localStorage key |
| `displayValue` | `value` + `unit` via [`format.ts`](src/services/format.ts) | the formatter can't say it: `"about 1 day"`, `"300+ years"` |
| `minLabel` / `maxLabel` | `minValue` / `maxValue` + `unit` | a phrase reads better: `"8 hours"` beats `"8 hr"` |

Set `"approximate": true` on an item to prefix its display value with `~` — use that rather than
hand-writing the whole string. `format.ts` knows `seconds`, `meters`, `kilograms`, `US dollars`,
`people`, `years`, `years ago`, `°C`, `km/h` and `beats per minute`; any other unit falls back to
plain `<number> <unit>` and the checker warns.

### Rules the checker enforces

Errors (these fail the build): unique slug and `number`, kebab-case slug, known category, 4–6
items, every item has a `fact`, values inside `[minValue, maxValue]`, and — the silent killer —
no zero or negative value on a logarithmic scale, since `Math.log(0)` produces a `NaN` marker
position.

Warnings (reported, don't fail): an item within 3% of either end of the scale is a free 100; two
items within 4% of each other render as overlapping markers on a phone; items packed into less
than half the scale make a dull puzzle. Pass `-- --strict` to fail on these too.

Choosing bounds so the margins clear: on a logarithmic scale, `minValue ≈ smallest / 3` and
`maxValue ≈ largest × 3`. On a linear scale, pad by 10% of the range at each end. Use linear
whenever values can be zero or negative (temperature, elevation) — logarithms need positive
numbers.

## Puzzle data model

[`src/types/puzzle.ts`](src/types/puzzle.ts) carries two shapes: `PuzzleSource` is what you author,
`Puzzle` is what the game consumes after `resolvePuzzle` fills in the derived fields. Components
only ever see the resolved form.

---

## Linear vs. logarithmic scales

Two pure helpers in [`src/services/scale.ts`](src/services/scale.ts) do all the mapping:

```ts
valueToPosition(value, min, max, scaleType) // -> 0..1 position on the scale
positionToValue(position, min, max, scaleType) // inverse
```

- **Linear** spreads values evenly: the midpoint value sits at 0.5.
- **Logarithmic** spreads *orders of magnitude* evenly: on a 1–1000 scale, 10 sits at 1/3 and 100
  at 2/3. This keeps a puzzle playable when values range from tiny to enormous.

### Telling the player which one they're on

A logarithmic scale drawn without labels is indistinguishable from a linear one, and players read
it as linear — which puts every marker in the wrong part of the board. Two things prevent that, and
both are load-bearing:

- `scaleTicks()` returns gridline **values**, not bare positions, and the board labels them. For
  durations it walks a time ladder (`1 sec, 10 sec, 1 min, 10 min, 1 hr`) rather than decades of
  seconds, which would render as `16.7 min` and read like a rounding bug.
- Logarithmic puzzles carry a note above the track naming the halfway value — *"Log scale — the
  middle is 38 sec"*. That single concrete fact is what breaks the linear assumption.

Both are covered by tests in `scale.test.ts`.

---

## Scoring

Defined in [`src/services/scoring.ts`](src/services/scoring.ts).

- The total is **100 points**, split equally across the items.
- Each item is scored purely on the **normalized visual distance** between your marker and the true
  position — never the raw numeric difference — so scoring behaves identically on linear and log
  scales.
- The curve is a **Gaussian falloff**: forgiving near the answer, dropping away sharply with
  distance.

  | Error (normalized) | Roughly earns | Band |
  | --- | --- | --- |
  | 0.00 | 100% | Exact |
  | 0.10 | ~89% | Close |
  | 0.25 | ~47% | Off |
  | 0.50 | ~5% | Far off |

- Scores are **deterministic**, never negative, per-item rounded for display, and the total is
  derived from the unrounded sum so a perfect game reads exactly 100.
- Each item also gets a qualitative band (**Exact / Very close / Close / Off / Far off**) shown with
  a shape glyph and text, not color alone.

Tested in `scoring.test.ts` (perfect score, wild misses, boundaries, determinism).

---

## Daily puzzle selection

Defined in [`src/services/daily.ts`](src/services/daily.ts):

```text
day N since ANCHOR_DATE serves the puzzle whose `number` is N + 1
```

Puzzles are served by their own release `number`, never by their position in the set, so
**appending a puzzle never changes what any past or future date resolves to**. That's what makes
`Closer #47` a stable identity — the share text depends on it.

`ANCHOR_DATE` is launch day. Moving it renumbers the entire schedule, so freeze it before launch.

Once the schedule outruns the library, `getDailyPuzzle` rotates the archive deterministically
rather than showing nothing; `isScheduledRun` reports whether a date is still inside the first run.
Every puzzle stays reachable from the browser regardless, and "Next puzzle" jumps to your next
unplayed one. Tested in `daily.test.ts`.

---

## localStorage behavior

All progress lives in `localStorage` under a single versioned key (`closer:app-state`). The stored
shape (see [`src/types/session.ts`](src/types/session.ts)):

```ts
interface StoredAppState {
  version: 2
  sessions: Record<string, StoredPuzzleSession> // per-puzzle placements, score, timestamp
  instructionsDismissed: boolean
}
```

Sessions are keyed by puzzle slug. The `version` field drives migration in
[`useLocalStorage.ts`](src/composables/useLocalStorage.ts) — v1 (the playtest shape, which carried a
`feedback` array and keyed sessions by `p01`-style ids) is carried forward rather than discarded.
Add a migration branch on every future bump; silently wiping a player's history is not an option
once the game has an audience. **Reset all progress** is available on the Puzzles screen.

---

## How Supabase could be added later

The app deliberately depends only on a small data-access interface,
[`PuzzleRepository`](src/repositories/PuzzleRepository.ts), and today uses
[`LocalPuzzleRepository`](src/repositories/LocalPuzzleRepository.ts). A commented
[`SupabasePuzzleRepository`](src/repositories/SupabasePuzzleRepository.ts) placeholder shows the
shape of a future swap — done in one place, [`src/repositories/index.ts`](src/repositories/index.ts),
without touching any game component.

Suggested tables when moving to Supabase:

- `puzzles` — one row per puzzle (number, slug, title, prompt, category, scale config, difficulty).
- `puzzle_items` — items belonging to a puzzle (value, display value, fact, source).
- `play_sessions` — anonymous sessions (which puzzle, when).
- `scores` — per-item and total scores for a session.

The authored JSON in `content/puzzles/` maps onto the first two tables directly, so the content
files double as the seed data. No Supabase environment variables or configuration are required to
run the app as it stands.

---

## Current limitations

- No accounts, no server — progress is per-browser and clears if storage is wiped.
- There is no once-a-day gate; every released puzzle is playable from the archive at any time.
- Puzzle values are representative figures; items marked `"approximate": true` render with a `~`.
- Not every item carries a source yet. `sourceUrl` is validated when present, not required.
- The Supabase repository is a documented placeholder, not a working implementation.

---

## Next steps

1. Grow the library — the schedule is append-safe, so this is purely a content problem now.
   Five puzzles still carry overlapping-item warnings; those need a replacement item each.
2. Require `sourceUrl` on every item and promote the missing-source check from warning to error.
3. Add Supabase for shared scores once there's an audience. At that point `PuzzleRepository`
   should split `getIndex()` from `getPuzzleBySlug()` so puzzles can load lazily — past roughly
   50 puzzles, bundling the whole set to play one stops being free.
4. Introduce a real daily gate and streaks.
5. Revisit the scoring curve once there's data on how fair it feels.
```
