/**
 * Arizona retreat interest list. Deploy separately as a Google Apps Script web app.
 * This file contains no deployment, spreadsheet identifier, or credentials.
 * Read README.md before deploying. All attendee data remains in a private Sheet.
 */
var CAPACITY = 12;
var SHEET_NAME = 'Arizona Priority List';
var HEADERS = [
  'joined_at_utc', 'first_name', 'last_name', 'email', 'email_sha256',
  'request_id', 'list_position', 'consent', 'consent_version'
];

/** Run once in the Apps Script editor after setting SPREADSHEET_ID. */
function setupPriorityList() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var properties = PropertiesService.getScriptProperties();
    var id = properties.getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Set SPREADSHEET_ID in Script Properties first.');
    var workbook = SpreadsheetApp.openById(id);
    var sheet = workbook.getSheetByName(SHEET_NAME) || workbook.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }
    validateHeaders_(sheet);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
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
      new Date().toISOString(), cellText_(attendee.firstName), cellText_(attendee.lastName),
      cellText_(attendee.email), emailHash, attendee.requestId, position, 'yes', 'arizona-interest-v1'
    ];
    var target = sheet.getRange(sheet.getLastRow() + 1, 1, 1, HEADERS.length);
    target.setNumberFormat('@');
    target.setValues([record]);
    SpreadsheetApp.flush();
    // Stored after the write: a lost response can safely be retried without another row.
    // The persisted high-water mark also prevents position reuse after an admin removes a row.
    properties.setProperty('LAST_POSITION', String(position));
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

function configuredSheet_(properties) {
  var id = properties.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Not configured');
  var sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
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
