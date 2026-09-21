# Teachable checkout links (Costa Rica retreat)

Scraped 2026-09-20 from <https://escapewithdralicia.lovable.app/>, the current
Costa Rica retreat page. These are the live links behind that page's pricing
buttons, captured so the checkout flow can be rebuilt on this site.

All links share the base `https://coachingwithdralicia.teachable.com/purchase?product_id=`.

## Deposit / retainer

| Button | Product ID | Amount |
| --- | --- | --- |
| Pay $500 Retainer / Reserve Your Spot | `6607377` | $500 non-refundable retainer |

The same product backs every deposit button on the page (hero, mid-page, and footer).

## General Experience

| Button | Product ID | Price |
| --- | --- | --- |
| Pay In Full — Single Room | `6613894` | $5,200 |
| Pay In Full — Double Room | `6613896` | $7,600 ($3,600 per person) |
| Payment Plan — Single | `6611636` | $600/mo |
| Payment Plan — Double | `6611641` | $425.99/mo per person |

## VIP Experience

Adds welcome basket, Healing Haven course access, 6-month integration group,
a 45-minute 1:1 with Dr. Alicia, and the private catamaran sailing experience.

| Button | Product ID | Price |
| --- | --- | --- |
| Pay In Full — Single Room | `6613895` | $6,500 |
| Pay In Full — Double Room | `6613897` | $8,800 ($4,400 per person) |
| Payment Plan — Single | `6611639` | $759.99/mo |
| Payment Plan — Double | `6611644` | $499.99/mo per person |

Payment plans require the $500 retainer first and must be completed before the
retreat start date.

## Arizona

No Arizona products exist on that page. Every product above is Costa Rica
(December 17–21, 2026, Los Sueños Marriott). `retreatConfig.checkoutUrl` in
`src/retreat-config.js` stays empty until Arizona products are created in
Teachable and their checkout tested.

## Verification note

Product IDs and prices are taken from the page's own markup and button labels.
Nothing here was confirmed against the Teachable dashboard — `checkout.teachable.com`
sits behind a bot check. Confirm each product ID resolves to the intended item
and price before pointing live buttons at it.
