# Heat Seek

A word-guessing game: find the secret word by meaning, not spelling. Every guess gets a rank
showing how semantically close it is to the target, from **#1** (the word itself) to about #50,000.

| Rank      | Tier        |
| --------- | ----------- |
| 1–100     | 🟩 hot      |
| 101–1,000 | 🟨 warm     |
| 1,001+    | 🟥 ice cold |

Hints reveal a word closer than your best guess, but never the answer itself.

## Run it locally

Requires Node 24+.

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run format`, `npm run build`.

## How it works

```
data-pipeline/build_assets.py ──► frontend/public/data/
                                   manifest.json   version, layout, secret-word list
                                   vocab.json      50,000 words, frequency order
                                   embeddings.bin  int8 GloVe-50d vectors + inverse norms (≈2.7 MB)

browser:  main.ts ── storage.ts ── worker-rank.ts (ranks all 50k words vs. the target, ~ms)
             │                         └─ asset-cache.ts (IndexedDB, keyed by data version)
             ├─ engine.ts   game state, stemming, hints, tiers
             └─ ui.ts       DOM rendering (textContent only)
```

- Rankings are exact cosine similarity over int8-quantised vectors. `frontend/tests/ranking.test.ts`
  checks that the browser reproduces the pipeline's Python ranking exactly.
- Game data is cached in IndexedDB under its content-hash version; saved games are discarded when
  the data version changes, so ranks never go stale.

## Rebuilding the game data

Requires Python 3.11+.

```bash
cd data-pipeline
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` elsewhere
pip install -r requirements-dev.txt
python build_assets.py        # rebuilds frontend/public/data from artifacts/
pytest
```

`artifacts/vectors.f16.npy` and `artifacts/words.json` are the canonical vector source. To import
fresh vectors, download `glove.6B.zip` from the official Stanford GloVe page yourself and run:

```bash
python build_assets.py --import-glove path/to/glove.6B.50d.txt
```

The file's SHA-256 is recorded in `artifacts/provenance.json` and the manifest. Nothing is downloaded
automatically. Secret words are common dictionary headwords (no names, no inflections); edit
`blocklist.txt` to exclude more.

## Development

```bash
pip install pre-commit && pre-commit install   # ruff, eslint, prettier, tsc on commit
```

CI (`.github/workflows/ci.yml`) runs lint, type-check, tests, build and `npm audit` for the frontend,
and Ruff and pytest for the pipeline.
