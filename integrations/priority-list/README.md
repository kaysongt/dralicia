# Arizona priority-list backend

**Prepared and locally tested; it goes live only after someone deploys it from a Google account.** GitHub Pages cannot run server code, so until the steps below are done the website's form falls back to opening a pre-filled email to the retreat team.

Once deployed, every signup:

1. is saved to a private Google Sheet and shows up on its **Signups** tab (#, first name, last name, email, signup date and time, plus a running total), and
2. emails **yaya@coachingwithdralicia.org** and **yasmeen@coachingwithdralicia.com** (subject: *"Maya Rivers joined the Desert BLOOM priority list (#1)"*) with the person's email, list number, signup time in the Sheet's time zone, and a link to the **Signups** tab. Hitting Reply writes straight back to the person who signed up. A silent BCC copy goes to **qmac@cozydigital.org** for the record. Each email is about 1 KB.

## Set up (about 10 minutes, in the Google account that should own the list)

1. **Create the Sheet.** In Google Drive, create a new Google Sheet named, for example, *Desert BLOOM Priority List*. Keep sharing **Restricted** and share it only with staff who need it (for example Yaya). Never make it public.
2. **Open Apps Script from the Sheet.** In the Sheet choose **Extensions → Apps Script**. Delete the starter code and paste in all of `Code.gs`.
3. **Add the manifest.** Click the gear (**Project Settings**), tick **Show "appsscript.json" manifest file in editor**, go back to the editor, open `appsscript.json`, and replace its contents with this repo's `appsscript.json`.
4. **Run setup once.** In the editor's function dropdown pick `setupPriorityList` and click **Run**. Approve the permission prompt (Google will show "unverified app" for your own script: choose *Advanced → Go to project*). It creates two tabs: **Signups**, the easy-to-read list for the team, and **Arizona Priority List**, the technical record the script uses for duplicate checks, which it hides. It also removes the empty default "Sheet1". The permissions are: edit spreadsheets, and send email as you.
5. **Deploy.** Click **Deploy → New deployment**, choose type **Web app**, set *Execute as* **Me** and *Who has access* **Anyone**, then **Deploy**. Copy the **Web app URL** that ends in `/exec` (not a `/dev` URL).
6. **Connect the website.** *(Done: the live deployment URL is set in `arizona-retreat.html`.)* Paste that URL into `priorityListEndpoint` in the inline `config` near the bottom of `arizona-retreat.html` (that is the copy the live page uses; mirror it in `src/retreat-config.js`). Commit and publish. The form then says **Join the Priority List** instead of offering an email draft.
7. **Test once.** On the live page, sign up with a test name and your own email. Check that a row appears in the Sheet and that Yaya receives the email. Then delete the test row.

If Code.gs changes later: paste the new code, save, run `setupPriorityList` again (safe to repeat; it rebuilds the **Signups** tab and never touches saved signups), then use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** so the same `/exec` URL keeps working.

### Reading and editing the list

- Read signups on the **Signups** tab. It updates by itself and is sorted by list position; times are shown in the Sheet's time zone (**File → Settings**). It is protected with a warning so nobody overwrites its formula by accident.
- To remove someone, unhide the technical tab (**View → Hidden sheets → Arizona Priority List**), delete their row there, and hide it again. Don't edit its headers or the `email_sha256`, `request_id` or `list_position` columns.

### Optional script properties

Set these under **Project Settings → Script properties**. None are required when the script is opened from the Sheet as above.

| Property | Value |
| --- | --- |
| `NOTIFY_EMAIL` | Who gets the signup emails. Defaults to `yaya@coachingwithdralicia.org, yasmeen@coachingwithdralicia.com`. Comma-separate several addresses, or set `off` to stop emails. |
| `COPY_EMAIL` | Silent BCC copy of every signup email. Defaults to `qmac@cozydigital.org`; set `off` to stop it. |
| `SPREADSHEET_ID` | Only for a standalone script that is *not* opened from the Sheet: the ID of the private Sheet. Never put it in the website repository. |
| `EXPOSE_AGGREGATE_COUNT` | `true` shows "N people have joined the interest list" on the page. Off by default. |
| `MAX_REQUESTS_PER_HOUR` | Global hourly request limit; default `120`, allowed `1`–`1000`. |

`LAST_POSITION` is managed by the script after successful new entries. Do not reset it on an active list.

Email uses the owning account's Apps Script quota, counted per recipient (about 100 a day on a free Gmail account, 1,500 on Google Workspace). With three recipients per signup that is roughly 33 signups a day on free Gmail. If the quota runs out the signup is still saved; only the email is skipped.

To keep the copies out of an inbox, create a Gmail filter: search `subject:("joined the Desert BLOOM priority list")`, choose **Create filter**, tick **Skip the Inbox** and **Apply the label** (for example *Desert BLOOM signups*).

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

Do not interpret this response as a paid reservation, confirmed attendee place, or available-room count. New entries trigger a best-effort notification email to the retreat team; the response does not confirm it was delivered, and no email is sent to the visitor. Retrying an email preserves its original row and order; repeated input does not update the person's name or consent. A reused request ID belonging to another email is rejected.

Failures return an application-level JSON result. Inspect `ok`; an HTTP 200 response alone is insufficient:

```json
{ "ok": false, "error": "unavailable" }
```

Possible errors: `invalid_request`, `invalid_fields`, `busy`, `rate_limited`, and `unavailable`. Preserve form input on failures. Allow a retry with the same request ID for a timeout, `busy`, or `unavailable`. Ask visitors to try again later for `rate_limited`.

GET the same `/exec` endpoint with no personal parameters to obtain the optional tally:

```json
{ "ok": true, "capacity": 12, "interestCount": 13 }
```

If public counts are disabled, `interestCount` is `null`. Missing configuration returns `ok: false`. Fetch again after a successful POST, and render a tally only when `interestCount` is a non-negative integer. Use wording such as **13 people have joined the interest list**. Never derive “spots remaining” from `12 - interestCount`: interest is not payment or a reservation.

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
