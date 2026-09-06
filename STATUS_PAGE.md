# CommonNote independent status page

Public URL: <https://jaeyoonsung.github.io/commonnote-status/>.

The CommonNote paper/glass design lives in `status-web/`. It reuses the app's logo and locally hosted Pretendard fonts (font license included). The public page has no runtime dependency on the app server, external font host, or a visitor's GitHub API quota. Only navigation links lead to the app. Korean and English copy are maintained together.

## Monitoring versus publishing

Upptime's existing eight generated workflows, histories, graphs, and issues remain unchanged. Upptime reserves the `site/` directory; do not put custom source there. Its old publisher may still update `gh-pages`, which is retained for history/rollback but is not the configured Pages publishing source.

`.github/workflows/commonnote-status.yml` is the separate publisher. GitHub Pages must use **GitHub Actions** (`build_type: workflow`), and the `github-pages` environment must allow deployments from `master`. Retain the old `gh-pages` policy rather than removing restrictions globally.

The custom workflow runs on frontend changes, completed monitoring/summary workflows (including failure), incident changes, a twice-hourly fallback schedule, and manual dispatch. It always checks out trusted `master`, never executes a triggering run's artifact or issue content, and only uploads the reviewed static output. Build credentials are read-only; Pages/OIDC write privileges belong only to the deploy job. Action versions are pinned to reviewed commits. Future Upptime changes should be reviewed for new publishing behavior.

`node --test tests/*.test.mjs` runs deterministic, dependency-free tests on Node 22+. `node scripts/build-status.mjs <empty-directory>` creates the deployment artifact. It includes a real root `index.html`, all local assets, `status-data.json`, `.nojekyll`, and a hash manifest in `build-info.json`. No npm install is required. A private local test may pass `--fixture <feed.json>`; production always reads real GitHub records.

## Interpreting status

Status-record timestamps and monitor-run timestamps are separate. Upptime may skip committing a history YAML when a service remains healthy. Its `lastUpdated` is therefore the latest persisted observation, not every successful check. Records older than 15 minutes are shown as unconfirmed current status, alongside their last reported result. A successful CI run is not relabeled as a per-service measurement. Failed/cancelled latest runs are not hidden behind an older success.

The 90-day strip describes aggregate incident records, not an invented continuous probe history. Days before monitoring or beyond available evidence are unconfirmed. Incident API errors and capped history are labeled, never presented as “no incidents.” All public source fields are bounded and rendered as text; links are restricted to the exact repository's issues. The browser re-ages the snapshot every 30 seconds and reloads it every five minutes. GitHub schedules can be delayed; no five-minute monitoring guarantee is made.

## Deploy and verify

After tests and review, push the scoped changes to `master`, confirm the Pages environment/source settings, and dispatch **CommonNote Status Pages** if needed. Verify the Actions deployment is successful, `/commonnote-status/` and `/commonnote-status/index.html` return HTTP 200, the local assets load, and `build-info.json` matches the deployed source. Inspect mobile, desktop, dark mode, KO/EN, stale records, feed failure, and malicious incident text using local fixtures. Verify automatic resource requests still work with the app origin unavailable.

Prefer redeploying a known-good custom commit for rollback. The old `gh-pages` branch is retained; returning Pages to legacy `gh-pages`/`/` restores the previous generated site, including its previously observed default design/root-404 defects. Never force-push or remove monitor histories as part of a frontend rollback.
