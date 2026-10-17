# M5 planner hand-back — controller rulings (2026-10-15)

Plan: docs/superpowers/plans/2026-10-15-m5-admin.md (7 tasks; prototyped on scratch copy: vitest 318, e2e 24, `/` JS 128,028B gz).

- Ruling: plan waits for M4 to land, then planner (same agent) re-syncs patches against real post-M4 code (Task 3 BundleOp `{remove, add}` change; orders.server.ts, order.tsx, root.tsx, routes.ts, config.ts, e2e/helpers.ts, seed.ts overlap), then Consultant plan gate.
- Ruling: Open Q1 (status buttons ink vs magenta) and Q2 (custom "Chọn ảnh" file button) → Designer at M5 UI gate.
- Ruling: Open Q3 (seed overwrites nameSearch after admin rename) → carry to M7 (seed should only set nameSearch on create or when name unchanged). Cost if wrong: search mismatch only after re-running setup.
- Ruling: Decision "optional item 4 (weigh grams → final_total) not included" accepted — first on spec cut list.
- Note: JS budget headroom on `/` is ~5KB after M5 — M6 (Three hero, lazy) and M7 must not add to first-route JS.
- Re-sync done (post-M4): prototype vitest 328, e2e 33, `/` 128,042 B gz (+835). Decision 24 (seed rewrites gift-base unit/description only while old pre-M4 wording present) accepted — replaces M4 F4 unconditional update. Q1 (admin bundle block = own markup reusing toOrderView data; shared component → M7) accepted. → Consultant plan gate dispatched.
- Consultant plan gate: APPROVE WITH CHANGES (5 required: admin login .data redirect; image version bump after files; thin-image crop-first; counts as deltas after M6; 10MB cap). Q1/Q2 ruled. Sent to planner.
- Gate changes applied (all 5 + optional 1,2,3,5; 4,6 rejected → M5 UI gate/M7). Prototype +64 vitest, +3 e2e. Plan READY; executes after M6.
