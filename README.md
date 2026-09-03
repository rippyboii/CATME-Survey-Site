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
assets/header.png     the banner, shown on the page and in the PDF
assets/header-data.js the same banner as base64, for the PDF
tools/                one script, for regenerating the above
vendor/               jsPDF and its autoTable plugin
```

## The questions

`ITEM_BANK` at the top of `app.js` holds the item bank from Loughry, Ohland and
Moore (2007), all ninety items across the five categories the paper identifies.
Each sitting draws its own ten questions: three from contributing to the team's
work, three from interacting with teammates, two from keeping the team on track,
one from expecting quality, one from having relevant knowledge and skills. The
`pick` on each category is where those numbers live.

A draw is fixed once the page loads, so going back to an earlier question shows
the same wording. Reloading draws again.

`SCALE` below it is the 1 to 7 scale.

## Things to know

Names have to be in Latin letters. The fonts built into jsPDF have no Chinese
glyphs, so a name in characters comes out blank in the PDF. The form rejects them
with a message rather than letting someone find out afterwards.

Student IDs are checked against the 5xxxxxxxxxxx range.

Because the questions are drawn per sitting, two students on the same team will
usually answer different items. The scores stay comparable, the wording does not.

The pie chart has eight colours and does not reuse them. A team bigger than that
folds the extra teammates into one grey slice, though the table above the chart
still lists everyone. The student themselves always keeps their own slice.

The PDF gets the banner from `assets/header-data.js` rather than the PNG, because
browsers refuse to read an image back off a canvas when the page has been opened
straight from disk. So after replacing `assets/header.png`:

```bash
python tools/make-header-data.py
```

## Licence

MIT, see `LICENSE`.
