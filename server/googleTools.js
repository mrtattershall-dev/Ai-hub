/**
 * googleTools.js - what the agent can actually DO with a connected Google account.
 *
 * WHY THIS EXISTS
 * ---------------
 * `googleAuth.js` connects the account. Until this file, nothing consumed the token:
 * `getAccessToken` had exactly one caller, the /probe endpoint inside its own module. You
 * could sign in, watch every service go green, and the hub still could not read one email.
 * A connection with no consumer is a settings screen, not a feature.
 *
 * THE SPLIT THAT MATTERS
 * ----------------------
 * READ tools auto-run. WRITE tools never do.
 *
 * That is not a style preference. With the supervisor on, this agent starts work while
 * nobody is watching, and a confused unattended run that can send mail from your address
 * or delete your Drive is a different category of mistake from one that writes a bad file
 * into workspace/. Every write tool here is deliberately absent from AUTO_TOOLS, which
 * routes it through the same "ask a human" gate as `npm install`, in every approval mode.
 *
 * OUTPUT IS FOR A MODEL, NOT A SCREEN
 * -----------------------------------
 * Everything returns a compact string, hard-truncated. A local 14B with 32k of context
 * cannot afford a raw Gmail API response, and a tool that floods the window makes the run
 * worse than not having the tool at all.
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { getAccessToken, SERVICES, grantedServices } from './googleAuth.js';

const MAX_CHARS = 4_000;          // per tool result
const MAX_ROWS = 25;              // per listing
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Read-only. Safe to auto-run: they cannot change anything in your account. */
export const GOOGLE_READ_TOOLS = ['gmail_search', 'gmail_read', 'drive_search', 'drive_read', 'calendar_list', 'youtube_list'];

/** Everything that changes something you own. Always gated behind a human. */
export const GOOGLE_WRITE_TOOLS = ['gmail_send', 'drive_upload', 'calendar_add'];

export const GOOGLE_TOOLS = [...GOOGLE_READ_TOOLS, ...GOOGLE_WRITE_TOOLS];

/** Which connected service each tool needs, so a missing grant fails with advice. */
const NEEDS = {
  gmail_search: 'gmail', gmail_read: 'gmail', gmail_send: 'gmail',
  drive_search: 'drive', drive_read: 'drive', drive_upload: 'drive',
  calendar_list: 'calendar', calendar_add: 'calendar',
  youtube_list: 'youtube',
};

const clip = (s, n = MAX_CHARS) => {
  const t = String(s == null ? '' : s);
  return t.length > n ? `${t.slice(0, n)}\n…(truncated, ${t.length - n} more chars)` : t;
};

export function parseGoogleArgs(tool, text, fenced) {
  const field = (name) => (text.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))?.[1] || '').trim().replace(/^["'`]|["'`]$/g, '');
  // BODY is the one multi-line field: a fenced block if there is one, else everything after
  // the marker. Anything else would turn a two-paragraph email into its first line.
  const body = () => (fenced || (text.match(/BODY:\s*([\s\S]+)/i)?.[1] || '').split(/\n[A-Z]{3,}:/)[0]).trim();
  switch (tool) {
    case 'gmail_search':  return { query: field('QUERY'), max: Number(field('MAX')) || 10 };
    case 'gmail_read':    return { id: field('ID') };
    case 'gmail_send':    return { to: field('TO'), subject: field('SUBJECT'), body: body() };
    case 'drive_search':  return { query: field('QUERY'), max: Number(field('MAX')) || 10 };
    case 'drive_read':    return { id: field('ID') };
    case 'drive_upload':  return { path: field('PATH'), name: field('NAME') || undefined };
    case 'calendar_list': return { days: Number(field('DAYS')) || 7 };
    case 'calendar_add':  return { title: field('TITLE'), start: field('START'), end: field('END') };
    case 'youtube_list':  return { max: Number(field('MAX')) || 10 };
    default: return {};
  }
}

/** The prompt block. Written flat and example-first, like the rest of the tool docs. */
export const GOOGLE_TOOL_DOCS = `
gmail_search — find mail. QUERY takes Gmail's own search syntax:
ACTION: gmail_search
QUERY: from:stripe.com newer_than:7d

gmail_read — the full text of one message, by the ID gmail_search returned:
ACTION: gmail_read
ID: 18f2c9a1b2c3d4e5

drive_search — find files. QUERY is plain words, matched against the name:
ACTION: drive_search
QUERY: invoice september

drive_read — the text of one Drive file (Docs/Sheets/Slides are exported as text):
ACTION: drive_read
ID: 1AbC_dEfGh

calendar_list — what is coming up:
ACTION: calendar_list
DAYS: 7

youtube_list — your own recent uploads:
ACTION: youtube_list

gmail_send — send mail AS YOU. Needs a human to approve, every time:
ACTION: gmail_send
TO: someone@example.com
SUBJECT: Build finished
BODY:
\`\`\`
The nightly build passed. Report attached in Drive.
\`\`\`

drive_upload — upload a file FROM THE WORKSPACE to Drive. Needs approval:
ACTION: drive_upload
PATH: dist/build.zip
NAME: nightly-build.zip

calendar_add — create an event. Needs approval. Times are ISO 8601:
ACTION: calendar_add
TITLE: Playtest
START: 2026-09-12T18:00:00Z
END: 2026-09-12T19:00:00Z

ABOUT THESE: they touch a real account that belongs to a person. Reading is free; the three
that write wait for a human every time, in every approval mode, so do not plan a run that
depends on one completing unattended. If a tool says Google is not connected, say so and
carry on with the rest of the goal - it is not a reason to stop.
`.trim();

// ── plumbing ──────────────────────────────────────────────────────────────────────────
function makeCaller(db) {
  return async function call(url, { method = 'GET', headers = {}, body } = {}) {
    const token = await getAccessToken(db);
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...headers }, body });
    if (!res.ok) {
      const text = await res.text();
      let msg = `HTTP ${res.status}`;
      try { msg = JSON.parse(text)?.error?.message || msg; } catch { /* non-JSON error body */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res;
  };
}

/**
 * Refuse early, with the reason that actually helps.
 *
 * "Not connected", "that service was not granted" and "the token expired" are three
 * different problems with three different fixes, and a model told only "403" will retry
 * the same call until its budget runs out.
 */
function guard(loadDb, tool) {
  const g = loadDb().google || {};
  if (!g.tokens?.refresh_token) {
    return `ERROR: Google is not connected. Ask the user to connect it in Settings → Accounts, then try again.`;
  }
  const need = NEEDS[tool];
  if (need && !grantedServices(g.grantedScopes || [], [need]).length) {
    return `ERROR: the ${SERVICES[need].label} scope was not granted for this account. `
      + `Ask the user to tick ${SERVICES[need].label} in Settings → Accounts and reconnect.`;
  }
  return null;
}

const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Walk a Gmail payload for the best text part. Bodies are base64url, sometimes nested. */
function gmailText(payload) {
  if (!payload) return '';
  const decode = (d) => Buffer.from(String(d).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  if (payload.body?.data && (!payload.mimeType || payload.mimeType.startsWith('text/'))) return decode(payload.body.data);
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data);
  }
  for (const part of payload.parts || []) {
    const found = gmailText(part);
    if (found) return found;
  }
  return '';
}

const header = (msg, name) =>
  (msg.payload?.headers || []).find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

/**
 * Build the tool implementations.
 *
 * `safePath` comes from agent.js so an upload is confined to the workspace by exactly the
 * same check that confines write_file. Without it, `drive_upload` with PATH ../../.ssh/id_rsa
 * would be a one-line exfiltration of anything the hub's user can read - the approval gate
 * would ask, but it would ask about a path nobody reads carefully at 3am.
 */
export function googleTools({ loadDb, saveDb, withDb, safePath }) {
  const db = { loadDb, saveDb, withDb };
  const call = makeCaller(db);
  const wrap = (tool, fn) => async (args) => {
    const blocked = guard(loadDb, tool);
    if (blocked) return blocked;
    try { return await fn(args); }
    catch (e) { return `ERROR: ${tool} failed: ${e.message}`; }
  };

  return {
    gmail_search: wrap('gmail_search', async ({ query, max }) => {
      if (!query) return 'ERROR: missing QUERY.';
      const u = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(max, MAX_ROWS)}`;
      const list = await (await call(u)).json();
      if (!list.messages?.length) return `No messages match: ${query}`;
      const rows = await Promise.all(list.messages.map(async (m) => {
        const d = await (await call(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)).json();
        return `${d.id}  ${header(d, 'Date').slice(0, 16)}  ${header(d, 'From').slice(0, 40)}  ${header(d, 'Subject').slice(0, 60)}`;
      }));
      return clip(`${rows.length} message(s). Use gmail_read with an ID for the body.\nID  DATE  FROM  SUBJECT\n${rows.join('\n')}`);
    }),

    gmail_read: wrap('gmail_read', async ({ id }) => {
      if (!id) return 'ERROR: missing ID.';
      const m = await (await call(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`)).json();
      return clip([
        `From: ${header(m, 'From')}`, `To: ${header(m, 'To')}`,
        `Date: ${header(m, 'Date')}`, `Subject: ${header(m, 'Subject')}`,
        '', gmailText(m.payload) || '(no plain-text part)',
      ].join('\n'));
    }),

    gmail_send: wrap('gmail_send', async ({ to, subject, body }) => {
      if (!to || !subject) return 'ERROR: gmail_send needs TO and SUBJECT.';
      const mime = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', '', body || ''].join('\r\n');
      const r = await (await call('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: b64url(mime) }),
      })).json();
      return `Sent to ${to} (message ${r.id}).`;
    }),

    drive_search: wrap('drive_search', async ({ query, max }) => {
      if (!query) return 'ERROR: missing QUERY.';
      // Escape single quotes: Drive's query language is a string grammar, and a file named
      // "Bob's plan" would otherwise be a syntax error rather than a search.
      const q = `name contains '${String(query).replace(/'/g, "\\'")}' and trashed = false`;
      const u = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${Math.min(max, MAX_ROWS)}&fields=files(id,name,mimeType,size,modifiedTime)`;
      const list = await (await call(u)).json();
      if (!list.files?.length) return `No Drive files match: ${query}`;
      const rows = list.files.map((f) => `${f.id}  ${f.name}  [${f.mimeType.replace('application/vnd.google-apps.', 'google-')}]  ${f.modifiedTime?.slice(0, 10) || ''}`);
      return clip(`${rows.length} file(s). Use drive_read with an ID.\nID  NAME  TYPE  MODIFIED\n${rows.join('\n')}`);
    }),

    drive_read: wrap('drive_read', async ({ id }) => {
      if (!id) return 'ERROR: missing ID.';
      const meta = await (await call(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name,mimeType,size`)).json();
      // Native Google formats have no bytes to download - they have to be exported.
      const isNative = meta.mimeType?.startsWith('application/vnd.google-apps.');
      if (isNative && !/document|spreadsheet|presentation/.test(meta.mimeType)) {
        return `ERROR: ${meta.name} is a ${meta.mimeType}, which has no text form to read.`;
      }
      // A binary file has no text to read, and `alt=media` would happily hand back 4000
      // characters of decoded PNG - which lands in a 32k context window as pure noise and
      // costs the run a step to work out what happened.
      const textual = isNative || /^(text\/|application\/(json|xml|javascript|x-yaml|x-sh))|\+(json|xml)$/.test(meta.mimeType || '');
      if (!textual) {
        return `ERROR: ${meta.name} is ${meta.mimeType}, which is not text. `
          + `drive_read only returns text; download it with a shell command if you need the bytes.`;
      }
      const url = isNative
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=text/plain`
        : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`;
      const text = await (await call(url)).text();
      return clip(`${meta.name} (${meta.mimeType})\n\n${text}`);
    }),

    drive_upload: wrap('drive_upload', async ({ path, name }) => {
      if (!path) return 'ERROR: missing PATH (a file inside the workspace).';
      let abs;
      try { abs = safePath(path); } catch (e) { return `ERROR: ${e.message}`; }
      if (!existsSync(abs)) return `ERROR: ${path} does not exist in the workspace.`;
      const size = statSync(abs).size;
      if (size > MAX_UPLOAD_BYTES) {
        return `ERROR: ${path} is ${(size / 1e6).toFixed(1)}MB; this tool uploads files up to ${MAX_UPLOAD_BYTES / 1e6}MB in one request.`;
      }
      const filename = name || path.split(/[\\/]/).pop();
      const boundary = `hub${Date.now()}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename })}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
        readFileSync(abs),
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const r = await (await call('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
      })).json();
      return `Uploaded ${filename} to Drive (${r.id}). ${r.webViewLink || ''}`.trim();
    }),

    calendar_list: wrap('calendar_list', async ({ days: raw }) => {
      // Clamp once and report the clamped number: saying "nothing in the next -3 days" when
      // a day was actually searched is worse than the bad input that caused it.
      const days = Math.min(365, Math.max(1, raw));
      const now = new Date();
      const end = new Date(now.getTime() + days * 86400_000);
      const u = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}`
        + `&singleEvents=true&orderBy=startTime&maxResults=${MAX_ROWS}`;
      const list = await (await call(u)).json();
      if (!list.items?.length) return `Nothing scheduled in the next ${days} day(s).`;
      const rows = list.items.map((e) => `${e.start?.dateTime || e.start?.date || '?'}  ${e.summary || '(no title)'}`);
      return clip(`${rows.length} event(s) in the next ${days} day(s):\n${rows.join('\n')}`);
    }),

    calendar_add: wrap('calendar_add', async ({ title, start, end }) => {
      if (!title || !start) return 'ERROR: calendar_add needs TITLE and START (ISO 8601).';
      const startAt = new Date(start);
      if (Number.isNaN(startAt.getTime())) return `ERROR: START "${start}" is not a date I can read. Use ISO 8601, e.g. 2026-09-12T18:00:00Z.`;
      const endAt = end ? new Date(end) : new Date(startAt.getTime() + 3600_000);
      if (Number.isNaN(endAt.getTime())) return `ERROR: END "${end}" is not a date I can read.`;
      // Google rejects this with a message about "time range is empty", which reads like a
      // query problem rather than "you put the end before the start".
      if (endAt <= startAt) return `ERROR: END (${endAt.toISOString()}) is not after START (${startAt.toISOString()}).`;
      const r = await (await call('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: title, start: { dateTime: startAt.toISOString() }, end: { dateTime: endAt.toISOString() } }),
      })).json();
      return `Created "${title}" at ${startAt.toISOString()} (${r.id}).`;
    }),

    youtube_list: wrap('youtube_list', async ({ max }) => {
      const mine = await (await call('https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&mine=true')).json();
      const ch = mine.items?.[0];
      if (!ch) return 'No YouTube channel is associated with this Google account.';
      const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
      if (!uploads) return `Channel "${ch.snippet?.title}" has no uploads playlist.`;
      const list = await (await call(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploads}&maxResults=${Math.min(max, MAX_ROWS)}`)).json();
      const rows = (list.items || []).map((i) => `${i.snippet?.resourceId?.videoId}  ${i.snippet?.publishedAt?.slice(0, 10)}  ${i.snippet?.title}`);
      return clip(`Channel: ${ch.snippet?.title}\n${rows.length} recent upload(s):\nID  PUBLISHED  TITLE\n${rows.join('\n')}`);
    }),
  };
}
