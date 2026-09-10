/**
 * googleTools.test.mjs - the agent's Google tools, and the boundary that bounds them.
 *
 *   node server/googleTools.test.mjs
 *
 * No network and no token: every call here stops at the guard, which is the point. The
 * assertion that matters most is the read/write split - with the supervisor on, this agent
 * works while nobody is watching, and "which of these can run without a human" is the line
 * between reading your calendar and mailing your contacts.
 */
import assert from 'node:assert/strict';
import { parseGoogleArgs, googleTools, GOOGLE_READ_TOOLS, GOOGLE_WRITE_TOOLS, GOOGLE_TOOLS, GOOGLE_TOOL_DOCS } from './googleTools.js';
import { __toolPolicyTest } from './agent.js';

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

// ---- the safety boundary --------------------------------------------------------------
await test('NO write tool may auto-run - each one needs a human, in every approval mode', () => {
  const auto = __toolPolicyTest.autoTools();
  for (const t of GOOGLE_WRITE_TOOLS) {
    assert.ok(!auto.has(t), `${t} is in AUTO_TOOLS and would run unattended against a real account`);
  }
});

await test('every read tool DOES auto-run, or the tools are useless to an unattended run', () => {
  const auto = __toolPolicyTest.autoTools();
  for (const t of GOOGLE_READ_TOOLS) assert.ok(auto.has(t), `${t} is missing from AUTO_TOOLS`);
});

await test('read and write sets are disjoint and cover every tool', () => {
  assert.deepEqual(GOOGLE_TOOLS, [...GOOGLE_READ_TOOLS, ...GOOGLE_WRITE_TOOLS]);
  for (const t of GOOGLE_READ_TOOLS) assert.ok(!GOOGLE_WRITE_TOOLS.includes(t), `${t} is in both sets`);
});

await test('the approval prompt names the real effect, not the tool name', () => {
  const r = __toolPolicyTest.writeReason('gmail_send', { to: 'someone@example.com', subject: 'Build finished' });
  assert.match(r, /sends mail AS YOU to someone@example\.com/);
  assert.match(r, /Build finished/);
  assert.match(__toolPolicyTest.writeReason('drive_upload', { path: 'dist/build.zip' }), /uploads dist\/build\.zip/);
  assert.match(__toolPolicyTest.writeReason('calendar_add', { title: 'Playtest', start: 'X' }), /creates "Playtest"/);
});

await test('a write tool with no arguments still produces a readable prompt', () => {
  assert.match(__toolPolicyTest.writeReason('gmail_send', {}), /no recipient given/);
});

// ---- argument parsing -------------------------------------------------------------------
await test('a multi-line BODY survives - the first line is not the whole email', () => {
  const a = parseGoogleArgs('gmail_send', 'TO: x@y.com\nSUBJECT: Done\nBODY:\nline one\nline two');
  assert.equal(a.to, 'x@y.com');
  assert.equal(a.subject, 'Done');
  assert.equal(a.body, 'line one\nline two');
});

await test('a fenced BODY is preferred, since that is how the docs show it', () => {
  const a = parseGoogleArgs('gmail_send', 'TO: x@y.com\nSUBJECT: S\nBODY:', 'fenced body\nsecond line');
  assert.equal(a.body, 'fenced body\nsecond line');
});

await test('quotes the model adds around a value are stripped', () => {
  assert.equal(parseGoogleArgs('gmail_search', 'QUERY: "from:stripe.com"').query, 'from:stripe.com');
  assert.equal(parseGoogleArgs('drive_read', "ID: '1AbC'").id, '1AbC');
});

await test('numeric fields fall back to a default rather than NaN', () => {
  assert.equal(parseGoogleArgs('gmail_search', 'QUERY: x').max, 10);
  assert.equal(parseGoogleArgs('calendar_list', '').days, 7);
  assert.equal(parseGoogleArgs('calendar_list', 'DAYS: notanumber').days, 7);
  assert.equal(parseGoogleArgs('calendar_list', 'DAYS: 30').days, 30);
});

await test('each tool pulls its own fields', () => {
  assert.deepEqual(parseGoogleArgs('drive_upload', 'PATH: dist/a.zip\nNAME: nightly.zip'), { path: 'dist/a.zip', name: 'nightly.zip' });
  assert.equal(parseGoogleArgs('drive_upload', 'PATH: dist/a.zip').name, undefined, 'NAME is optional');
  assert.deepEqual(parseGoogleArgs('calendar_add', 'TITLE: T\nSTART: 2026-01-01T00:00:00Z\nEND: 2026-01-01T01:00:00Z'),
    { title: 'T', start: '2026-01-01T00:00:00Z', end: '2026-01-01T01:00:00Z' });
});

// ---- the guard ---------------------------------------------------------------------------
const toolsWith = (google) => googleTools({
  loadDb: () => ({ google }), saveDb: () => {}, withDb: (f) => f(), safePath: (p) => p,
});

await test('with no account connected, every tool says so and says where to fix it', async () => {
  const t = toolsWith({});
  for (const name of GOOGLE_TOOLS) {
    const out = await t[name]({ query: 'x', id: 'x', to: 'a@b.c', subject: 's', path: 'p', title: 'T', start: '2026-01-01T00:00:00Z' });
    assert.match(out, /^ERROR: Google is not connected/, `${name} did not report the missing connection`);
    assert.match(out, /Settings/, `${name} did not say where to fix it`);
  }
});

await test('a connected account missing ONE scope blocks only that service', async () => {
  const t = toolsWith({
    tokens: { refresh_token: 'r' },
    grantedScopes: ['https://www.googleapis.com/auth/calendar'],   // calendar only
  });
  const gmail = await t.gmail_search({ query: 'x' });
  assert.match(gmail, /Gmail scope was not granted/);
  assert.match(gmail, /reconnect/, 'the fix has to be stated, not implied');
  // calendar_list would proceed to the network, so it is not asserted here - the point is
  // that it did NOT fail at the guard the way gmail did.
  assert.doesNotMatch(gmail, /is not connected/, 'a scope problem must not be reported as a connection problem');
});

await test('missing required arguments are caught before any network call', async () => {
  const t = toolsWith({ tokens: { refresh_token: 'r' }, grantedScopes: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'] });
  assert.match(await t.gmail_search({}), /missing QUERY/);
  assert.match(await t.gmail_read({}), /missing ID/);
  assert.match(await t.gmail_send({ to: 'a@b.c' }), /needs TO and SUBJECT/);
});

// ---- input validation that happens before any network call ---------------------------------
// A live access token with an hour left, so nothing here attempts a refresh.
const connected = (scopes) => toolsWith({
  config: { client_id: 'id', client_secret: 's' },
  tokens: { refresh_token: 'r', access_token: 'at', expires_at: Date.now() + 3600_000 },
  grantedScopes: scopes,
});
const CAL = ['https://www.googleapis.com/auth/calendar'];
const DRIVE = ['https://www.googleapis.com/auth/drive'];

await test('an event ending before it starts is refused, in those words', async () => {
  const t = connected(CAL);
  const out = await t.calendar_add({ title: 'Backwards', start: '2026-09-12T19:00:00Z', end: '2026-09-12T18:00:00Z' });
  assert.match(out, /is not after START/);
});

await test('an event with equal start and end is refused too', async () => {
  const t = connected(CAL);
  assert.match(await t.calendar_add({ title: 'Zero', start: '2026-09-12T18:00:00Z', end: '2026-09-12T18:00:00Z' }), /is not after START/);
});

await test('an unparseable date is named, rather than sent to Google as-is', async () => {
  const t = connected(CAL);
  assert.match(await t.calendar_add({ title: 'T', start: 'next tuesday' }), /"next tuesday" is not a date/);
});

await test('a binary Drive file is refused rather than decoded into the context window', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('/drive/v3/files/')) {
      return { ok: true, json: async () => ({ name: 'sprite.png', mimeType: 'image/png', size: '2048' }) };
    }
    throw new Error('drive_read tried to download the bytes of a binary file');
  };
  try {
    const out = await connected(DRIVE).drive_read({ id: 'abc' });
    assert.match(out, /is image\/png, which is not text/);
  } finally { globalThis.fetch = real; }
});

// ---- MIME header injection -------------------------------------------------------------------
const GMAIL = ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send'];

/** Capture what gmail_send would actually put on the wire, without sending anything. */
async function sentMime(args) {
  const real = globalThis.fetch;
  let raw = null;
  globalThis.fetch = async (url, opts) => {
    if (String(url).includes('/messages/send')) {
      raw = JSON.parse(opts.body).raw;
      return { ok: true, json: async () => ({ id: 'sent1' }) };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    const out = await connected(GMAIL).gmail_send(args);
    const mime = raw == null ? null : Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return { out, mime };
  } finally { globalThis.fetch = real; }
}

await test('a CRLF in SUBJECT cannot inject a Bcc header', async () => {
  const { mime } = await sentMime({ to: 'a@b.com', subject: 'Report\r\nBcc: attacker@evil.com', body: 'hi' });
  assert.ok(mime, 'the message should still be sent');
  // What makes a header a header is being at the START of a line. Flattened onto the
  // Subject line the same characters are inert text, which is the whole point - the words
  // are not censored, they just cannot become a header any more.
  const headers = mime.split('\r\n\r\n')[0].split('\r\n');
  assert.ok(!headers.some(h => /^bcc:/i.test(h)), `an injected header reached the wire:\n${mime}`);
  assert.equal(headers.length, 3, 'exactly To, Subject and Content-Type');
  assert.match(mime, /Subject: Report Bcc: attacker@evil\.com/, 'the text survives, flattened onto one line');
});

await test('U+2028 and U+2029 are neutralised too - they are line terminators to a parser', async () => {
  // Written as escapes on purpose: raw separators are invisible in a diff, and putting one
  // straight into a regex literal is what broke the parser while this was being fixed.
  const sneaky = 'A\u2028Bcc: x@y.com\u2029B';
  const { mime } = await sentMime({ to: 'a@b.com', subject: sneaky, body: 'hi' });
  const headerBlock = mime.split('\r\n\r\n')[0];
  assert.ok(!/[\u2028\u2029]/.test(headerBlock), 'a raw line separator survived into the headers');
  assert.equal(headerBlock.split('\r\n').length, 3, 'exactly To, Subject and Content-Type');
});

await test('a CRLF in TO cannot inject headers either', async () => {
  const { out } = await sentMime({ to: 'a@b.com\r\nBcc: attacker@evil.com', subject: 'S', body: 'x' });
  // Flattened, the recipient stops looking like an address list, so it is refused outright.
  assert.match(out, /^ERROR: TO must be one address/);
});

await test('a recipient built out of prose is refused rather than guessed at', async () => {
  const { out } = await sentMime({ to: 'the person who filed the bug', subject: 'S', body: 'x' });
  assert.match(out, /^ERROR: TO must be one address/);
});

await test('ordinary recipients still work, including a comma-separated list', async () => {
  const one = await sentMime({ to: 'a@b.com', subject: 'S', body: 'x' });
  assert.match(one.out, /^Sent to a@b\.com/);
  const many = await sentMime({ to: 'a@b.com, c@d.com', subject: 'S', body: 'x' });
  assert.match(many.out, /^Sent to a@b\.com, c@d\.com/);
});

await test('the BODY may still contain newlines - only headers are flattened', async () => {
  const { mime } = await sentMime({ to: 'a@b.com', subject: 'S', body: 'line one\nline two' });
  assert.match(mime, /line one\nline two/);
});

// ---- page sizes ---------------------------------------------------------------------------
async function requestedUrl(fn) {
  const real = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url) => {
    seen = String(url);
    return { ok: true, json: async () => ({ messages: [], files: [], items: [] }) };
  };
  try { await fn(); return seen; } finally { globalThis.fetch = real; }
}

await test('a negative MAX cannot reach Google as maxResults=-5', async () => {
  const t = connected(GMAIL);
  const url = await requestedUrl(() => t.gmail_search({ query: 'x', max: -5 }));
  assert.match(url, /maxResults=1\b/, `sent: ${url}`);
});

await test('an absurd MAX is clamped to the listing cap', async () => {
  const t = connected(GMAIL);
  const url = await requestedUrl(() => t.gmail_search({ query: 'x', max: 9999 }));
  assert.match(url, /maxResults=25\b/, `sent: ${url}`);
});

await test('a fractional MAX becomes a whole number', async () => {
  const t = connected(GMAIL);
  const url = await requestedUrl(() => t.gmail_search({ query: 'x', max: 3.7 }));
  assert.match(url, /maxResults=3\b/, `sent: ${url}`);
});

// ---- the tools are really registered with the agent ------------------------------------------
await test('every Google tool is callable by the run loop, not merely exported from this module', () => {
  // `tools[tool]` is the exact lookup the loop does; anything missing there comes back to
  // the model as "unknown tool" no matter how well it is documented.
  for (const name of GOOGLE_TOOLS) {
    assert.ok(__toolPolicyTest.hasTool(name), `${name} is documented but not registered in the tool table`);
  }
});

await test('an unconnected hub still registers them - they answer, they just answer "not connected"', () => {
  // Registration must not depend on a router having been constructed: that ordering is
  // what made this only checkable by disturbing the live work queue.
  assert.ok(__toolPolicyTest.hasTool('gmail_send'));
});

// ---- the docs the model actually reads ----------------------------------------------------
await test('every tool is documented, or the model cannot call it', () => {
  for (const name of GOOGLE_TOOLS) {
    assert.ok(GOOGLE_TOOL_DOCS.includes(`ACTION: ${name}`), `${name} has no ACTION example in the docs`);
  }
});

await test('the docs warn that writes cannot complete unattended', () => {
  assert.match(GOOGLE_TOOL_DOCS, /wait for a human/i);
  assert.match(GOOGLE_TOOL_DOCS, /not a reason to stop/i, 'a missing connection must not abort an unrelated goal');
});

console.log(`google tools: ${passed} passed${process.exitCode ? ' (with failures above)' : ''}`);
