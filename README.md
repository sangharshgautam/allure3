# Allure 3 Report Hub

Central, free GitHub Pages dashboard for **Allure Report 3** test reports coming from any number of **private** repositories. Each project keeps its own report and trend history; this repo hosts the shared publish pipeline and the dashboard.

```
Private repo CI                          This hub (public)
────────────────                         ─────────────────
run tests (any framework)                .github/workflows/publish-report.yml
  → allure-results/  or  *.xml           scripts/build-dashboard.mjs
upload-artifact "test-results"  ──────►  scripts/trim-history.mjs
uses: <owner>/<hub>/.github/             data/<project>/history.jsonl  (trends)
  workflows/publish-report.yml@main      <project>/latest/             (report)
secrets: inherit (HUB_TOKEN)             index.html                    (dashboard)
                                         ──► https://<owner>.github.io/<hub>/
```

- **Allure 3 only** — the TypeScript CLI (`npm install -g allure`), default "Awesome" report.
- **Trends for free** — Allure 3 keeps all history in one `history.jsonl` (`historyPath` + `appendHistory: true`); we persist it in `gh-pages` between runs and trim it to the last 30 runs. No server needed.
- **Any format** — native `allure-results` (JSON) or plain JUnit XML; Allure 3 auto-detects whatever is in the artifact.
- **Auto-discovery** — a new project appears on the dashboard as soon as it publishes once.

## One-time hub setup

1. Create a **public** GitHub repo for this code and push `main` to it.
   (Pages is free only on public repos — test names in reports will be publicly reachable.)
2. Trigger a smoke-test publish (Actions tab → *Publish Allure report* → *Run workflow*, fill in a project name). This creates the `gh-pages` branch.
3. Repo **Settings → Pages**: Source = *Deploy from a branch*, branch = `gh-pages` / `/ (root)`.
4. Your site is live at `https://<owner>.github.io/<repo>/` with the bundled sample report.

## Onboarding a private project

1. **Fine-grained PAT**: GitHub → Settings → Developer settings → Fine-grained tokens → *New token*.
   - Resource owner: your account; repository access: **only this hub repo**.
   - Permissions: **Contents: Read and write**.
2. Save it as the secret `HUB_TOKEN` in the **private** repo.
3. Add the snippet from [`examples/publish-report.yml`](examples/publish-report.yml) to the private repo's test workflow — change `project:` (unique name, e.g. `billing-api`) and `<owner>/<hub-repo>`.
   - `upload-artifact` + the publish step should use `if: always()` so failing tests still publish reports.
   - Point `path` at your `allure-results/` directory or your JUnit `*.xml` files.

That's it — the dashboard row appears after the first run; the trend chart appears inside the report from the second run on.

## How a publish works

1. Private repo uploads `test-results` artifact, then calls this repo's reusable workflow.
2. The workflow checks out this repo's `gh-pages` (the current site), restores `data/<project>/history.jsonl`, and generates a fresh report with `allurerc.mjs` configured with `historyPath` + `appendHistory: true` (Allure appends the current run to the file itself).
3. It writes `meta.json` (build #, CI run link), injects `executor.json` (so the report links back to CI), trims history, regenerates `index.html`, and force-pushes a single fresh commit to `gh-pages`.
4. GitHub Pages redeploys. A global concurrency group queues overlapping publishes so parallel projects can't corrupt each other's push.

## Dashboard

`index.html` is regenerated on every publish: one row per project with pass/fail badge, passed/failed/broken/skipped counts, duration, build number, last-run age, a link to the latest report and to the CI run that produced it.

## Limits & retention

- GitHub Pages published sites max out at **1 GB** — size ≈ sum of latest reports (screenshots/attachments count!) + history files.
- History is capped at 30 runs per project (workflow input `history-runs`). Each run is one JSONL line; trim more aggressively if you have very large suites.
- Only the **latest** report per project is browsable; older runs exist as trend data points only.

## Smoke test

Actions → *Publish Allure report* → *Run workflow* → project name `smoke-test`. Uses the bundled [`fixtures/sample-junit.xml`](fixtures/sample-junit.xml), so it also verifies the JUnit XML path end-to-end.
