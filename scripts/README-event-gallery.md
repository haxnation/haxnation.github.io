# Event photo galleries

Each event can show a slideshow of photos from LinkedIn instead of its Luma poster.
Photos are matched to events by the **Luma short code** from the event's `luma_url`.

## How posts are matched

Put the Luma short code in a LinkedIn post on the
[Haxnation Meetups Mumbai showcase](https://www.linkedin.com/showcase/haxnation-meetups-mumbai/),
for example:

```
Recap of our November meet-up #w9n0h2dc
```

A plain `https://luma.com/w9n0h2dc` link in the post works too. Both forms are recognised.

Any photos attached to that post are stored as LinkedIn image URLs in
`mumbai-chapter/event-gallery.json`, keyed by the short code. Nothing is downloaded into the
repo — the weekly Action refreshes the links so the signed URLs stay valid.

## Old posts / manual entries

The public showcase feed only exposes about 70 recent posts. For older posts, add their
image URLs to `scripts/event-gallery.manual.json` (this file is merged with scraped results,
and manually added images are shown first):

```json
{
  "w9n0h2dc": [
    {
      "url": "https://media.licdn.com/dms/image/v2/...",
      "post": "https://www.linkedin.com/posts/..."
    },
    "https://media.licdn.com/dms/image/v2/..."
  ]
}
```

## Running locally

```bash
cd scripts
npm install
npx playwright install chromium
npm run update-event-gallery
```

`update-event-gallery.yml` runs the same job on a schedule and on demand.
