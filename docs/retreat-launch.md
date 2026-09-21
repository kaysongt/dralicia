# Arizona retreat launch status

## Website update

- Permanent homepage Arizona banner; both retreat editions are accessible on mobile and desktop.
- Arizona details and priority-list URL: https://draliciawatkins.com/arizona-retreat.html#priority-list
- Arizona price: USD 5,795, one-time. Event capacity: 12 guests. Retreat dates remain unannounced.
- Existing Costa Rica dates, pricing, reservation links, appointment embeds, and shopping integrations are preserved.
- Both pages link to https://cozydigital.org.
- CIVANA in Carefree is the likely intended venue described as “Savannah” in the supplied notes, because its official meeting-space list includes Black Mountain Casita. Confirm the spelling and booked venue with the client. No package inclusions or exact retreat dates were invented.

## Current signup behavior — email request

The first/last-name/email form prepares an email addressed to the retreat contact already published on the site. The visitor must open and send the draft; no email is sent automatically, and no successful signup or saved position is claimed. The website does not collect contact data in analytics, query strings, browser storage, or GitHub.

Automated saving and a real interest tally are **not activated**. See `integrations/priority-list/README.md` for the prepared private Google Sheets/Apps Script backend. Before promoting automated signup, deploy it, reconcile prior email requests, configure `priorityListEndpoint` in `src/retreat-config.js`, and verify a submission end to end. Never subtract interest-list entries from the 12 paid spaces.

## Teachable — not configured in this update

The connected browser's Teachable sign-in remained on Cloudflare security verification. No course, billing, enrollment, or payment settings were changed; no new checkout URL was obtained.

1. Duplicate the existing Costa Rica course through Courses → product menu → Duplicate. Name it **Arizona Wellness Retreat**. Replace Costa Rica content and dates; review copied files, curriculum, and notifications before publishing.
2. Create one USD **5,795 one-time purchase** pricing plan. Configure its enrollment cap to **12** and enable the remaining-enrollment display. If adding additional plans, coordinate their caps so combined sales cannot exceed 12. A plan cap is not a school-wide inventory cap.
3. Identify the school's payment gateway. Legacy Teachable Pay uses Settings → Payments and BackOffice for BNPL. New Teachable Payments uses Sales → Payment Settings → Payment Methods; expanded methods depend on the Global bundle. Do not activate a paid add-on without checking its cost with the owner.
4. Check Klarna eligibility. Do not promise Afterpay on this $5,795 purchase: the documented limits are below this price. Available financing is customer- and gateway-dependent.
5. Inspect actual checkout capabilities. Current official documentation marks custom checkout fields as **coming soon**, rather than generally available. Do not claim custom room/package intake has been added directly to billing. If unavailable, agree a supported pre-checkout intake flow and link records with the same purchase email.
6. Proposed intake fields, to confirm against actual packages: attendee full name; purchase email; package preference; room preference; roommate name if applicable; additional attendee name(s) if multiple attendees are permitted. Do not invent room categories or sell additional attendees without capacity handling.
7. Copy the new pricing-plan checkout URL. Verify product name, USD 5,795 total before any disclosed taxes, cap, intake, and payment methods. Do not make a real purchase as a test without authorization.
8. Add the verified school checkout URL to `checkoutUrl` in `src/retreat-config.js`. It enables the Arizona booking button; it never alters Costa Rica links.

## Official references checked September 21, 2026

- [CIVANA meetings and Black Mountain Casita](https://www.civanacarefree.com/meetings/)
- [Duplicate a Teachable product](https://support.teachable.com/en/articles/11682483-duplicate-or-delete-a-product)
- [Pricing plans and checkout links](https://support.teachable.com/en/articles/11682476-price-your-products)
- [Enrollment caps](https://support.teachable.com/en/articles/11682481-enrollment-caps)
- [Legacy gateway BNPL limits](https://support.teachable.com/en/articles/11682551-buy-now-pay-later)
- [New gateway payment methods](https://support.teachable.com/en/articles/15627345-available-payment-methods-adaptive-pricing)
- [Checkout customization and planned custom fields](https://support.teachable.com/en/articles/15646496-customize-your-checkout-page)

## Verification

Backend tests run with `node --test integrations/priority-list/priority-list.test.cjs`. These use mocked Apps Script services and do not prove deployment, production email delivery, live form capture, Teachable checkout, or remaining-seat inventory. These external integrations need their own account-backed verification.
