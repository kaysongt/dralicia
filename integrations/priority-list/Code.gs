/**
 * Arizona retreat interest list. Deploy as a Google Apps Script web app, ideally
 * from Extensions → Apps Script inside the private Sheet it should write to.
 * This file contains no deployment, spreadsheet identifier, or credentials.
 * Read README.md before deploying. All attendee data remains in a private Sheet.
 */
var CAPACITY = 12;
var SHEET_NAME = 'Arizona Priority List';
// Friendly, read-only tab for the retreat team; rebuilt by setupPriorityList.
var VIEW_NAME = 'Signups';
var DATE_FORMAT = 'mmm d, yyyy h:mm am/pm';
// Who is emailed about each new signup. Override with the NOTIFY_EMAIL script
// property (comma-separate several addresses); set it to "off" to disable.
var DEFAULT_NOTIFY_EMAIL = 'yaya@coachingwithdralicia.org, yasmeen@coachingwithdralicia.com';
// Silent BCC copy of every signup email, kept out of the team's Reply threads.
// Override with the COPY_EMAIL script property; set it to "off" to disable.
var DEFAULT_COPY_EMAIL = 'qmac@cozydigital.org';
var HEADERS = [
  'joined_at_utc', 'first_name', 'last_name', 'email', 'email_sha256',
  'request_id', 'list_position', 'consent', 'consent_version'
];

/** Run once in the Apps Script editor to create the tab and authorize access. */
function setupPriorityList() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var workbook = workbook_(PropertiesService.getScriptProperties());
    var sheet = workbook.getSheetByName(SHEET_NAME) || workbook.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
    validateHeaders_(sheet);
    buildSignupsView_(workbook, sheet);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Builds the "Signups" tab: #, name, email and signup time in plain language,
 * sorted by list position and updated automatically by formula. The technical
 * tab is hidden (not deleted): duplicate checks and positions depend on it.
 */
function buildSignupsView_(workbook, raw) {
  var view = workbook.getSheetByName(VIEW_NAME) || workbook.insertSheet(VIEW_NAME, 0);
  view.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { p.remove(); });
  view.clear();
  var src = "'" + SHEET_NAME + "'!";
  var signedUp = 'IF(ISNUMBER(' + src + 'A2:A), ' + src + 'A2:A, IFERROR(DATEVALUE(LEFT(' + src +
    'A2:A, 10)) + TIMEVALUE(MID(' + src + 'A2:A, 12, 8)), ' + src + 'A2:A))';
  view.getRange(1, 1, 1, 6).setValues([['#', 'First name', 'Last name', 'Email', 'Signed up', 'Total signups']]);
  view.getRange(2, 1).setFormula('=ARRAYFORMULA(IFERROR(SORT(FILTER({' + src + 'G2:G*1, ' + src + 'B2:B, ' +
    src + 'C2:C, ' + src + 'D2:D, ' + signedUp + '}, ' + src + 'D2:D <> ""), 1, TRUE), ))');
  view.getRange(2, 6).setFormula('=COUNTA(D2:D)');
  view.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#f5c518').setFontColor('#1a1810');
  view.getRange(2, 5, 999, 1).setNumberFormat(DATE_FORMAT);
  view.getRange(2, 1, 999, 1).setHorizontalAlignment('left');
  view.getRange(2, 6).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  view.setFrozenRows(1);
  [50, 150, 150, 260, 190, 110].forEach(function (width, i) { view.setColumnWidth(i + 1, width); });
  view.protect().setDescription('Filled in automatically from new website signups. Edit the hidden "' +
    SHEET_NAME + '" tab only if you need to remove someone.').setWarningOnly(true);
  workbook.setActiveSheet(view);
  workbook.moveActiveSheet(1);
  raw.hideSheet();
  // A brand-new spreadsheet starts with an empty "Sheet1"; remove it to avoid confusion.
  var blank = workbook.getSheetByName('Sheet1');
  if (blank && blank.getSheetId() !== raw.getSheetId() && blank.getSheetId() !== view.getSheetId() &&
      blank.getLastRow() === 0 && blank.getLastColumn() === 0) {
    workbook.deleteSheet(blank);
  }
}

/** Public GET exposes only an optional aggregate; never addresses or positions. */
function doGet() {
  try {
    var properties = PropertiesService.getScriptProperties();
    var sheet = configuredSheet_(properties);
    if (properties.getProperty('EXPOSE_AGGREGATE_COUNT') !== 'true') {
      return json_({ ok: true, capacity: CAPACITY, interestCount: null });
    }
    var rows = readRows_(sheet);
    var uniqueEmails = {};
    rows.forEach(function (row) {
      if (row[4]) uniqueEmails[String(row[4])] = true;
    });
    return json_({ ok: true, capacity: CAPACITY, interestCount: Object.keys(uniqueEmails).length });
  } catch (error) {
    return failure_('unavailable');
  }
}

/** Accept a simple, URL-encoded cross-origin POST. Never send JSONP or PII in GET. */
function doPost(event) {
  var lock;
  var locked = false;
  try {
    if (!event || !event.postData ||
        String(event.postData.type || '').split(';')[0] !== 'application/x-www-form-urlencoded' ||
        Number(event.postData.length || 0) > 4096) {
      return failure_('invalid_request');
    }
    var fields = event.parameter || {};
    // Silent bot discard must never become a real row or increase the count.
    if (String(fields.website || '').trim()) return success_();
    var attendee = validateAttendee_(fields);
    if (!attendee) return failure_('invalid_fields');

    lock = LockService.getScriptLock();
    locked = lock.tryLock(10000);
    if (!locked) return failure_('busy');

    var properties = PropertiesService.getScriptProperties();
    var sheet = configuredSheet_(properties);
    if (!withinRateLimit_(properties)) return failure_('rate_limited');
    var rows = readRows_(sheet);
    var emailHash = sha256_(attendee.email);
    var duplicate = false;
    var maximumPosition = Number(properties.getProperty('LAST_POSITION')) || 0;

    for (var index = 0; index < rows.length; index++) {
      var row = rows[index];
      maximumPosition = Math.max(maximumPosition, Number(row[6]) || 0);
      // A request ID cannot be reused to change the person associated with it.
      if (String(row[5]) === attendee.requestId && String(row[4]) !== emailHash) {
        return failure_('invalid_request');
      }
      if (String(row[4]) === emailHash) duplicate = true;
    }
    // Identical public result for new entries, case-insensitive duplicates, and retries.
    // The private row remains unchanged, preserving the original timestamp and position.
    if (duplicate) return success_();

    var position = maximumPosition + 1;
    var record = [
      new Date(), cellText_(attendee.firstName), cellText_(attendee.lastName),
      cellText_(attendee.email), emailHash, attendee.requestId, position, 'yes', 'arizona-interest-v1'
    ];
    var target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, HEADERS.length);
    // A real date shows in the Sheet's own time zone; names and email stay plain text.
    target.setNumberFormats([[DATE_FORMAT, '@', '@', '@', '@', '@', '0', '@', '@']]);
    target.setValues([record]);
    SpreadsheetApp.flush();
    // Stored after the write: a lost response can safely be retried without another row.
    // The persisted high-water mark also prevents position reuse after an admin removes a row.
    properties.setProperty('LAST_POSITION', String(position));
    notifyNewSignup_(properties, attendee, position, sheet);
    return success_();
  } catch (error) {
    // Do not return exception details, log form data, or disclose spreadsheet identifiers.
    return failure_('unavailable');
  } finally {
    if (locked) lock.releaseLock();
  }
}

function validateAttendee_(fields) {
  var firstName = String(fields.firstName || '').trim();
  var lastName = String(fields.lastName || '').trim();
  var email = String(fields.email || '').trim().toLowerCase();
  var requestId = String(fields.requestId || '').trim().toLowerCase();
  if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80 ||
      /[\u0000-\u001f\u007f]/.test(firstName + lastName) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /[\u0000-\u001f\u007f]/.test(email) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId) ||
      String(fields.consent) !== 'true') return null;
  return { firstName: firstName, lastName: lastName, email: email, requestId: requestId };
}

/** SPREADSHEET_ID wins; otherwise use the Sheet this script is attached to. */
function workbook_(properties) {
  var id = properties.getProperty('SPREADSHEET_ID');
  var workbook = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!workbook) throw new Error('Not configured');
  return workbook;
}

function configuredSheet_(properties) {
  var sheet = workbook_(properties).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Not initialized');
  validateHeaders_(sheet);
  return sheet;
}

function validateHeaders_(sheet) {
  var actual = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (JSON.stringify(actual) !== JSON.stringify(HEADERS)) throw new Error('Unexpected headers');
}

function readRows_(sheet) {
  return sheet.getLastRow() < 2 ? [] :
    sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
}

/**
 * Email the retreat team about a new signup, with a BCC copy for the record.
 * Runs only after the row is saved, and a mail failure (quota, bad address)
 * never turns a saved signup into an error.
 */
function notifyNewSignup_(properties, attendee, position, sheet) {
  try {
    var to = recipients_(properties, 'NOTIFY_EMAIL', DEFAULT_NOTIFY_EMAIL);
    var copy = recipients_(properties, 'COPY_EMAIL', DEFAULT_COPY_EMAIL);
    if (!to && !copy) return;
    var name = attendee.firstName + ' ' + attendee.lastName;
    var when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    var link = '';
    try {
      var workbook = sheet.getParent();
      when = Utilities.formatDate(new Date(), workbook.getSpreadsheetTimeZone(), "MMM d, yyyy 'at' h:mm a z");
      var view = workbook.getSheetByName(VIEW_NAME);
      link = workbook.getUrl() + (view ? '#gid=' + view.getSheetId() : '');
    } catch (ignored) { /* Fall back to UTC and no link. */ }

    var message = {
      to: to || copy,
      subject: name + ' joined the Desert BLOOM priority list (#' + position + ')',
      name: 'Desert BLOOM Priority List',
      replyTo: attendee.email,
      body: [
        name + ' just joined the Desert BLOOM Wellness Retreat priority list!',
        '',
        'Email: ' + attendee.email,
        'Priority list #: ' + position,
        'Signed up: ' + when,
        '',
        link ? 'See everyone who has signed up: ' + link : 'See everyone on the "' + VIEW_NAME + '" tab of the Google Sheet.',
        'Reply to this email to write back to ' + attendee.firstName + ' directly.'
      ].join('\n'),
      htmlBody:
        '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1810;max-width:520px">' +
        '<div style="background:#f5c518;padding:14px 18px;border-radius:8px 8px 0 0;font-weight:bold;font-size:17px">' +
        escapeHtml_(name) + ' joined the Desert BLOOM priority list</div>' +
        '<div style="border:1px solid #ecd27b;border-top:0;padding:16px 18px;border-radius:0 0 8px 8px">' +
        '<p style="margin:0 0 6px"><b>Email:</b> ' + escapeHtml_(attendee.email) + '</p>' +
        '<p style="margin:0 0 6px"><b>Priority list #:</b> ' + position + '</p>' +
        '<p style="margin:0 0 14px"><b>Signed up:</b> ' + escapeHtml_(when) + '</p>' +
        (link ? '<p style="margin:0 0 14px"><a href="' + escapeHtml_(link) + '" style="color:#886200;font-weight:bold">See everyone who has signed up &rarr;</a></p>' : '') +
        '<p style="margin:0;color:#6b6553;font-size:13px">Reply to this email to write back to ' +
        escapeHtml_(attendee.firstName) + ' directly.</p></div></div>'
    };
    if (to && copy) message.bcc = copy;
    MailApp.sendEmail(message);
  } catch (error) {
    // Never log or return attendee details; the row in the Sheet is the record.
  }
}

function recipients_(properties, key, fallback) {
  var value = String(properties.getProperty(key) || fallback).trim();
  return value.toLowerCase() === 'off' ? '' : value;
}

function escapeHtml_(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function withinRateLimit_(properties) {
  var limit = Number(properties.getProperty('MAX_REQUESTS_PER_HOUR')) || 120;
  limit = Math.max(1, Math.min(1000, Math.floor(limit)));
  var cache = CacheService.getScriptCache();
  var key = 'requests_' + new Date().toISOString().slice(0, 13);
  var count = Number(cache.get(key)) || 0;
  if (count >= limit) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function cellText_(text) {
  // Defense in depth alongside text formatting, including future CSV exports.
  return /^[=+\-@']/.test(text) ? "'" + text : text;
}

function success_() { return json_({ ok: true, capacity: CAPACITY }); }
function failure_(code) { return json_({ ok: false, error: code }); }
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
