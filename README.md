# CATME Survey Site

Peer and self evaluation survey for ENGR1000J at Global College. Students rate
everyone on their team, including themselves, on ten items, and get a PDF at the
end to hand in on Canvas.

No build step and no backend. Open `index.html` in a browser and it works. Nothing
is uploaded anywhere, the answers only ever live in the tab the student has open.

## Running it

Double click `index.html`, or serve the folder if you'd rather:

```bash
python -m http.server 8000
```

## Layout

```
index.html            five screens: welcome, details, team, survey, summary
styles.css
app.js                state, validation, scoring, PDF
assets/logo.png       shown in the page header
assets/logo-data.js   the same logo as base64, for the PDF
tools/                one script, for regenerating the above
vendor/               jsPDF and its autoTable plugin
```

## Changing the survey

The questions and the rating scale are the first two lists in `app.js`. Edit
`SURVEY_ITEMS` and the rest follows, nothing else counts the items. `SCALE` is the
1 to 7 scale, and `normaliseScore` is the `mean - 1` that maps a mean onto 0 to 6.

## Things to know

Names have to be in Latin letters. The fonts built into jsPDF have no Chinese
glyphs, so a name in characters comes out blank in the PDF. The form rejects them
with a message rather than letting someone find out afterwards.

Student IDs are checked against the 5xxxxxxxxxxx range.

The pie chart has eight colours and does not reuse them. A team bigger than that
folds the extra teammates into one grey slice, though the table above the chart
still lists everyone. The student themselves always keeps their own slice.

The PDF gets the logo from `assets/logo-data.js` rather than the PNG, because
browsers refuse to read an image back off a canvas when the page has been opened
straight from disk. So after replacing `assets/logo.png`:

```bash
python tools/make-logo-data.py
```

## Licence

MIT, see `LICENSE`.
