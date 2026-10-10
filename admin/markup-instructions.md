# How to mark up an Aging in Place Alliance guide

Write one plain-text file and nothing else. No Markdown, no commentary, no code fence around the file. The back office reads this file and fills a draft guide. Saving that draft builds the handout.

A tag is a whole line in square brackets. The copy for that tag is every line after it, until the next tag. A blank line does not end a block. Do not put anything before the first tag.

Use only the tags below. Any other line that is only a word in square brackets is an error and is skipped.

## The file, in this order

```
[title]
Where grab bars go, and what holds them up

[section]
Bathrooms

[summary]
Heights, placement by the toilet and shower, and why the wall behind matters more than the bar.

[tags]
grab bar, blocking, toilet, shower

[paragraph]
The bar is only as strong as the wall behind it.
^ Blocking has to be in the wall before the tile.

[headline]
By the toilet

[paragraph_image_left 3:2]
A bar beside the toilet, set so a seated person can reach it.

[paragraph_image_right]
The same idea, with the photo on the other side.

[bullets]
- One bar beside the toilet
- One bar behind ^ Optional, and easy to get wrong
- Not a towel bar
  ^ A towel bar will pull out of the wall.
```

`[title]`, `[section]`, and `[summary]` come first, once each. Then the body, in reading order. `[tags]` can sit with the other fields at the top.

## Tags

`[title]`
The article title. One line. This is the headline a reader sees under the title block. It is not the section name.

`[section]`
The library section this guide belongs to. Use one of these names, or the address after it:

- Bathrooms — `bathrooms`
- Entries and stairs — `entries-stairs`
- Kitchens and bedrooms — `kitchens-bedrooms`
- Materials and lighting — `materials-lighting`
- Costs and financing — `costs-financing`
- Codes, permits and HOAs — `codes-permits`
- Talking it through — `family`
- Home value — `home-value`

`[summary]`
One or two sentences. This is the library listing, and it is included in the reading-time count.

`[tags]`
Suggested search terms. Separate them with commas, or put one term on each line. Leave this tag out if there are none.

`[slug]`
Optional. The web address, such as `grab-bars`. Leave it out unless you were given an exact address. The office makes one from the title when this is blank.

`[headline]`
A subheading inside the article. One line. Use it to start a new part of the guide. Do not use it for the article title.

`[paragraph]`
Body copy. Line breaks inside the paragraph are kept. A blank line inside the paragraph is kept as a break.

`[paragraph_image_left]`
`[paragraph_image_right]`
The words that sit beside a photo. The photo is added later in the office, so do not invent a file name or a URL. You may set the crop on the same line as the tag:

- `[paragraph_image_left 3:2]` landscape, the usual shape
- `[paragraph_image_left 4:3]` landscape
- `[paragraph_image_left 1:1]` square
- `[paragraph_image_left 3:4]` portrait

If you leave the shape off, the office uses 3:2. Do not use any other ratio.

When the photo shows something the paragraph does not, add one description on its own line. Start that line with `@`. This is read aloud to someone who cannot see the photo. It is not printed, and it is not part of the reading time. Leave it out when the paragraph already describes the picture.

```
[paragraph_image_left 3:2]
The grab bar belongs in the stud, not just the tile.
@ A horizontal metal bar on the side wall of a shower, screwed into a wood stud.
```

One description per photo. If you write two, only the last one is kept. Do not start ordinary copy with `@`.

`[bullets]`
A list. Each item is its own line and starts with a dash and a space:

```
- First point
- Second point
```

## Footnotes

A footnote is optional. It is collected at the bottom of the guide and the handout. Mark it with a caret.

On a paragraph or a photo block, put the footnote on its own line under the copy:

```
[paragraph]
The bar is only as strong as the wall behind it.
^ Blocking has to be in the wall before the tile.
```

On a bullet, put it on that bullet's line, or on the next line:

```
- One bar behind ^ Optional, and easy to get wrong
- Not a towel bar
  ^ A towel bar will pull out of the wall.
```

One footnote per paragraph, photo, or bullet. If you write two, only the last one is kept. Do not start ordinary copy with a caret. If a block has no footnote, do not write a caret.

## Do not write these

The page and the handout add them.

- The Aging in Place Alliance name, the AIPA circle, and the section name in the title block
- A reading time. The office counts the summary, headlines, paragraphs, photo text, and bullets, divides by 200, and rounds. The title, footnotes, and photo descriptions are not counted. The shortest time is about 1 minute.
- The closing invitation to book a free Ask Anything 1:1
- The phone number, the QR code, or "Print this guide"
- A label such as `[footnote]`, `[image]`, `[caption]`, `[author]`, or `[reading_time]`

Do not wrap the file in a code fence. Do not explain the tags in the file. The file is the guide.
