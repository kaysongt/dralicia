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
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sheet = {
    getLastRow: () => state.rows.length,
    setFrozenRows: () => {},
    getRange(row, column, height, width) {
      const range = {
        setNumberFormat: () => range,
        getValues: () => Array.from({ length: height }, (_, i) =>
          Array.from({ length: width }, (_, j) => state.rows[row - 1 + i]?.[column - 1 + j] ?? '')),
        setValues(values) {
          if (state.failWrite) throw new Error('Simulated write failure');
          values.forEach((valuesRow, i) => { state.rows[row - 1 + i] = clone(valuesRow); });
          return range;
        },
      };
      return range;
    },
  };
  const context = vm.createContext({
    Date, JSON, Object, String, Number, Math,
    LockService: { getScriptLock: () => ({
      tryLock: () => { state.acquired = !state.denyLock; return state.acquired; },
      waitLock: () => { state.acquired = true; },
      releaseLock: () => { assert.ok(state.acquired); state.acquired = false; state.releases++; },
    }) },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }),
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
  assert.deepEqual(h.submit(), { ok: false, error: 'unavailable' });
  assert.deepEqual(h.context.doGet(), { ok: false, error: 'unavailable' });
  assert.equal(h.state.rows.length, 1);
  assert.equal(h.state.releases, 1);
});
