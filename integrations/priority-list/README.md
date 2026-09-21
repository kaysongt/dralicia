# Arizona priority-list backend

**Prepared, locally tested, and not deployed.** GitHub Pages cannot run this server code. Publishing the website alone does not create a Google Sheet, activate this endpoint, save submissions, or generate a real list count. A Google Workspace administrator must finish the separate setup below and verify an actual submission before announcing automated sign-up.

The website's `src/retreat-config.js` initially has an empty `priorityListEndpoint`. Until an endpoint is connected, the website offers an email request instead of claiming to save an entry. Sending that email is a visitor action. The retreat team must reconcile received requests manually; opening an email draft does not join the automated list. Establish the order of existing email requests before opening the automated list, to avoid assigning misleading priority.

## Set up in the retreat owner's Google account

1. Create a Google spreadsheet for the retreat. Keep general access **Restricted** and share it only with staff who need attendee information. Do not publish the Sheet or place its identifier in the website repository.
2. Create a standalone Apps Script project. Copy `Code.gs` into its editor. Enable the manifest in Project Settings and copy `appsscript.json` into the manifest. The project requests spreadsheet access; it neither reads nor sends email.
3. In **Project Settings → Script properties**, add:

   | Property | Value |
   | --- | --- |
   | `SPREADSHEET_ID` | The identifier of the private spreadsheet. Required. |
   | `EXPOSE_AGGREGATE_COUNT` | Set to `true` to enable the website's live interest tally. Without this value, the API returns `interestCount: null`. |
   | `MAX_REQUESTS_PER_HOUR` | Optional global hourly request limit; default `120`, allowed range `1`–`1000`. |

   `LAST_POSITION` is managed by the script after successful new entries. Do not reset it on an active list.
4. Run `setupPriorityList` once from the editor and authorize it as the retreat owner. It creates the `Arizona Priority List` tab and its headers. Existing incompatible headers cause a failure rather than silently overwriting information.
5. Choose **Deploy → New deployment → Web app**. Execute as the owner and allow access by **Anyone**, if the organization's Workspace policy allows public web apps. Keep the Sheet restricted; public access applies to the web app only. If public web apps are prohibited, use an approved form/backend service instead of relaxing the organization's controls.
6. Copy the deployed `/exec` URL into `retreatConfig.priorityListEndpoint` in `src/retreat-config.js` and publish the website update. Do not use the editor-only `/dev` URL. This endpoint URL is intentionally public; credentials and the Sheet ID must stay out of client code.
7. Complete the browser verification below before advertising the list. Updating Apps Script code later requires updating the web-app deployment to a new version.

## API contract

POST a `URLSearchParams` body with `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`. Use ordinary `fetch` with redirects enabled, `credentials: 'omit'`, and no custom authorization headers. Content Service redirects responses to a Google-owned content URL, so the browser must follow that redirect. Do not use `mode: 'no-cors'`: an opaque response cannot prove that a submission succeeded.

| Field | Requirement |
| --- | --- |
| `firstName` | Required, trimmed, maximum 80 characters. |
| `lastName` | Required, trimmed, maximum 80 characters. |
| `email` | Required, maximum 254 characters; trimmed and compared case-insensitively. |
| `website` | Empty honeypot field for normal visitors. |
| `consent` | Literal string `true`; records consent to Arizona retreat updates. |
| `requestId` | UUID v4, such as `crypto.randomUUID()`; retain it for retries of the same submission. |

The public success body is identical for new entries and existing email addresses:

```json
{ "ok": true, "capacity": 12 }
```

Do not interpret this response as a paid reservation, confirmed attendee place, available-room count, or promise that an email was sent. No emails are sent by this backend. Retrying an email preserves its original row and order; repeated input does not update the person's name or consent. A reused request ID belonging to another email is rejected.

Failures return an application-level JSON result. Inspect `ok`; an HTTP 200 response alone is insufficient:

```json
{ "ok": false, "error": "unavailable" }
```

Possible errors: `invalid_request`, `invalid_fields`, `busy`, `rate_limited`, and `unavailable`. Preserve form input on failures. Allow a retry with the same request ID for a timeout, `busy`, or `unavailable`. Ask visitors to try again later for `rate_limited`.

GET the same `/exec` endpoint with no personal parameters to obtain the optional tally:

```json
{ "ok": true, "capacity": 12, "interestCount": 13 }
```

If public counts are disabled, `interestCount` is `null`. Missing configuration returns `ok: false`. Fetch again after a successful POST, and render a tally only when `interestCount` is a non-negative integer. Use wording such as **13 people on the interest list · retreat limited to 12 guests**. Never derive “spots remaining” from `12 - interestCount`: interest is not payment or a reservation.

## Priority, privacy, and operations

- The private Sheet assigns sequential positions under a script-wide lock. The 13th entry is retained with position 13, and later entries continue to be accepted. Staff can use those positions to manage interest beyond the 12-person event capacity; no one is automatically declared sold out or booked.
- Individual positions, names, and email addresses are never returned by the public API. This prevents direct membership disclosure through distinct “already subscribed” responses. Publishing a precise total can still permit indirect inference when somebody repeatedly submits addresses while monitoring the count; leave `EXPOSE_AGGREGATE_COUNT` unset if that tradeoff is unacceptable.
- The script hashes normalized email addresses for internal deduplication. Hashes are not a substitute for keeping the Sheet private. Raw attendee details are retained only in the restricted Sheet, alongside the timestamp, position, consent version, and request ID.
- Spreadsheet text formatting and formula-prefix escaping protect user-supplied names and email addresses from becoming spreadsheet formulas. Treat exports as personal data too.
- Do not edit internal email hashes, request IDs, positions, or headers. Use normal row sorting if necessary; priority is based on stored positions rather than sheet row order. A removed entry no longer contributes to the interest count; the high-water mark prevents the next entry from reusing its old position. Handle erasure requests through the team's data-retention process.
- The honeypot, strict sizes, duplicate suppression, and global hourly cache counter provide basic abuse reduction. Apps Script does not provide a trustworthy client IP in this handler; the counter is global and its cache can be evicted early. It is not a strong bot defense or guaranteed rate limit. Monitor execution quotas and public abuse; place a verified bot challenge and enforced rate limits at an approved gateway if needed. Do not put secret tokens into the public site or treat the endpoint URL as a secret.
- The form collects contact information and consent only. Do not add health information, payment-card details, or Teachable checkout intake to this Sheet without separately reviewing the appropriate collection flow.
- Existing emailed requests require manual reconciliation. With documented consent, an administrator can submit them through the form in agreed priority order before public launch. Merely copying an email into a new Sheet row bypasses deduplication metadata and should be avoided.

## Verification

Local regression checks use Node's built-in test runner and mocked Apps Script services; no network, real spreadsheet, or email is involved:

```bash
node --test integrations/priority-list/priority-list.test.cjs
```

The checks cover duplicate emails and retries, the 13th entry, aggregate-only responses, unavailable locks, failure recovery, formula-like input, validation, honeypot behavior, request-ID collisions, global throttling, stable positions after a deletion, and missing configuration.

After deploying, use a **separate test spreadsheet and deployment** to verify real service behavior:

1. Open the website in a signed-out browser and submit a controlled test address. Confirm readable JSON after Google's redirect, one private row, and the success state on the website. If cross-origin access or Workspace policy blocks it, leave the website endpoint disabled until an approved working backend is available.
2. Retry with the same request ID and an uppercase variant of the email. Confirm one row and the same public response.
3. Submit 13 distinct controlled test addresses. Verify positions 1–13 and, when enabled, an interest count of 13. Confirm that the website never presents that count as reservations or remaining inventory.
4. Temporarily misconfigure the test endpoint or stop network access. Confirm the website retains the input and shows a useful retry/fallback message without claiming the data was saved.
5. Connect a clean production Sheet and complete one controlled end-to-end production check. Remove that test entry through the normal data process before launch; do not expose the Sheet or use real customers as test data.

Official references: [Apps Script web apps](https://developers.google.com/apps-script/guides/web), [Script Properties](https://developers.google.com/apps-script/guides/properties), [Content Service](https://developers.google.com/apps-script/guides/content), and [Lock Service](https://developers.google.com/apps-script/reference/lock/lock-service).
