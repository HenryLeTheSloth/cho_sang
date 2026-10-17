# Implementer contract (Developer role, one task)

## Project
- Root: /home/dat/Documents/GitHub/Remix/App_2. "Chợ Sáng" is a Vietnamese grocery MVP demo built on React Router 8.4 framework mode, Prisma 7.10, Postgres 18 (Docker compose service `db`), Tailwind 4.3 and vitest 5.
- `npm run setup` starts the DB and migrates and seeds it. Tests need the DB running.
- This machine has TWO Docker engines. The project DB container `app_2-db-1` runs on the `default` context, while the CLI may currently point at Docker Desktop (`desktop-linux`). ALWAYS `export DOCKER_CONTEXT=default` before any docker or `docker compose` command. Never run `docker context use`, because it changes the owner's global config. If the DB really is down on `default`, run `DOCKER_CONTEXT=default docker compose up -d --wait db`.
- Before touching routes or root, load the `react-router` skill. Before writing Prisma queries, load `prisma-client-api`. NEVER load `prisma-orm-setup`.

## Global constraints
Read the `global-constraints.md` file that your dispatch names. It binds every task.

## NO GIT
The project has no git on purpose. Do NOT run `git init` or commit, and do NOT create `.git`. "Checkpoint" means `npm run typecheck && npm test`. The controller snapshots your changes after you report.

## Never
- Never run `prisma migrate reset`, `docker compose down -v`, or delete `uploads/` wholesale.
- Never `pkill -f` a pattern that can match your own shell. Stop servers by the PID listening on their port.
- Remove any `.playwright-cli/` folder a browser tool creates in the project root.
- Never put scratch or spike files in the project. Use /tmp/claude-1000/-home-dat-Documents-GitHub-Remix-App-2/42698cda-c1e8-4548-b510-c8193df0cf9c/scratchpad/ (create it if missing).

## Before you begin
If anything in the brief is unclear or seems wrong, ask with status NEEDS_CONTEXT. Implement exactly what the brief specifies; the code blocks are the intended code. Deviate only when the code does not work, and report every deviation with the reason.

## You do not dispatch subagents
Do all the work yourself. Never spawn helper agents or reviewers.

## Escalate when stuck
Report BLOCKED or NEEDS_CONTEXT when a command fails in a way the brief did not anticipate and the minimal fix is not clear, or when you would need an architectural decision.

## Self-review before reporting
Check completeness (every step done, every Expected observed), quality, YAGNI, and that test output is clean.

## After review findings
You may be resumed with findings. Fix them, re-run the covering tests, APPEND a fix report to your report file (changes, tests, command, output), then reply with the short contract.

## Report
Write the full report to the report file named in your dispatch. Include:
- what you implemented and the files changed;
- every command from the brief with its relevant output (Expected vs actual);
- RED/GREEN TDD evidence where the brief has a failing-test step;
- deviations and why;
- self-review findings and concerns.

Then reply with ONLY these (under 15 lines):
- **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- files changed
- one-line test summary
- concerns
- report path
