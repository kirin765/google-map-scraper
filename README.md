# Google Map Scraper

Google Maps place/review/review-photo scraper implemented in TypeScript.

## Scope
- Search Google Maps with multiple keywords in a single region.
- Collect place metadata, ratings, reviews, and review-photo references.
- Export normalized results as JSON or NDJSON.

## Project layout
- `src/cli`: CLI argument parsing and job entry flow.
- `src/browser`: browser launch, context, waits, and CDP helpers.
- `src/scrapers`: extraction steps for search results, place details, reviews, and review photos.
- `src/models`: normalized types for places, reviews, and jobs.
- `src/exporters`: JSON and NDJSON output writers.
- `src/pipelines`: orchestration for multi-keyword single-region runs.
- `tests`: parser and smoke tests.

## Usage
1. Install dependencies with `npm install`.
2. Run the typecheck/build with `npm run build`.
3. Run tests with `npm test`.

The default runtime launcher expects Playwright to be available at runtime. If you want live browser runs, install `playwright` separately and provide a compatible browser launcher.

## How to request a scrape

### Basic request
```bash
node dist/src/index.js \
  --keywords cafe,restaurant,tourist-attraction \
  --region "Seoul, South Korea" \
  --output output/seoul-run
```

### Resume from checkpoint
```bash
node dist/src/index.js \
  --keywords cafe,restaurant,tourist-attraction \
  --region "Seoul, South Korea" \
  --output output/seoul-run \
  --resume
```

### Dry-run for wiring verification
```bash
node dist/src/index.js \
  --keywords cafe,restaurant \
  --region "Seoul, South Korea" \
  --output output/dry-run \
  --dry-run
```

## Main request options
- `--keywords`, `--keyword`, `-k`: comma-separated keyword list
- `--region`, `-r`: target region
- `--output`, `-o`: output directory
- `--format`: `json` or `ndjson`
- `--max-places`: max places per keyword
- `--max-reviews`: max reviews per place
- `--headless` / `--headed`: browser mode
- `--resume`: continue from checkpoint
- `--dry-run`: validate pipeline without launching Playwright

## How data is delivered

The scraper currently delivers data as files in the directory passed to `--output`.

### Output files
- `*.ndjson`: newline-delimited result records
- `*.json`: single JSON payload when `--format json` is used
- `*.checkpoint.json`: resume state for interrupted runs

### NDJSON record types
- `type: "run"`: job metadata and aggregate counts
- `type: "place"`: normalized place record
- `type: "review"`: normalized review record
- `type: "review-photo"`: normalized review-photo record

### JSON payload shape
When `--format json` is used, one file is written with:
- `job`
- `searchResults`
- `places`
- `reviews`
- `photos`
- `checkpoint`

## Request / delivery flow
1. Pass request parameters through CLI flags or `.env`.
2. The pipeline builds a scrape job from those inputs.
3. Results are written to the `--output` directory.
4. A checkpoint file is written alongside the result so the run can be resumed later.

## Validation commands
- Full test suite: `npm test`
- Smoke tests only: `node --test dist/tests/smoke/cli.smoke.test.js dist/tests/smoke/pipeline.resume.test.js`
