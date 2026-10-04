# Fonts

CORP Realm uses one typeface, **Thmanyah Sans**, for Arabic, Latin and numerals,
as set in the CorpLift visual identity guide.

The font is free, but its licence does not allow the files to be redistributed,
so they are not kept in this repository. To get the real typeface in the app:

1. Download Thmanyah Sans from <https://font.thmanyah.com>.
2. Put these four files in this folder:

   | File | Weight | Used for |
   |---|---|---|
   | `thmanyahsans-Regular.woff2` | 400 | Text |
   | `thmanyahsans-Medium.woff2` | 500 | Labels and badges |
   | `thmanyahsans-Bold.woff2` | 700 | Card titles, buttons, figures |
   | `thmanyahsans-Black.woff2` | 900 | Headings |

If the download names the files differently, rename them to match, or change
the paths at the top of `src/index.css`. The Light weight is not used.

Until the files are here, the app falls back to the system font.
