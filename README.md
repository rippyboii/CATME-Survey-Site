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
| `assets/` | the logo, plus a base64 copy of it for the PDF |
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
- [x] copyright footer on every screen and every PDF page
- [x] logo header on the page and on every PDF page
- [x] plain comments throughout

## Notes

- Names must be typed in Latin letters. jsPDF's built-in fonts cannot draw Chinese
  characters, so a CJK name would come out blank in the PDF. Lifting this means
  embedding a CJK subset font.
- The pie uses a fixed eight-colour order. A team larger than eight folds its tail
  into a single 'Other' slice rather than repeating a colour; the table above the
  chart still lists every member separately.

## Replacing the logo

`assets/logo.png` is what the page header shows. The PDF cannot read it back off a
canvas when the page is opened straight from disk, so a base64 copy lives in
`assets/logo-data.js`. After swapping the PNG, regenerate that file:

```bash
python -c "
import io, base64
from PIL import Image
src = Image.open('assets/logo.png').convert('RGBA').resize((160, 160), Image.LANCZOS)
flat = Image.new('RGB', src.size, (255, 255, 255))
flat.paste(src, mask=src.split()[3])
buf = io.BytesIO(); flat.quantize(colors=16).save(buf, format='PNG', optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
io.open('assets/logo-data.js','w').write(\"window.LOGO_PNG = 'data:image/png;base64,\" + b64 + \"';\n\")
"
```
