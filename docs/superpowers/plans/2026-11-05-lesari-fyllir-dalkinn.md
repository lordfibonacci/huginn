# Lesari fyllir dálkinn (smáverk)

Heimir, 2026-11-05: "Þegar ég opna MD skrá er alltaf mikið autt bil hægra megin við textann, er ekki hægt að láta allt efnið fylla bilið?"

Orsök: tokenið `--hg-reader-measure: 68ch` (vinnubord.css, Reader hópurinn) og reglan `.hg-reader-body > .hg-markdown, .hg-reader-body > .hg-reader-text { max-width: var(--hg-reader-measure); }` kappa textann, töflur meðtaldar, við 68 stafi þótt lesaradálkurinn sé um 690 px.

## Stærðartafla

| Verk | Skrár | Stærð |
|---|---|---|
| 1. Token í none | src/vinnubord/vinnubord.css, CLAUDE.md | S |

## Verk 1

`src/vinnubord/vinnubord.css` lína 405, verbatim:

```css
  --hg-reader-measure: none;
```

CLAUDE.md, Design System, Reader hópurinn: `--hg-reader-measure` (none, so the text and tables fill the reader column; set a `ch` value to cap the line length).

Reglan á línu 1344 er óbreytt, svo Heimir kappar línulengdina aftur með því að setja `ch` gildi í tokenið.

Sannreyning: `npm run build` grænt, opna MD skrá í Skjöl flipanum á huginn.pro í vafra: textinn og töflurnar ná að hægri brún lesarans, Md hamurinn líka. Ekkert annað þarf að athuga.
