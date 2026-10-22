# Local development and GCP releases

All application development happens in the local GitHub checkout. The required sequence is **edit locally → test locally → commit → push → deploy the exact pushed commit → retest on GCP**. VM terminal access is for deployment, configuration, diagnostics, and recovery; it is not a second development tree.

Current target: project `luigis-pizzeria-512320`, VM `luigis-demo`, zone `us-central1-a`. Use `--tunnel-through-iap` for SSH and SCP. The local CLI is available under the ignored `demo-dist/tools/google-cloud-sdk/bin/` folder if `gcloud` is not on PATH.

## 1. Develop and verify locally

Inspect the current branch and working tree before editing. Preserve unrelated work and stay on the current branch unless the owner requests a switch.

Run the checks relevant to the change. For application releases:

```text
npm ci
npm run lint
npm run format:check
npm test
npm run test:a11y
```

Use `npm run demo` for local manual order testing. Inspect desktop/mobile interfaces for UI changes. Deployment shell changes also require Bash syntax checks and a Linux smoke test. Documentation-only changes require reference/path checks; do not invent runtime validation for prose edits.

## 2. Commit, push, and export

Commit only the intended files and push to the current branch. Save the full commit SHA from `git rev-parse HEAD`. Confirm it matches that branch on GitHub before deploying. Export that commit with `git archive`; do not ZIP the working folder or send local credentials, databases, test results, or dependencies.

For example, replace `COMMIT_SHA` with the pushed commit:

```text
git archive --format=tar.gz --output=demo-dist/luigis-release.tar.gz COMMIT_SHA
gcloud compute scp demo-dist/luigis-release.tar.gz luigis-demo: --project=luigis-pizzeria-512320 --zone=us-central1-a --tunnel-through-iap
gcloud compute ssh luigis-demo --project=luigis-pizzeria-512320 --zone=us-central1-a --tunnel-through-iap
```

Compare local and remote archive SHA-256 hashes. Extract into a fresh staging directory outside `/opt/luigis`. Do not restart the tunnel during normal app updates.

## 3. Back up and install on the VM

Use a private root-owned backup directory under `/var/backups/luigis/`, named for the commit and UTC time. Back up the previous application source and `/etc/luigis.env`. Stop only `luigis`, copy the entire `/var/lib/luigis` directory while it is stopped, and retain that backup. Copying just the live `.db` file can omit WAL transactions.

Install from the fresh staged release using `sudo bash deploy/gcp/install.sh`, or apply the committed application files with the existing runtime when dependencies and service configuration are unchanged. When copying a staged tree, use `tar --no-overwrite-dir --no-same-owner` at the destination so a mode-0700 staging directory cannot replace `/opt/luigis` permissions. Keep `/opt/luigis` mode 0755 and preserve the existing database and environment file.

Install runtime dependencies using the committed lockfile when they change. Start/restart only `luigis` and write the full deployed SHA to `/opt/luigis/DEPLOYED_COMMIT` after the files are installed. If startup fails, restore the previous app and restart it; handle database rollback explicitly when migrations changed the schema. Retain backups until recovery is verified.

## 4. Retest the deployed release

- Confirm `luigis` and `luigis-tunnel` are active, `/healthz` returns OK, and `DEPLOYED_COMMIT` matches the pushed SHA.
- Verify the affected behavior on the VM and through the public HTTPS origin. Check deployed file contents against the archive; account for Git archive line-ending conversion when comparing hashes to working-tree files.
- For ordering changes, create a labelled synthetic order, verify server prices and modifiers, confirm the kitchen receives it, advance its stages, and verify live customer progress. Complete/cancel synthetic tickets and log out test sessions.
- For persistence changes, restart the app and verify the same account/order/history remains. The tunnel must stay running so the hostname remains stable.
- For deployment changes, verify permissions and service-user access on Linux. A passing local Bash parse is not an executed Linux deployment.
- Record the deployed SHA, local checks, cloud checks, backup location, and remaining limitations in the handover. Distinguish a documentation-only follow-up commit from the deployed runtime commit.

GitHub Pages publishes an entry point to the full app. Pushing to GitHub does not deploy the Node app to GCP automatically. Follow [LIVE-DEMO.md](LIVE-DEMO.md) for the current public origin and [ACCESS.md](ACCESS.md) for team access.
