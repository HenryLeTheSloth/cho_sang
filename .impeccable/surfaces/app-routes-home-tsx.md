---
version: 1
slug: "app-routes-home-tsx"
primary_target: "app/routes/home.tsx"
related_targets: []
---

# Homepage (/)

Scope: full homepage redesign, header through footer. Visitor mode: Persuade.
Audience/job: phone shopper filling a daily basket in ~3 minutes; pitch viewer judging trust.
Priority after hero: trust & freshness (origin, shelf life, unit, price/kg, 24h replacement). Then fast basket, then gift basket.
Constraints: Three.js basket allowed in hero only (owner requirement), poster fallback; 44px targets; Vietnamese diacritics never clipped.
Status: mock HTML at docs/mocks/home-redesign.html for owner review before porting to React.

## Direction contract
THESIS: The vendor's cardboard price sign is the interface: every price, origin and freshness fact is written big and plain the way a chợ vendor writes it. Refuses the white-green promo-carousel grocery template.
OWN-WORLD: Torn kraft carton (#C9A27A family) as the committed field for every sign and tag; black marker ink lettering (Shantell Sans heavy) for prices and headlines; printed grotesque (Archivo) for facts; highlighter yellow only on the one next action; green only for "còn hàng"; red marker only for corrected prices.
STORY: Visitor sees today's prices and origins first, believes nothing is hidden (unit, price/kg, origin, 24h replacement), searches or taps + and fills the basket to freeship.
FIRST VIEWPORT: Header = wordmark in marker + full-width search. Hero = big torn carton sign (H1 in marker, 4-line price board of real items with + buttons, highlighter CTA "Đi chợ ngay", next slot) beside a "Mới lên kệ" product shelf slider: one cut-out product per slide on a shelf line, tilts with the pointer, hover reveals a swinging carton price tag top-left and "Thêm vào giỏ" below (always visible on touch), prev/next buttons + count. Replaces the M6 3D basket (owner request 2026-10-16). Promise strip = three sticky notes. Hover grammar: highlighter swipe on links/CTA, spring-swing on tags.
FORM: Bảng giá bìa (cardboard price signs), grounded candidate 1 of 7 (IMPECCABLE'S PICK chosen by owner); seed key 1c4b68ef.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
