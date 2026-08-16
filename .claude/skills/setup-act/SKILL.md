---
name: setup-act
description: Analyze a repository's GitHub Actions workflows and generate/update the optimal local `act` (nektos/act) configuration for it — runner image mapping, Docker socket handling, secrets scaffolding, and package.json shortcuts. Language-agnostic. Use when the user asks to "set up act", "make act work locally", "run GitHub Actions locally", or after adding/changing `.github/workflows/*.yml`.
effort: medium
color: cyan
---

# Details

Goal: make `act` run every workflow in this repository correctly and with minimal container weight, without hand-tuning `.actrc` per repo.

## 1. Inventory the workflows

- List all `.github/workflows/*.yml` (or `.yaml`).
- For each job, record: `runs-on` value, every `uses:` action, whether it invokes Docker (`docker build`, `docker run`, `services:` blocks, `uses: docker://...`), and any `${{ secrets.* }}` / `${{ env.* }}` references.
- Note any `if: ${{ env.ACT }}` conditionals already present — these are existing act-specific accommodations; preserve them.

## 2. Pick runner images

Map each distinct `runs-on` value to a `catthehacker/ubuntu` image tag in `-P` flags:

- `ubuntu-latest`, `ubuntu-24.04`, `ubuntu-slim`, etc. → `catthehacker/ubuntu:act-24.04` (or the matching Ubuntu version). Use the `-slim` tag only if the workflow needs nothing beyond Node/bash — most workflows using `setup-*` actions (bun, biome, node) need the full `act-24.04` tag, since it may need to install itself.
- If a job only runs `docker build`/`docker run` and installs no tools itself, `act-24.04` is fine; don't downgrade to `micro` unless verified to still pass.
- Self-hosted or non-Ubuntu `runs-on` values need a manual note in the output — act can't emulate those; flag them instead of guessing an image.

## 3. Handle Docker-in-Docker jobs

If any job builds or runs Docker images:

- Confirm the job already has an `if: ${{ env.ACT }}` step installing `docker.io` (or equivalent) — if missing, add one, matching this repo's existing pattern (see `build.yml`'s `Install docker CLI (act only)` step) rather than inventing a new one.
- `.actrc` needs a working Docker socket. On Windows with Docker Desktop: `--container-daemon-socket -` (auto) usually works; with Podman machine: `--container-daemon-socket npipe:////./pipe/<machine-name>`. On Linux/macOS the default `/var/run/docker.sock` needs no override — only add `--container-daemon-socket` if the default doesn't resolve.

## 4. Scaffold secrets/env if needed

If any workflow references `${{ secrets.X }}`:

- Create `.secrets` (not `.secrets.example`) is wrong — create `.secrets.example` with each required key set to an empty/placeholder value, and add `.secrets` to `.gitignore` if not already present.
- Add `--secret-file .secrets` to `.actrc` only if `.secrets` is expected to exist locally; otherwise leave it for the user to pass with `-s KEY=value` per run.

## 5. Write `.actrc`

One `-P runner=image` line per distinct `runs-on` value found in step 1, plus the daemon-socket line from step 3 if needed. Don't add flags for concerns the workflows don't have (no `--secret-file` if nothing uses secrets, no extra `-P` entries for runners that aren't used).

## 6. Add package.json shortcuts (language-agnostic — any project with a package.json/Makefile/etc.)

For each job name, add a convenience script equivalent to `act -j <job-name>`, following whatever script-runner convention the repo already uses (`npm`/`bun`/`Makefile` target/etc.). Also add a bare `act` script that lists jobs (`act -l`) or runs all of them, matching existing naming.

## 7. Verify

Run, in order, and report failures without guessing fixes silently:

```
act -l
act -n                      # dry run, all jobs
act -j <job> --dryrun       # per job if -n is too noisy
```

For Docker-dependent jobs, a dry run won't catch daemon-socket issues — run the job for real once (`act -j <job>`) and confirm it reaches the Docker step.

## Output

Report: `.actrc` diff, any new `.secrets.example`/`.gitignore` entries, package.json script diff, and the verification command results. Flag (don't silently skip) any `runs-on` that can't be emulated by `act`.
