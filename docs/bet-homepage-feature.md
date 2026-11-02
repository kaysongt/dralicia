# BET homepage feature

The homepage media feature sits immediately below the hero and before Services.
It reuses the site's existing portrait (`src/dralicia-g2.jpg`), yellow accent,
typography, buttons, and focus styles. No third-party artwork is copied, and no
video player or third-party script loads with the page.

## Editorial sources (checked November 2, 2026)

- [BET / Paramount press release](https://www.paramountpressexpress.com/bet/shows/nick-cannon-night/releases/?view=113396-bet-launches-nick-cannon-night-bringing-candid-conversation-to-late-night-premiering-tuesday-october-20): official show title, host, and Dr. Alicia Watkins' appearance with Natalie Nunn on October 27.
- [Apple TV episode listing](https://tv.apple.com/us/episode/natalie-nunn--dr-watkins-are-you-too-broke-to-date/umc.cmc.7hiwc52dpk0z7ofab9h33p3ne?showId=umc.cmc.7ilp9ckg7lyshld9lo1oxaxlq): Season 1, Episode 2, title, date, and discussion of dating, trust, and relationships.
- [Official series trailer](https://www.youtube.com/watch?v=rmPG7LjJ_CE): linked from BET's press release. The link is explicitly labeled **series trailer**, not Dr. Alicia's full episode.

The appearance does not imply BET endorses Dr. Alicia's services. Episode details
link to the listing rather than promising free playback or a particular provider.
Links use normal same-tab navigation so browser Back works without a custom modal.

## Verification

- `git diff --check`
- `node --test integrations/priority-list/priority-list.test.cjs` (existing suite)
- `python tests/test_bet_feature.py` (scoped homepage structure/content checks)

There is no application build step (see the repository README). GitHub's workflows
only deploy main; this draft branch does not deploy. Desktop/mobile browser visual
QA remains required: local Chromium could not start under the execution sandbox,
and the supported cloud browser could not reach the local preview server.

Manual review: check 320px, 390px, 768px and desktop widths; verify image/text stack
below 700px, button wrapping, keyboard focus, and both external destinations.
