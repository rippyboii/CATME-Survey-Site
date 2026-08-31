# CATME-Survey-Site

A single-page peer and self evaluation survey for ENGR1000J. Plain HTML, CSS and
JS, no build step and no server: open `index.html` and it runs. Nothing is sent
anywhere, and the student ends up with a PDF to hand in on Canvas.

## Files

| File | What it holds |
|------|---------------|
| `index.html` | the five screens: welcome, details, team members, survey, summary |
| `styles.css` | all styling |
| `app.js` | state, screen router, validation, scoring, PDF export |
| `vendor/` | jsPDF 2.5.1 + autoTable 3.8.4, vendored so the site works offline |

## Editing the survey

Both lists live at the top of `app.js`:

- `SURVEY_ITEMS` - the survey questions. Currently placeholder wording. Add or
  remove entries freely; the count is not hardcoded anywhere else.
- `SCALE` - the 1 to 7 rating scale.
- `normaliseScore` - how a mean becomes the normalised score (currently `mean - 1`,
  which maps a 1 to 7 mean onto 0 to 6).

## Done

- [x] 'I understand' checkbox on the welcome page, gating the Start button
- [x] name, student ID, team ID and team size are all required, with markers
- [x] student ID must be a number above 500000000000 and below 600000000000
- [x] NA removed from the survey table and the summary
- [x] pie chart of each member's share of the work, on the summary page and in the PDF
- [x] PDF file name is `COURSE_TEAM ID_STUDENT ID_STUDENT NAME.pdf`
- [x] no em dashes anywhere in the code base

## Notes

- Names must be typed in Latin letters. jsPDF's built-in fonts cannot draw Chinese
  characters, so a CJK name would come out blank in the PDF. Lifting this means
  embedding a CJK subset font.
- The pie uses a fixed eight-colour order. A team larger than eight folds its tail
  into a single 'Other' slice rather than repeating a colour; the table above the
  chart still lists every member separately.


TODO:
