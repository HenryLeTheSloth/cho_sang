# SDD ledger — plan: docs/superpowers/plans/2026-10-15-m2-cart.md

Spec reachable. Plan written by Developer-planner agent, gated by Consultant (APPROVE WITH CHANGES; 7 changes applied, spiked). Review: .superpowers/agents/m2-plan-review.md.

## Setup rulings
- Ruling: Autonomous pipeline per user (2026-10-15): agents plan/build/review; controller rules; user checks the end result. — cost if wrong: user reviews at the end.
- Ruling: Shadow review repo moved to /home/dat/.cache/cho-sang-review.git (the /tmp copy was wiped by the 07:19 reboot). M2 base 4353b34. — cost if wrong: none.
- Ruling: Accept the planner's post-gate deviations (offline test via page.route abort instead of network-state-set; two rare offline cases left as ponytail) — both spike-backed. — cost if wrong: rare network edge in pitch.
- Ruling: Consultant open questions: secure-cookie opt-out INSECURE_COOKIES (M7 decides serving); flight 400ms + font decision deferred to Designer at M2 milestone review.

## Pre-flight scan
Plan was spike-verified and Consultant-gated against spec and code; pre-flight focuses on cross-task interfaces as reported by the planner: Task 1 cart.ts (pure totals) → Task 2 cart.server.ts → Task 3 /cart route + root loader + useCart → Tasks 4/5/6/7 UI consumers → Task 8 DoD. Test counts: 44 → 55 (T1, incl. env) → 82 (T2) → 87/88 (T3) per plan; planner states 88 final consistently. No conflicts found in the planner/Consultant record; review loop is the net for implementation-time conflicts.

## Progress
Task 1: minor (deferred): SESSION_SECRET prod guard only rejects 'dev-only' prefix (no min length); pendingQuantities no NaN/mismatch handling (server 400s anyway)
Task 1: complete (commits 4353b34..febb81c, review clean; 56 tests verified by controller)
Task 2: minor (deferred): qty array lacks .max(); qty='' coerces to 0 (removes line, safe); EMPTY_CART shared mutable object (freeze); cart.server test depends on seed data
Task 2: complete (commits febb81c..4a298f0, review clean)
Task 3: ⚠️ resolved: COOKIE_SECURE covered by Task 1 env test
Task 3: complete (commits 4a298f0..2f2c229, review clean; 88 tests)
Task 4: minor (deferred): pending bar transform snaps on collapse (opacity-only fade); header cart error line has no dismiss/icon
Task 4: fix round 1/5 (1 addressed — logo text-xl sm:text-2xl, gap-2, pr-3, placeholder 'Tìm món…'; commits 83e4e8e..21e07dd)
Task 4: complete (commits 2f2c229..21e07dd, review clean after 1 fix round)
Task 5: Ruling: accept implementer's focus-ring deviation (focus-visible:after:-outline-offset-2) — brief ring was clipped by overflow-hidden — cost if wrong: ring contrast over some photos
Task 5: minor (deferred): dead click strip left of the +/stepper (full-width z-10 wrapper swallows taps → use w-fit ml-auto or pointer-events); min-h reserves leave whitespace on 1-line names; sold-out says it 3 times; no hint when + disabled at stock cap; inside ring may be <3:1 on purple photos
Task 5: complete (commits 21e07dd..ab7e234, review clean; race test passed per report)
Task 6: minor (deferred): buy bar lacks safe-area-inset-bottom padding (notched iPhones)
Task 6: complete (commits ab7e234..bf20bb0, review clean)
Task 7: Ruling: accept inset focus ring on drawer close button (clipped by dialog overflow-hidden)
Task 7: minor (deferred → M2 Designer/Customer gate): close button shows focus ring on every open (autofocus → move to heading/dialog); empty state has only a link, no product suggestions; checkout bar lacks safe-area padding; scroll lock without scrollbar-gutter shifts page on desktop; undo toast covers basket row; out-of-stock line not visually distinct
Task 7: complete (commits bf20bb0..3a66842, review clean)
Task 8: complete (verification only, no code change; DoD all pass; LCP / 2.3s, all 2.6s, pdp 2.7s; first-route JS 123368)
Gate: Consultant final review = ready with fixes (0 Critical; I1 → M3: port rapid-tap + offline tests to @playwright/test); fix-now 1–6
Gate: Designer+Customer UI review = PASS WITH FIXES; Customer would buy
Ruling: Designer font decision (d) accepted — drop Be Vietnam Pro 600 + body-font preloads, font-synthesis-weight none, remap 31 font-semibold (14→Bricolage 800, 17→400) — target LCP ≤2.5s on 3 pages — cost if wrong: typographic hierarchy shifts; reversible
Ruling: fly-to-cart becomes 350ms ending at opacity 0, ghost removed at 450ms, skip when image off-screen, badge bump delayed ~300ms, flyToCart called before setQty — spec §4 records it as the single exception to 150–200ms
Ruling: empty-cart suggestions (3 promo items with +) REQUIRED, scheduled into M3 (Designer overrules Consultant's drop; spec council said 'rổ trống + 3 món')
Ruling: freeship success state (text-fresh + Check icon + aria-live) added to the M2 fix wave (Designer Important D2)
Ruling: UI-review minors (disabled − at qty1 → delete, 'Chỉ hàng còn' → 'Còn hàng', collection h2 skip, chip scrollbar, error names item) → M7 polish
Fix wave: A–F addressed (re-review clean, commits 3a66842..85b92a3); LCP / 2.0s, all 2.4s, pdp 2.6s
Ruling: accept PDP LCP 2.6s for now (one run, ~variance); carry gallery sizes tuning to M7 perf pass — cost if wrong: PDP misses Lighthouse target by ~0.1s
Ruling: D8/D11 + new fix-wave minors → M7 polish (recorded in roadmap 'Kết quả M2')
