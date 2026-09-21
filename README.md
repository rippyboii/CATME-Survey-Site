# CATME Survey Site

Peer and self evaluation survey for ENGR1000J at Global College. Students rate each member of their team, including themselves, on ten items. At the end they download a PDF to submit on Canvas.

There is no build step and no backend. All answers stay in the browser and nothing is uploaded.

## Running

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

## Files

```
index.html             welcome, details, team, survey and summary screens
styles.css
app.js                 state, validation, scoring, PDF export
assets/header.png      banner image
assets/header-data.js  banner as base64, used in the PDF
tools/                 script to regenerate header-data.js
vendor/                jsPDF and jsPDF-AutoTable
```

## Questions

`ITEM_BANK` in `app.js` contains the full item bank from Loughry, Ohland and Moore (2007), grouped into five categories. Each session draws ten questions:

| Category | Items |
|---|---|
| Contributing to the team's work | 3 |
| Interacting with teammates | 3 |
| Keeping the team on track | 2 |
| Expecting quality | 1 |
| Having relevant knowledge, skills and abilities | 1 |

The count for each category is set by its `pick` value. Questions are drawn once per page load, so going back shows the same wording. Reloading the page draws a new set.

`SCALE` defines the 1 to 7 rating scale.

## Notes

- Names must use Latin characters. jsPDF's built-in fonts have no Chinese glyphs, so the form rejects them.
- Student IDs must start with 5 and follow the 5xxxxxxxxxxx format.
- Students on the same team will usually see different questions. Scores are still comparable.
- The pie chart uses eight colours. Extra teammates are grouped into one grey slice, but the table lists everyone. The student's own slice is always shown separately.
- The PDF uses `assets/header-data.js` instead of the PNG, because browsers block reading images from a canvas when the page is opened from disk. After replacing `assets/header.png`, run:

```bash
python tools/make-header-data.py
```

## References

Loughry, M. L., Ohland, M. W., & Moore, D. D. (2007). Development of a theory-based assessment of team member effectiveness. *Educational and Psychological Measurement, 67*(3), 505-524. https://doi.org/10.1177/0013164406292085

## Licence

MIT. See `LICENSE`.
