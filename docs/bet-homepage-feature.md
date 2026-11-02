# BET hero feature

The television credentials are the **first content inside the top hero panel**,
before the headline and booking buttons. There is no duplicate below-the-fold
feature. The official BET and Nick Cannon @ Night marks identify the verified
appearance; the compact link opens the episode listing. Dr. Alicia's original
hero portrait, primary consultation CTA, services CTA, and retreat link remain.

Responsive rules reduce logo dimensions and top padding on mobile while keeping
both marks visible ahead of the hero headline. The logos are not lazy loaded.
The feature adds no JavaScript, third-party embeds, or autoplay.

## Editorial sources (checked November 2, 2026)

- [BET / Paramount press release](https://www.paramountpressexpress.com/bet/shows/nick-cannon-night/releases/?view=113396-bet-launches-nick-cannon-night-bringing-candid-conversation-to-late-night-premiering-tuesday-october-20): official show title, host, and Dr. Alicia Watkins' appearance with Natalie Nunn on October 27.
- [Apple TV episode listing](https://tv.apple.com/us/episode/natalie-nunn--dr-watkins-are-you-too-broke-to-date/umc.cmc.7hiwc52dpk0z7ofab9h33p3ne?showId=umc.cmc.7ilp9ckg7lyshld9lo1oxaxlq): Season 1, Episode 2, title, date, and discussion of dating, trust, and relationships.

The appearance does not imply BET endorses Dr. Alicia's services. The show is
identified by its verified title, not described as a podcast. Episode details
link to the listing rather than promising free playback or a particular provider.
The link uses normal same-tab navigation and browser Back.

## Logo provenance

See `src/media/README.md` for exact official source URLs and asset treatment.
Marks are used only to identify Dr. Alicia's verified guest appearance, at the
site owner's explicit request; no sponsorship or endorsement is asserted.

## Verification

- `git diff --check`
- `node --test integrations/priority-list/priority-list.test.cjs` (existing suite)
- `python tests/test_bet_feature.py` (scoped homepage structure/content checks)

There is no application build step (see repository README). GitHub's workflows
only deploy main; this draft branch does not deploy. Desktop/mobile browser visual
QA remains required: local Chromium could not start under the execution sandbox,
and the supported cloud browser could not reach the local preview server.

Manual review: check 320px, 390px, 768px and desktop widths; confirm both logos
appear at the top of the hero without scrolling, preserve aspect ratio and contrast,
and check the episode link, booking CTA, keyboard focus, and browser Back.
