# Daily refresh fail-safe

The dashboard refresh has two cloud-side triggers:

- GitHub Actions `schedule` attempts at 09:13, 09:43, and 10:13 Amsterdam time during summer time.
- A hosted cron job should call the workflow dispatch API once per day as the fail-safe trigger.

The workflow checks `data/snapshot.json` before refreshing. If today's Amsterdam-date
snapshot already exists, the run exits without refreshing. That makes duplicate triggers safe.

## Hosted cron setup

Create a fine-grained GitHub token for `Yoramtap/tracker` with:

- Repository access: `Yoramtap/tracker`
- Repository permissions: `Actions: Read and write`

Create a hosted cron job, for example in cron-job.org:

- Schedule: daily at 09:20 Europe/Amsterdam
- Method: `POST`
- URL: `https://api.github.com/repos/Yoramtap/tracker/actions/workflows/weekly-dashboard-refresh.yml/dispatches`
- Header: `Accept: application/vnd.github+json`
- Header: `Authorization: Bearer <GITHUB_TOKEN>`
- Header: `X-GitHub-Api-Version: 2022-11-28`
- Body:

```json
{"ref":"main","inputs":{"force":"false"}}
```

Expected response from GitHub is HTTP `204 No Content`.

## Manual force refresh

Use the GitHub Actions UI for `Daily Dashboard Refresh`, choose `Run workflow`, and set
`force=true` only when you intentionally want to refresh even if today's snapshot exists.
