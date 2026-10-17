---
name: ui-check
description: Verify a UI change against its requirement or design, or (when none is given) against the project's own design identity. Use after building or changing any page/component, or when the user says "ui-check", "check the UI", "kiểm tra giao diện", "đúng design chưa".
---

# UI check

Automatic layer (already wired in `.claude/settings.local.json`, do not re-add):
- PostToolUse on Edit/Write: impeccable detector, immediate tier (contrast, overflow, gradient text, design-system drift).
- Stop: impeccable deep pass over every UI file touched this session.

Those catch mechanical defects only. This skill is the judgment layer. Run it once per finished UI task, not per edit.

`IMP=.claude/skills/impeccable/scripts/impeccable`

## 1. Pick the yardstick (first that exists wins)

1. A design the user gave: image, Figma link, mockup, or written spec in the conversation.
2. `PRODUCT.md` + `DESIGN.md` at repo root (impeccable's durable context).
3. Neither: stop and offer `/impeccable init` (PRODUCT.md) then `/impeccable document` (DESIGN.md). Do not judge "identity" against nothing.

Always also apply CLAUDE.md conventions: 4 color tokens only (`paper`, `ink`, `line`, `accent`), muted = `text-ink/70`, radius only on draggable task cards, no badges.

## 2. Capture the real page

App must be running (`pnpm dev`, Postgres up). Then, both viewports in one round:

```bash
mkdir -p .ui-check
$IMP detect http://localhost:3000/<route>                       # desktop 1280x800
$IMP detect --viewport 390x844 http://localhost:3000/<route>     # mobile
agent-browser open http://localhost:3000/<route>
agent-browser set viewport 1280 800 && agent-browser screenshot "$PWD/.ui-check/desktop.png"
agent-browser set viewport 390 844  && agent-browser screenshot "$PWD/.ui-check/mobile.png"
```

Screenshot paths must be absolute (a relative path is silently saved to `~/.agent-browser/tmp`). Re-`open` the page after changing viewport. Mobile: check `document.documentElement.scrollWidth === innerWidth` with `agent-browser eval`; a page-level horizontal scroll is a fail.

If the user gave a design image, also: `agent-browser diff screenshot --baseline <design.png>`.
Read both screenshots with the Read tool. Look at them; do not review from code alone.

## 3. Judge

Against a given design: list every mismatch (layout, spacing, type, color, copy, states). Cite what the design shows vs what the page shows.

Without a given design, run `/impeccable critique <route file>` and additionally answer these four, each with one concrete piece of evidence from the screenshot:

- **Identity**: what on this screen could only belong to this product? (If the answer is "nothing, it's a generic card grid", fail.)
- **Logic**: does the eye land on the primary action/content first? Is the reading order the task order?
- **Human**: does copy sound like a person (empty states, errors, labels), not "No data available"?
- **Restraint**: is every element earning its place? Anything decorative that says nothing?

Also check states the screenshot didn't show: empty, long text, many items, error, keyboard focus.

## 4. Fix once, recheck once

Fix everything found in one batch, rerun step 2 once, then stop. Report:

```
Yardstick: <design | PRODUCT/DESIGN.md>
Detector: desktop <n> / mobile <n> findings
Fixed: ...
Still open (needs user decision): ...
```

Detector false positive? Follow impeccable's triage (`$IMP hooks ignore-value ... --reason`); never ignore to skip a real fix.
