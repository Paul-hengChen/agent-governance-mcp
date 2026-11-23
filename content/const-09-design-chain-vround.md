<!-- design-only:start -->
- **Visual rejections are review rounds**: a `reviewer-visual` rejection is a code-reviewer `CHANGES_REQUESTED` (`status=FAIL`) and counts once in `review_round`, like any other code-reviewer rejection; there is no separate visual counter, cap or split threshold. A pixel difference that shrinks on every try is progress, not the same failure; at the `fix_try` cap of tries that do not shrink it, sr-engineer stops fixing that surface and hands it to the judge — a baseline comparison never stops a ticket.
<!-- design-only:end -->
