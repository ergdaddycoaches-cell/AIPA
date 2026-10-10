# AIPA guide markup

Write each guide as plain text. Do not use Markdown headings, bold, or links. The back office reads the tags below and nothing else.

When a file holds more than one guide, put this on its own line between them:

```
[article]
```

That line is the only delimiter. A blank line before it and after it is fine. Do not put anything else on that line. Do not use `[article]` inside a guide. The first guide can start at `[title]` with no delimiter in front of it.

## A guide

Start with the fields, then the body. Each tag is on its own line. The copy for that tag follows on the next lines, until the next tag.

```
[title]
Where grab bars go

[section]
Bathrooms

[summary]
One or two sentences for the library list.

[slug]
grab-bars

[tags]
grab bars, toilet, suction cup

[headline]
Start with the wall, not the bar

[paragraph]
A bar holds a person only when it is screwed into the studs.
^ A suction cup pulls off a wet wall.

[paragraph_image_left 3:2]
The words that sit beside the photo.
@ A grab bar beside a toilet, screwed into the wall.

[bullets]
- First point
- Second point ^ A footnote for this point
```

`[slug]` and `[tags]` may be left out. If `[slug]` is left out, the office makes the web address from the title.

## Tags


| Tag                       | What it is                                                                     |
| ------------------------- | ------------------------------------------------------------------------------ |
| `[title]`                 | The guide title. One line.                                                     |
| `[section]`               | One of the section names below. One line.                                      |
| `[summary]`               | One or two sentences for the library list.                                     |
| `[slug]`                  | Optional web address. Lowercase words with hyphens.                            |
| `[tags]`                  | Optional search words. Separate them with commas.                              |
| `[headline]`              | A short heading inside the guide. One line.                                    |
| `[paragraph]`             | Body copy. It may run for several lines.                                       |
| `[paragraph_image_left]`  | Body copy with a photo on the left. The picture is added later in the office.  |
| `[paragraph_image_right]` | Body copy with a photo on the right. The picture is added later in the office. |
| `[bullets]`               | A list. Each item starts with a dash and a space.                              |


A photo tag may name a shape after the tag name: `[paragraph_image_left 3:2]`. The shapes are `3:2`, `4:3`, `1:1`, and `3:4`. If the shape is left off, the office uses `3:2`.

## Footnotes and photo descriptions

A footnote is a line that starts with `^` and a space. It belongs to the paragraph or bullet just above it. A bullet may instead put the footnote on the same line: `- The point ^ The footnote`. One footnote per paragraph. One footnote per bullet.

A photo description is a line that starts with `@` and a space, inside a photo block only. It says what the picture shows. It is read aloud and is not printed on the handout. One description per photo.

## Sections

Use one of these names, spelled this way:

- Bathrooms
- Entries and stairs
- Kitchens and bedrooms
- Home value
- Materials and lighting
- Costs and financing
- Codes, permits and HOAs
- Talking it through



## What to leave out

Do not include a picture file. The office crops the photo after import.

Do not write the phone number, the booking line, or a closing box. The handout adds those.

Do not use the word Topic. Do not call the reader a family. The group session is Live Q&A. The private meeting is Ask Anything 1:1.

## Several guides

```
[title]
Where grab bars go

[section]
Bathrooms

[summary]
A bar holds a person when it is screwed into the studs.

[paragraph]
Start with the wall, not the hardware.

[article]

[title]
A light for the path at night

[section]
Kitchens and bedrooms

[summary]
A low light from the bed to the bathroom prevents the half-asleep stumble.

[paragraph]
The light should show the floor without a bright overhead glare.
```

Save the file as plain text. In the back office, paste it or choose the file, then use **Save all as drafts**. Each guide stays off the site until it is published.