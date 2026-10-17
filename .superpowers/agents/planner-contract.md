# Planner contract (Developer role, one milestone)

You write ONE milestone implementation plan for "Chợ Sáng" (Vietnamese grocery MVP demo). Project root: /home/dat/Documents/GitHub/Remix/App_2. Today: 2026-10-15.

## Read first (in this order)
1. docs/superpowers/autonomous-pipeline.md: how this project runs.
2. docs/superpowers/specs/2026-10-14-cho-sang-grocery-design.md. This is the AUTHORITY. Read §2 rulings, §3 scope, §4 design system, §5 architecture/data model/routes/budgets, and §6 the row for your milestone.
3. docs/superpowers/plans/2026-10-14-cho-sang-roadmap.md. Read the module contract, the spike findings, and EVERY "Kết quả Mx" section. Carry-overs addressed to your milestone are mandatory scope.
4. docs/superpowers/plans/2026-10-14-m1-catalog.md: the format and level of detail to match (full code in every step, exact commands, expected outputs, Review Focus, Global Constraints).
5. The actual code under app/, prisma/, and package.json. Plans must match the real exports, not the roadmap's memory of them.

## Skills
- Load `superpowers:writing-plans` and follow it, with these exceptions: no git (replace commit steps with a "Checkpoint" of `npm run typecheck && npm test`), and do not ask about the execution method (subagent-driven is already chosen).
- Load `react-router` before writing route code and `prisma-client-api` before writing queries. Never load `prisma-orm-setup`.

## Verify before you write (mandatory)
Any API you are not 100% sure of for these exact versions (react-router 8.4.0, prisma 7.10.0, zod 4.6.7, three 0.186.1, fabric 7.4.0, tailwind 4.3.3, vitest 5.0.4, @playwright/test 1.64.0) must be verified:
- Read the installed docs/types in node_modules (e.g. node_modules/react-router/docs/), or
- Run a tiny spike in /tmp/claude-1000/-home-dat-Documents-GitHub-Remix-App-2/42698cda-c1e8-4548-b510-c8193df0cf9c/scratchpad/<milestone>-spike/.

Never put spike files in the project. Delete any temporary file you create inside the project.

Record what you verified in a "Spike findings" section of the plan.

## Hard rules
- Pinned versions only, installed with `npm i -E pkg@exact`. A new dependency is allowed only if the spec's stack table lists it.
- npm 12 blocks install scripts. If one appears, the plan must say exactly which to approve or deny. Fabric pulls `canvas`: deny it.
- The DB is shared dev data. Never `prisma migrate reset`, never `docker compose down -v`, never delete `uploads/` wholesale. Schema changes go through `prisma migrate dev --name <x>` (non-destructive) plus `prisma generate`.
- Any new catalog-derived field must be added to the `update` object in prisma/seed.ts.
- UI: 375px first, ≥44px targets, hover + focus-visible, Vietnamese copy, the palette/token meanings in spec §4, and Lucide icons only. Plans with UI must include a playwright-cli screenshot step at 375×812 AND 1280×800 into the milestone's sdd folder: /home/dat/Documents/GitHub/Remix/App_2/.superpowers/sdd/<plan-basename>/.
- Tasks are sized so that each one carries its own test cycle. Aim for 5–9 tasks. Every task has Files / Interfaces (Consumes/Produces with exact signatures) / steps with full code.
- Include a "Review Focus" section: 5 untested failure modes a real user would hit, and give each its test.

## Output
- Write the plan to docs/superpowers/plans/<file name given in your dispatch>.
- Run the writing-plans self-review (spec coverage, placeholders, type consistency).
- Reply with ONLY: the plan path, the task list (one line each), the spike findings (one line each), and open questions. For any decision the spec leaves open, decide it yourself, mark it "Decision:" in the plan, and list it here.
