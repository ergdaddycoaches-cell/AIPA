# AIPA library search: Xano backend notes

These are stub notes for wiring the homepage search to Xano. The front end already works without a backend: it uses embedded sample data and a local search function that returns exactly the response shape described below. When the Xano endpoint is live, you change one line and the page switches over.

## 1. Switching the page to Xano

In `goaipa-home.html`, find:

```js
var AIPA_CONFIG = { apiBase: '' };
```

Set `apiBase` to your API group's base URL, for example `https://x8ki-letl-twmt.n7.xano.io/api:AbCdEfGh`. The page will then call `GET {apiBase}/library/search`. If the request fails, the page falls back to the local search, so visitors never see a broken box.

Two things to know:

- **Test it on your own domain or locally.** The claude.ai prototype link blocks requests to outside servers, so the live Xano call will only work once the page is hosted on goaipa.com, or opened from your own machine.
- **Allow your domain in CORS.** In the API group's settings, allow requests from `https://goaipa.com` and `https://www.goaipa.com`, plus `http://localhost` while testing.

## 2. Tables

Seed files for the first three tables are in this folder (`sections-seed.csv`, `articles-seed.csv`, `synonyms-seed.csv`). Create the table, then import the CSV.

### `sections`
| Field | Type | Notes |
|---|---|---|
| id | int | auto |
| slug | text, unique | e.g. `bathrooms` |
| name | text | e.g. `Bathrooms` |
| sort_order | int | controls order of filter chips and index columns |

### `articles`
| Field | Type | Notes |
|---|---|---|
| id | int | auto |
| slug | text, unique | used in the URL |
| title | text | searched, highest weight |
| summary | text | one or two sentences, shown in results, searched |
| body | text (long) | full article; add to search later if titles and tags aren't enough |
| section_slug | text | matches `sections.slug` (or make it a table reference to `sections`) |
| section | text | display name; can be derived from the reference instead |
| tags | text | comma-separated words families actually use ("walk-in", "mom", "how much") |
| status | enum: `draft`, `published` | search returns `published` only |
| url | text | e.g. `/library/bathrooms/curbless-showers` |
| updated_at | timestamp | for "last reviewed" dates later |

Tags do most of the work. Write them in the family's words, not the contractor's: "walk-in shower" and "tub" as well as "curbless".

### `synonyms`
| Field | Type | Notes |
|---|---|---|
| id | int | auto |
| term | text | what someone types, lowercase: `walk-in shower`, `mom`, `how much` |
| maps_to | text | the library's word: `curbless`, `parent`, `cost` |

This table lets you fix bad searches without touching code: when people search "wet room" and get nothing, add a row.

### `search_log`
| Field | Type | Notes |
|---|---|---|
| id | int | auto |
| created_at | timestamp | |
| query | text | as typed, trimmed |
| section_filter | text, nullable | |
| result_count | int | |
| referrer | text, nullable | optional; useful to see which email or campaign sent them |

This is the most useful table during the pilot. A weekly list of searches that returned zero results is a list of articles to write next.

## 3. Endpoint: `GET /library/search`

Public, read-only, no authentication.

### Inputs
| Name | Type | Required | Notes |
|---|---|---|---|
| q | text | yes | trim it; if empty, return an empty result |
| section | text | no | a section slug to filter by |
| page | int | no | default 1 |
| per_page | int | no | default 20, max 50 |

### Logic (function stack, in order)
1. **Normalize** `q`: lowercase, strip punctuation, collapse spaces.
2. **Remove filler words**: the, and, how, much, what, my, a, to, is, and so on. The front end's list is a good start.
3. **Light stemming**: drop a trailing `s`, `es` or `ing` on words longer than four letters, so "bars" matches "bar".
4. **Expand synonyms**: look up any `synonyms.term` contained in the normalized query and collect the `maps_to` values. Return these as `expanded_terms` so the page can say "Also showing results for curbless."
5. **Find candidates**: query `articles` where `status = published`, matching any term or expanded term against `title`, `tags`, `summary` or `section`. Use case-insensitive contains, OR'd together.
6. **Score each candidate**, matching on the start of words so "how" doesn't match "show":
   - +5 for each term found in the title
   - +3 for each term found in the tags
   - +2 for each term found in the section name
   - +1 for each term found in the summary
   - +4, +3 or +1 for each expanded synonym found in the title, tags or summary
   - +6 if the whole query appears in the title
7. **Keep matches**: keep articles that matched every term, or any article at all if synonyms were expanded. If nothing survives, fall back to articles that match any term.
8. **Sort** by score, highest first.
9. **Count by section** before applying the `section` filter, so the filter chips can show how many results each section has.
10. **Apply** the `section` filter, then paginate.
11. **Log** the search to `search_log`, with the query and the result count before filtering.
12. **Return** the response below.

**Where to do the scoring.** At a few hundred articles, the simplest approach is to fetch all published articles in one query, then score them in a JavaScript Lambda step, or in a Xano loop if your plan doesn't include Lambda. It will be fast enough at this size. If the library grows into the thousands, look at a full-text search index on `title`, `tags` and `summary`, if your Xano plan and database support one.

### Response (the page depends on these field names)
```json
{
  "query": "walk-in shower",
  "expanded_terms": ["curbless"],
  "total": 6,
  "total_all_sections": 6,
  "section_counts": { "bathrooms": 4, "materials-lighting": 1, "home-value": 1 },
  "page": 1,
  "per_page": 20,
  "highlight_terms": ["walk-in", "shower", "curbless"],
  "items": [
    {
      "id": 1,
      "slug": "curbless-showers",
      "title": "Curbless showers: lowering the floor or raising the room",
      "summary": "The two ways to build a shower with no lip to step over, and how water is kept where it belongs.",
      "section": "Bathrooms",
      "section_slug": "bathrooms",
      "url": "/library/bathrooms/curbless-showers",
      "score": 17
    }
  ]
}
```

- `total` is the count after the section filter is applied.
- `total_all_sections` is the count before it. The "All sections" chip shows this number.
- `highlight_terms` are the words the page highlights in titles and summaries. Send the stemmed terms plus any expanded terms.

## 4. Other endpoints (later)

- `GET /library/sections` returns sections in `sort_order`, with a count of published articles in each. This lets the library index build itself instead of being hard-coded in the HTML.
- `GET /library/article/{slug}` returns one published article, for article pages.
- `GET /admin/search-report` is for you, not the public. It returns the top queries and zero-result queries for a date range. Put it in a separate API group that requires authentication.

## 5. Front-end behavior already built

- Results appear as you type, after a quarter-second pause. Pressing Enter also searches.
- When results are showing, the full library index is hidden. "Clear search" brings it back.
- Section filter chips show counts.
- Matching words are highlighted.
- A message says which synonyms were used.
- When nothing matches, the page suggests other searches and gives the phone number.
- The query is stored in the URL as `?q=`. Search links can be shared, and you can link straight to a search from an email, for example `goaipa.com/?q=cost`.
- Older requests are ignored if a newer one finishes first, so fast typing never shows stale results.
