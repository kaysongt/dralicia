const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

function createHarness() {
  const state = {
    rows: [], properties: { SPREADSHEET_ID: 'private-test-sheet' }, cache: new Map(),
    acquired: false, releases: 0, denyLock: false, failWrite: false, failFlush: false,
    mail: [], failMail: false, unbound: false,
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sheet = {
    getLastRow: () => state.rows.length,
    getLastColumn: () => (state.rows[0] || []).length,
    getSheetId: () => 1,
    hideSheet: () => { state.rawHidden = true; },
    setFrozenRows: () => {},
    getRange(row, column, height, width) {
      const range = {
        setNumberFormat: () => range,
        setNumberFormats: (formats) => { state.formats = formats; return range; },
        getValues: () => Array.from({ length: height }, (_, i) =>
          Array.from({ length: width }, (_, j) => state.rows[row - 1 + i]?.[column - 1 + j] ?? '')),
        setValues(values) {
          if (state.failWrite) throw new Error('Simulated write failure');
          values.forEach((valuesRow, i) => { state.rows[row - 1 + i] = valuesRow.slice(); });
          return range;
        },
      };
      return range;
    },
  };
  // Any tab other than the raw list records what setup wrote to it.
  const viewSheet = (name) => {
    const view = { name, values: {}, formulas: {}, cleared: 0, protections: [], id: 100 + Object.keys(state.tabs).length };
    const cell = (r, c) => {
      const range = new Proxy({}, { get: (_, key) => {
        if (key === 'setValues') return (v) => { v.forEach((row, i) => row.forEach((x, j) => { view.values[`${r + i},${c + j}`] = x; })); return range; };
        if (key === 'setFormula') return (f) => { view.formulas[`${r},${c}`] = f; return range; };
        return () => range;
      } });
      return range;
    };
    Object.assign(view, {
      getRange: cell, clear: () => { view.cleared++; view.values = {}; view.formulas = {}; },
      setFrozenRows: () => {}, setColumnWidth: () => {}, getSheetId: () => view.id,
      getLastRow: () => 0, getLastColumn: () => 0,
      getProtections: () => view.protections.slice(),
      protect: () => { const p = { remove: () => { view.protections.splice(view.protections.indexOf(p), 1); }, setDescription: () => p, setWarningOnly: () => p }; view.protections.push(p); return p; },
    });
    return view;
  };
  state.tabs = {};
  const workbook = {
    getSheetByName: (name) => (name === 'Arizona Priority List' ? sheet : state.tabs[name] || null),
    insertSheet: (name) => (name === 'Arizona Priority List' ? sheet : (state.tabs[name] = viewSheet(name))),
    setActiveSheet: (tab) => { state.active = tab; }, moveActiveSheet: () => {},
    deleteSheet: (tab) => { delete state.tabs[tab.name]; state.deleted = (state.deleted || []).concat(tab.name); },
  };
  const context = vm.createContext({
    Date, JSON, Object, String, Number, Math,
    LockService: { getScriptLock: () => ({
      tryLock: () => { state.acquired = !state.denyLock; return state.acquired; },
      waitLock: () => { state.acquired = true; },
      releaseLock: () => { assert.ok(state.acquired); state.acquired = false; state.releases++; },
    }) },
    SpreadsheetApp: {
      ProtectionType: { SHEET: 'SHEET' },
      openById: () => workbook,
      getActiveSpreadsheet: () => (state.unbound ? null : workbook),
      flush: () => { if (state.failFlush) throw new Error('Simulated flush failure'); },
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => state.properties[key] || null,
      setProperty: (key, value) => { state.properties[key] = value; },
    }) },
    CacheService: { getScriptCache: () => ({
      get: (key) => state.cache.get(key), put: (key, value) => state.cache.set(key, value),
    }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, text, encoding) => [...createHash(algorithm).update(text, encoding).digest()],
    },
    MailApp: { sendEmail: (message) => {
      if (state.failMail) throw new Error('Simulated mail quota');
      state.mail.push(clone(message));
    } },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (body) => ({ setMimeType: () => JSON.parse(body) }),
    },
  });
  vm.runInContext(source, context);
  context.setupPriorityList();
  state.releases = 0;
  const event = (overrides = {}) => {
    const fields = {
      firstName: 'Alicia', lastName: 'Example', email: 'alicia@example.com',
      website: '', consent: 'true', requestId: randomUUID(), ...overrides,
    };
    const encoded = new URLSearchParams(fields).toString();
    return { parameter: fields, postData: { type: 'application/x-www-form-urlencoded', length: encoded.length } };
  };
  return { state, context, event, submit: (overrides) => context.doPost(event(overrides)) };
}

test('valid submission persists only once across retries and case-normalized duplicate emails', () => {
  const h = createHarness();
  const requestId = randomUUID();
  const success = { ok: true, capacity: 12 };
  assert.deepEqual(h.submit({ email: ' Alice@Example.com ', requestId }), success);
  assert.deepEqual(h.submit({ email: 'alice@example.com', requestId }), success);
  assert.deepEqual(h.submit({ email: 'ALICE@example.com', firstName: 'Changed' }), success);
  assert.equal(h.state.rows.length, 2);
  assert.equal(h.state.rows[1][1], 'Alicia');
  assert.equal(h.state.rows[1][3], 'alice@example.com');
  assert.equal(h.state.rows[1][6], 1);
  assert.equal(h.state.releases, 3);
});

test('13th unique interest entry receives private position 13; capacity is not availability', () => {
  const h = createHarness();
  for (let i = 1; i <= 13; i++) {
    assert.deepEqual(h.submit({ email: `guest${i}@example.com` }), { ok: true, capacity: 12 });
    assert.equal(h.state.rows[i][6], i);
  }
  assert.deepEqual(h.context.doGet(), { ok: true, capacity: 12, interestCount: null });
  h.state.properties.EXPOSE_AGGREGATE_COUNT = 'true';
  assert.deepEqual(h.context.doGet(), { ok: true, capacity: 12, interestCount: 13 });
  assert.ok(!JSON.stringify(h.context.doGet()).includes('guest'));
  assert.ok(!('position' in h.context.doGet()));
});

test('a busy script lock prevents a write and is not released by the caller', () => {
  const h = createHarness();
  h.state.denyLock = true;
  assert.deepEqual(h.submit(), { ok: false, error: 'busy' });
  assert.equal(h.state.rows.length, 1);
  assert.equal(h.state.releases, 0);
});

test('write and ambiguous flush failures release locks and can safely retry', () => {
  const h = createHarness();
  const requestId = randomUUID();
  h.state.failWrite = true;
  assert.deepEqual(h.submit({ requestId }), { ok: false, error: 'unavailable' });
  assert.equal(h.state.rows.length, 1);
  assert.equal(h.state.releases, 1);
  h.state.failWrite = false;
  h.state.failFlush = true;
  assert.deepEqual(h.submit({ requestId }), { ok: false, error: 'unavailable' });
  assert.equal(h.state.rows.length, 2);
  assert.equal(h.state.releases, 2);
  h.state.failFlush = false;
  assert.deepEqual(h.submit({ requestId }), { ok: true, capacity: 12 });
  assert.equal(h.state.rows.length, 2);
  assert.equal(h.state.releases, 3);
});

test('formula-like names and addresses are stored as text and still deduplicate', () => {
  const h = createHarness();
  const attendee = { firstName: '=IMPORTXML("x","y")', lastName: '+1+1', email: '=formula@example.com' };
  assert.deepEqual(h.submit(attendee), { ok: true, capacity: 12 });
  assert.equal(h.state.rows[1][1], '\'=IMPORTXML("x","y")');
  assert.equal(h.state.rows[1][2], "'+1+1");
  assert.equal(h.state.rows[1][3], "'=formula@example.com");
  assert.deepEqual(h.submit(attendee), { ok: true, capacity: 12 });
  assert.equal(h.state.rows.length, 2);
});

test('invalid fields and oversized or unsupported requests never create a row', () => {
  const h = createHarness();
  for (const fields of [
    { firstName: '' }, { lastName: 'x'.repeat(81) }, { email: 'invalid' },
    { email: 'a\u0000b@example.com' }, { consent: 'false' }, { requestId: 'not-a-uuid' },
  ]) assert.deepEqual(h.submit(fields), { ok: false, error: 'invalid_fields' });
  assert.deepEqual(h.context.doPost({ postData: { type: 'application/json' } }),
    { ok: false, error: 'invalid_request' });
  const large = h.event();
  large.postData.length = 4097;
  assert.deepEqual(h.context.doPost(large), { ok: false, error: 'invalid_request' });
  assert.equal(h.state.rows.length, 1);
});

test('honeypot produces an indistinguishable response without storing an entry', () => {
  const h = createHarness();
  assert.deepEqual(h.submit({ website: 'spam.example' }), { ok: true, capacity: 12 });
  assert.equal(h.state.rows.length, 1);
  assert.equal(h.state.releases, 0);
});

test('request ID cannot be reassigned to another email address', () => {
  const h = createHarness();
  const requestId = randomUUID();
  h.submit({ requestId });
  assert.deepEqual(h.submit({ requestId, email: 'other@example.com' }), { ok: false, error: 'invalid_request' });
  assert.equal(h.state.rows.length, 2);
  assert.equal(h.state.releases, 2);
});

test('global throttle applies equally to duplicates and new requests and releases locks', () => {
  const h = createHarness();
  h.state.properties.MAX_REQUESTS_PER_HOUR = '1';
  h.submit();
  assert.deepEqual(h.submit(), { ok: false, error: 'rate_limited' });
  assert.deepEqual(h.submit({ email: 'other@example.com' }), { ok: false, error: 'rate_limited' });
  assert.equal(h.state.rows.length, 2);
  assert.equal(h.state.releases, 3);
});

test('high-water mark preserves assigned position numbers if an administrator removes a row', () => {
  const h = createHarness();
  h.submit();
  h.state.rows.pop();
  h.submit({ email: 'later@example.com' });
  assert.equal(h.state.rows[1][6], 2);
});

test('missing configuration fails closed without disclosing private data', () => {
  const h = createHarness();
  delete h.state.properties.SPREADSHEET_ID;
  h.state.unbound = true; // standalone script with no SPREADSHEET_ID
  assert.deepEqual(h.submit(), { ok: false, error: 'unavailable' });
  assert.deepEqual(h.context.doGet(), { ok: false, error: 'unavailable' });
  assert.equal(h.state.rows.length, 1);
  assert.equal(h.state.releases, 1);
});

test('each new signup emails the retreat team once; duplicates and bots do not', () => {
  const h = createHarness();
  h.submit({ firstName: 'Maya', lastName: 'Rivers', email: 'Maya@Example.com' });
  assert.equal(h.state.mail.length, 1);
  const message = h.state.mail[0];
  assert.equal(message.to, 'yaya@coachingwithdralicia.org, yasmeen@coachingwithdralicia.com');
  assert.equal(message.subject, 'New Desert BLOOM signup: Maya Rivers');
  assert.match(message.body, /Name: Maya Rivers/);
  assert.match(message.body, /Email: maya@example\.com/);
  assert.match(message.body, /List position: 1/);
  h.submit({ email: 'maya@example.com' });
  h.submit({ email: 'bot@example.com', website: 'spam' });
  assert.equal(h.state.mail.length, 1);
});

test('NOTIFY_EMAIL overrides the recipient and "off" disables notifications', () => {
  const h = createHarness();
  h.state.properties.NOTIFY_EMAIL = 'team@example.com, yaya@example.com';
  h.submit({ email: 'one@example.com' });
  assert.equal(h.state.mail[0].to, 'team@example.com, yaya@example.com');
  h.state.properties.NOTIFY_EMAIL = 'off';
  h.submit({ email: 'two@example.com' });
  assert.equal(h.state.mail.length, 1);
});

test('a mail failure still saves the signup and reports success', () => {
  const h = createHarness();
  h.state.failMail = true;
  assert.deepEqual(h.submit({ email: 'saved@example.com' }), { ok: true, capacity: 12 });
  assert.equal(h.state.rows.length, 2);
  assert.equal(h.state.rows[1][3], 'saved@example.com');
  assert.equal(h.state.releases, 1);
});

test('without SPREADSHEET_ID the script uses the Sheet it is attached to', () => {
  const h = createHarness();
  delete h.state.properties.SPREADSHEET_ID;
  assert.deepEqual(h.submit({ email: 'bound@example.com' }), { ok: true, capacity: 12 });
  assert.equal(h.state.rows[1][3], 'bound@example.com');
});

test('setup builds a readable Signups tab and hides the technical tab', () => {
  const h = createHarness();
  const view = h.state.tabs.Signups;
  assert.ok(view, 'Signups tab created');
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((c) => view.values[`1,${c}`]),
    ['#', 'First name', 'Last name', 'Email', 'Signed up', 'Total signups']);
  const formula = view.formulas['2,1'];
  for (const column of ['G2:G*1', 'B2:B', 'C2:C', 'D2:D', 'A2:A']) assert.ok(formula.includes(`'Arizona Priority List'!${column}`), column);
  assert.equal(view.formulas['2,6'], '=COUNTA(D2:D)');
  assert.equal(h.state.rawHidden, true);
  assert.equal(h.state.active, view);
  assert.equal(view.protections.length, 1);
  // Re-running setup rebuilds the tab instead of stacking duplicate protections.
  h.context.setupPriorityList();
  assert.equal(view.protections.length, 1);
  assert.equal(view.cleared, 2);
});

test('setup removes only an empty default Sheet1', () => {
  const h = createHarness();
  h.state.tabs.Sheet1 = { name: 'Sheet1', getSheetId: () => 7, getLastRow: () => 0, getLastColumn: () => 0 };
  h.context.setupPriorityList();
  assert.deepEqual(h.state.deleted, ['Sheet1']);
  const h2 = createHarness();
  h2.state.tabs.Sheet1 = { name: 'Sheet1', getSheetId: () => 7, getLastRow: () => 3, getLastColumn: () => 2 };
  h2.context.setupPriorityList();
  assert.equal(h2.state.deleted, undefined);
});

test('new rows store a real date and a numeric position', () => {
  const h = createHarness();
  h.submit({ email: 'dated@example.com' });
  assert.ok(h.state.rows[1][0] instanceof Date);
  assert.equal(h.state.rows[1][6], 1);
  assert.equal(h.state.formats[0][0], 'mmm d, yyyy h:mm am/pm');
  assert.equal(h.state.formats[0][6], '0');
});
