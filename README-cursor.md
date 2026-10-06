# goaipa.com: handoff notes for Cursor

A static site, plain HTML, CSS and JavaScript, with no build step. Library search is ready to switch from local JSON to Xano.

## Run it locally
The pages use root-relative paths like `/assets/...`, so serve the folder rather than opening the files directly:

```
cd site && python3 -m http.server 8000
```

Then open http://localhost:8000.

## Structure
```
index.html                      Home
library/index.html              Full library index and search
library/<section>/index.html    8 section pages
standards/index.html            Full standards table, ADA 2010 and ANSI A326.3 references
glossary/index.html             27 terms, A–Z, each linked to a guide
tools/index.html                4 tools, all marked "In development"
assets/css/site.css             All styles; colors are tokens on :root, with a dark mode
assets/js/config.js             AIPA_CONFIG.apiBase: empty = local JSON, set = Xano
assets/js/search.js             Shared search for home, library and section pages
assets/data/library.json        Sections, 39 articles and synonyms (same data as the Xano seeds)
xano/                           Endpoint contract and CSV seeds
```

Section slugs: `bathrooms`, `entries-stairs`, `kitchens-bedrooms`, `materials-lighting`, `costs-financing`, `codes-permits`, `family`, `home-value`.

## Switching search to Xano
1. Build the tables and `GET /library/search` as described in `xano/xano-search-notes.md`, and import the CSV seeds.
2. In the Xano API group's settings, allow CORS requests from goaipa.com.
3. Set `apiBase` in `assets/js/config.js`.

The response shape must match the contract exactly. `search.js` reads these fields: `query`, `expanded_terms`, `total`, `total_all_sections`, `section_counts`, `highlight_terms`, and `items[]` (each with `title`, `summary`, `section`, `section_slug` and `url`).

If the API errors, search falls back to the local JSON automatically.

### Search hooks in the HTML
- `#q` is the search input, inside a `<form>`.
- `#results` is the results panel. `data-section="slug"` scopes search to one section, which is how the section pages work.
- `#libgrid` is the content that's hidden while results are showing.
- `data-scrollto` on the form says where to scroll after submit.
- `[data-q]` buttons run a preset search.
- `?q=` in the URL runs that search when the page loads.

## What's hard-coded now and should come from Xano later
- **Guide lists.** The lists on home, library and section pages are generated into the HTML from `library.json`. Replace them with `GET /library/sections` and articles by section, or with a static-site build that reads from Xano.
- **Section-page copy.** The intro, "Numbers worth knowing", "Questions families ask here" and related sections are hard-coded per section. A `section_content` table, or extra fields on `sections`, would hold them.
- **Glossary and standards.** Both are hard-coded. They're good candidates for `glossary_terms` and `standards` tables if they'll be edited often.

## Placeholders to replace before launch
- **FPO image blocks.** Each block describes the photo it needs.
- **FPO logo strip** on the homepage (credentials and education). Only use logos for credentials the team actually holds.
- **"Last reviewed [FPO date]"** on section pages.
- **Guide quotes and names** on the homepage.
- **Article pages.** Every guide links to `/library/<section>/<slug>`, but no article template exists yet, so these links return 404.
- **Webinar signup.** It's call or email only for now.
- **hello@goaipa.com** needs confirming.

## Notes
- **Fonts.** Newsreader and Source Sans 3 load from Google Fonts. Self-host them if you'd rather not depend on Google.
- **Accessibility.** Body text is 20px, touch targets are at least 56px, focus outlines are visible, there's a skip link, and the search status is announced to screen readers. Keep all of this as components are refactored.
