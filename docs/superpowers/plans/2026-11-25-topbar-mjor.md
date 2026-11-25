# Top bar á mjóum skjá: verkefnavalið hylur listahnappinn

Small task profile. Reported by Heimir 2026-11-25 (split screen, about 430 px wide).

## Cause (measured on huginn.pro, 320 to 1023 px)

Since the second project the name is a `select`. `.hg-proj` shrinks to what the row leaves (70 px at 390, 110 px at 430, 2 px at 320), but the `select` inside it is a flex item with `min-width: auto` and `max-width: 40vw`, so it stays wide, spills over the list button, the live dot and (below 412 px) the search button, and takes their presses.

## Size

| Task | Files | Size |
|---|---|---|
| 1. The name shrinks with its box and gets room | `src/vinnubord/vinnubord.css` | S |

## Task 1

Tokens, after `--hg-proj-max-w-phone`:

```css
  --hg-proj-select-pad-phone: 0 28px 0 12px;
  --hg-proj-select-pad-tight: 0 8px;
```

In the `max-width: 1023px` block, `.hg-proj` gets `overflow: hidden` and the select `min-width: 0`:

```css
  /* The box shrinks to what the row leaves and the name ends inside it: the
     select must never reach over the buttons beside it. */
  .hg-proj { min-width: 0; padding: var(--hg-proj-pad-phone); overflow: hidden; }
  /* A name that is not a select: a block, so a long one ends in an ellipsis. */
  .hg-proj:not(.hg-proj-select) { display: block; line-height: calc(var(--hg-touch) - 2px); text-overflow: ellipsis; }
  .hg-proj-select { padding: 0; }
  .hg-proj-select select { min-width: 0; max-width: var(--hg-proj-max-w-phone); text-overflow: ellipsis; }
  .hg-proj-select select:focus-visible { outline-offset: -2px; }
```

After that block:

```css
/* Phones: the raven gives its place to the project name, then the caret, then the live dot. */
@media (max-width: 479px) {
  .hg-brand { display: none; }
  .hg-proj-select select { padding: var(--hg-proj-select-pad-phone); }
}
@media (max-width: 379px) {
  .hg-proj-select select { padding: var(--hg-proj-select-pad-tight); }
  .hg-proj-select svg { display: none; }
}
/* The dot is clipped, not removed: a screen reader still hears the status. */
@media (max-width: 359px) {
  .hg-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
}
```

## Verification

`npm run build`, `npm run test`, and the probe on a local preview at 320, 340, 360, 375, 390, 412, 430, 479, 480, 600, 767, 768, 1023 and 1024 px, projects metta and fastaust: no top bar button is covered, no sideways scroll, the list opens by a tap at 430 and 360. Nothing else needs checking by the implementer.

## Review

Opus review 2026-11-25, all Minor. Fixed: a single project name had no ellipsis, the dot came back too early (339, now 359), the dot was removed for screen readers. Rejected: the hidden brand text (neither heading nor link), WebKit on Windows cuts the select text without an ellipsis (existing, inside the box), the literal outline offset (stroke width exception).

Seen and left out: with an empty open search field the first tap below the bar is lost, because the search row closes on blur and the page moves under the finger.

Sonnet re-review of the fixes: clean. Fable final review: code clean, the CLAUDE.md line added. Rejected: "M…" at 320 px (the picker shows full names), and the 2 px taller select box and the dot halo, both on main before. Safari and iOS are not tested.
