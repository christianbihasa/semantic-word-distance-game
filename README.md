# Heat Seek

A word-guessing game: find the secret word by meaning, not spelling. Every guess gets a rank
showing how semantically close it is to the target, from **#1** (the word itself) to about #50,000.

| Rank      | Tier        |
| --------- | ----------- |
| 1–100     | 🟩 hot      |
| 101–1,000 | 🟨 warm     |
| 1,001+    | 🟥 ice cold |

Hints reveal a word closer than your best guess, but never the answer itself.

Two modes:

- **📅 Daily**: everyone gets the same word each local calendar day (puzzle #1 was 2026-10-16), with a
  spoiler-free **Share** result (one coloured square per guess, no words).
- **🎲 Random**: a fresh word every round. Each mode keeps its own saved game.

## Run it locally

Requires Node 24+.

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run format`, `npm run build`.
`npm run build && npm run preview` serves the production build at the same sub-path as GitHub Pages
(http://localhost:4173/semantic-word-distance-game/).

## Deployment

Pushes to `main` deploy to GitHub Pages at https://christianbihasa.github.io/semantic-word-distance-game/
via `.github/workflows/deploy.yml`, which runs CI first and then calls the shared
`christianbihasa/dev-toolkit` deploy workflow (`working-directory: ./frontend`). After each successful
deployment, `capture-preview.yml` commits a fresh `preview.png` screenshot. The production base path
is set in `frontend/vite.config.ts` (override with `BASE_PATH=/` for a custom domain).

## How it works

```
data-pipeline/build_assets.py ──► frontend/public/data/
                                   manifest.json   version, layout, secret-word list
                                   vocab.json      ~31,700 ranked words, frequency order
                                   aliases.json    other word forms -> ranked word (held -> hold)
                                   embeddings.bin  int8 GloVe-300d vectors + inverse norms (≈9.6 MB)

browser:  main.ts ── storage.ts ── worker-rank.ts (ranks the whole vocabulary vs. the target, ~ms)
             │                         └─ asset-cache.ts (IndexedDB, keyed by data version)
             ├─ engine.ts   game state, stemming, hints, tiers
             └─ ui.ts       DOM rendering (textContent only)
```

- The vocabulary is every dictionary headword (WordNet) among GloVe's 150,000 most frequent words, in
  base form. A form that is mainly an inflection merges into its base (years -> year, scanning -> scan,
  held -> hold, was -> be); forms that are words in their own right stay (physics, news, building,
  glasses, saw). Capitalised entries are included when their main sense is a time, place, landmark or
  food (december, christmas, paris, atlantic, parmesan), but not people's names. Guesses are matched
  exactly, then via `aliases.json`, then by suffix rules.
- Rankings are exact cosine similarity over int8-quantised vectors. `frontend/tests/ranking.test.ts`
  checks that the browser reproduces the pipeline's Python ranking exactly.
- Game data is cached in IndexedDB under its content-hash version; saved games are discarded when
  the data version changes, so ranks never go stale.

## Rebuilding the game data

Requires Python 3.11+.

The built files in `frontend/public/data/` are committed, so you only need this to change the data.

1. Download `glove.6B.zip` from the official Stanford GloVe page (https://nlp.stanford.edu/projects/glove/),
   unzip it, and put `glove.6B.300d.txt` in `data-pipeline/raw_source/` (git-ignored). The other
   dimensions in the zip are not needed. Expected SHA-256:
   `91125602f730fea7ca768736c6f442e668b49db095682bf2aad375db061c21ed`.
2. Build:

```bash
cd data-pipeline
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` elsewhere
pip install -r requirements-dev.txt
python build_assets.py --import-glove raw_source/glove.6B.300d.txt
pytest
```

The import selects the vocabulary (rules in `common.py`), writes `artifacts/words.json` and
`artifacts/aliases.json`, and saves the vectors to `artifacts/vectors.f16.npy` (git-ignored, ~19 MB).
Later rebuilds that don't change the vocabulary can skip the import: `python build_assets.py`. The source
file's SHA-256 is recorded in `artifacts/provenance.json` and the manifest; nothing is downloaded
automatically.

Secret words live in `targets.txt`, in daily-puzzle order, and are always kept in the vocabulary, so
rebuilding never reshuffles the daily sequence. `python build_assets.py --reselect-targets` regenerates
the list from common dictionary headwords (no names, no inflections, minus `blocklist.txt`); that does
change the daily sequence.

## Evaluating embedding models

`data-pipeline/golden.json` lists, for 20 secret words, the neighbours players expect (one list comes
from another game's real ranking; the rest are drafts to refine). `evaluate.py` scores any vector file
against it using the game's own vocabulary and guess rules:

```bash
cd data-pipeline
python evaluate.py                                   # the vectors the game ships now
python evaluate.py glove=current nb=raw_source/numberbatch-en-19.08.txt.gz blend=glove+nb --pca 200 --detail
```

It reads GloVe, fastText (`.vec`) and ConceptNet Numberbatch files (optionally `.gz`), can blend two
models (ranking by their average cosine) and score PCA-reduced variants. `eval-bakeoff.md` holds the
latest comparison of GloVe, fastText and Numberbatch.

## Development

```bash
pip install pre-commit && pre-commit install   # ruff, eslint, prettier, tsc on commit
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests, build and `npm audit` for the frontend,
and Ruff and pytest for the pipeline.
