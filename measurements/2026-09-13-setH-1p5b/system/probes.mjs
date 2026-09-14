// BEHAVIOURAL ORACLES for the held-out goals whose structural contract cannot distinguish success
// from a no-op. Without these, six of the twenty 41-60 goals would enter the numerator on
// loadability alone - the vacuous-pass defect wearing different clothes.
//
//   goal 44  links      [text](url) -> <a href="url">text</a>, a double quote in the url as &quot;
//   goal 45  functions  min(...) max(...) abs(x) sqrt(x) inside evaluate()
//   goal 49  persistence  cards survive a reload, in the same columns and order
//   goal 54  lists      consecutive "- " lines -> <ul><li>..</li>..</ul> on one line
//   goal 55  error pos  the message contains 'at N' for the first unparseable character
//   goal 59  doing limit  Doing holds at most 3; a 4th does nothing but show "Doing is full"
//
// EACH PROBE IS TESTED WITH THREE WITNESSES (probes.test.mjs):
//   reference post-goal implementation -> PASS
//   no-op / wrong implementation       -> FAIL
//   the FROZEN post-40 canonical seed  -> FAIL      <- proves the probe tests the DELTA, not old behaviour
//
// Probes test BEHAVIOUR, not implementation. Goal 49 names its storage key, so that is checked; the
// others are not told how to do anything, so nothing about their internals is asserted.
import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const py = (ws, code) => {
  const f = join(ws, '_probe.py');
  writeFileSync(f, code, 'utf8');
  const r = spawnSync('python', [f], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return { out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
};
const js = (ws, code) => {
  const f = join(ws, '_probe.js');
  writeFileSync(f, code, 'utf8');
  const r = spawnSync(process.execPath, [f], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return { out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
};
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

// ---- goal 44: links ---------------------------------------------------------------------------
export const probe44 = {
  id: 'goal44.links',
  goal: 44,
  lead: 's4_markdown.py',
  run(ws) {
    const r = py(ws, [
      'import s4_markdown as m',
      'print(m.to_html("see [docs](http://x.example/a)"))',
      'print(m.to_html("[t](http://x/?q=\\"z\\")"))',
      'print(m.to_html("a plain [bracket] and (parens)"))',
      'print(m.to_html("**bold** still"))',
    ].join('\n'));
    if (r.err) return { pass: false, why: 'threw: ' + r.err.split('\n').pop().slice(0, 90) };
    const [l1, l2, l3, l4] = lines(r.out);
    if (!l1 || !/<a href="http:\/\/x\.example\/a">docs<\/a>/.test(l1)) return { pass: false, why: 'link not rendered: ' + l1 };
    if (!l2 || !/&quot;/.test(l2) || /href="[^"]*"[^>]*"/.test(l2)) return { pass: false, why: 'quote in url not escaped as &quot;: ' + l2 };
    if (!l3 || /<a /.test(l3)) return { pass: false, why: 'non-link text was turned into a link: ' + l3 };
    if (!l4 || !/<strong>bold<\/strong>/.test(l4)) return { pass: false, why: 'REGRESSION - emphasis broke: ' + l4 };
    return { pass: true };
  },
};

// ---- goal 54: unordered lists -----------------------------------------------------------------
export const probe54 = {
  id: 'goal54.lists',
  goal: 54,
  lead: 's4_markdown.py',
  run(ws) {
    const r = py(ws, [
      'import s4_markdown as m',
      'print(m.to_html("- one\\n- two"))',
      'print(m.to_html("- **b** item"))',
      'print(m.to_html("not a list"))',
      'print(m.to_html("# Head"))',
    ].join('\n'));
    if (r.err) return { pass: false, why: 'threw: ' + r.err.split('\n').pop().slice(0, 90) };
    const [l1, l2, l3, l4] = lines(r.out);
    if (!l1 || l1 !== '<ul><li>one</li><li>two</li></ul>') return { pass: false, why: 'list not rendered on one line: ' + l1 };
    if (!l2 || !/<li><strong>b<\/strong> item<\/li>/.test(l2)) return { pass: false, why: 'items lack inline formatting: ' + l2 };
    if (!l3 || l3 !== '<p>not a list</p>') return { pass: false, why: 'REGRESSION - paragraphs broke: ' + l3 };
    if (!l4 || l4 !== '<h1>Head</h1>') return { pass: false, why: 'REGRESSION - headings broke: ' + l4 };
    return { pass: true };
  },
};

// ---- goal 45: functions in evaluate -----------------------------------------------------------
export const probe45 = {
  id: 'goal45.functions',
  goal: 45,
  lead: 's5_expr.js',
  run(ws) {
    const r = js(ws, [
      'const { evaluate } = require("./s5_expr.js");',
      'const t = (e, v) => { try { return String(evaluate(e)); } catch (x) { return "ERR"; } };',
      'console.log(t("min(3, 1, 2)"));',
      'console.log(t("max(3, 1, 2)"));',
      'console.log(t("abs(0 - 7)"));',
      'console.log(t("sqrt(9)"));',
      'console.log(t("min(2) + max(5)"));',
      'console.log(t("2 + 3 * 4"));',
      'console.log(t("-2^2"));',
    ].join('\n'));
    if (r.err && !r.out) return { pass: false, why: 'threw: ' + r.err.split('\n').pop().slice(0, 90) };
    const v = lines(r.out);
    const want = ['1', '3', '7', '3', '7', '14', '-4'];
    for (let i = 0; i < want.length; i++) {
      if (v[i] !== want[i]) {
        const which = i < 5 ? 'new function behaviour' : 'REGRESSION in existing evaluator';
        return { pass: false, why: which + ': case ' + i + ' gave ' + v[i] + ', wanted ' + want[i] };
      }
    }
    return { pass: true };
  },
};

// ---- goal 55: error positions -----------------------------------------------------------------
export const probe55 = {
  id: 'goal55.errorpos',
  goal: 55,
  lead: 's5_expr.js',
  run(ws) {
    const r = js(ws, [
      'const { evaluate } = require("./s5_expr.js");',
      'const msg = (e) => { try { evaluate(e); return "NO THROW"; } catch (x) { return String(x.message); } };',
      'console.log(msg("2 + * 3"));',
      'console.log(msg("(1+2"));',
      'console.log(msg("1 + 2 + 2 + $"));',
      'console.log(String(evaluate("2 + 3 * 4")));',
    ].join('\n'));
    if (r.err && !r.out) return { pass: false, why: 'threw: ' + r.err.split('\n').pop().slice(0, 90) };
    const v = lines(r.out);
    // Two errors at DIFFERENT offsets, so a hardcoded position cannot pass.
    if (!v[0] || !/\bat 4\b/.test(v[0])) return { pass: false, why: "'2 + * 3' message lacks 'at 4': " + v[0] };
    if (!v[1] || !/\bat 4\b/.test(v[1])) return { pass: false, why: "'(1+2' message lacks 'at 4': " + v[1] };
    if (!v[2] || !/\bat 12\b/.test(v[2])) return { pass: false, why: "third case lacks 'at 12' (a fixed position cannot pass): " + v[2] };
    if (v[3] !== '14') return { pass: false, why: 'REGRESSION - evaluation broke: ' + v[3] };
    return { pass: true };
  },
};

// ---- browser probes ---------------------------------------------------------------------------
// Driven by probeBrowser.mjs, which owns the server and puppeteer lifecycle.
export const probe49 = {
  id: 'goal49.persistence',
  goal: 49,
  lead: 's9_board.html',
  browser: true,
  async run(page, helpers) {
    const { add, clickOn, cards, reload, storage } = helpers;
    await add('alpha');
    await add('beta');
    await clickOn('s9-todo', 'alpha', 's9-right');
    const before = [await cards('s9-todo'), await cards('s9-doing'), await cards('s9-done')];
    const key = await storage('s9-board');
    if (key === null) return { pass: false, why: 'nothing saved under the key "s9-board"' };
    await reload();
    const after = [await cards('s9-todo'), await cards('s9-doing'), await cards('s9-done')];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      return { pass: false, why: 'state not restored: ' + JSON.stringify(before) + ' -> ' + JSON.stringify(after) };
    }
    // A CHANGE must also persist - otherwise a probe passes on a board that saves once and never updates.
    await clickOn('s9-doing', 'alpha', 's9-del');
    const afterDel = await cards('s9-doing');
    await reload();
    if (JSON.stringify(await cards('s9-doing')) !== JSON.stringify(afterDel)) {
      return { pass: false, why: 'a later change did not persist' };
    }
    return { pass: true };
  },
};

export const probe59 = {
  id: 'goal59.doinglimit',
  goal: 59,
  lead: 's9_board.html',
  browser: true,
  async run(page, helpers) {
    const { add, clickOn, cards, text } = helpers;
    for (const x of ['a', 'b', 'c', 'd']) await add(x);
    for (const x of ['a', 'b', 'c']) await clickOn('s9-todo', x, 's9-right');
    if ((await cards('s9-doing')).length !== 3) return { pass: false, why: 'Doing did not accept its first three cards' };
    const doingBefore = await cards('s9-doing');
    const todoBefore = await cards('s9-todo');
    await clickOn('s9-todo', 'd', 's9-right');
    if (JSON.stringify(await cards('s9-doing')) !== JSON.stringify(doingBefore)) {
      return { pass: false, why: 'a 4th card entered Doing' };
    }
    if (JSON.stringify(await cards('s9-todo')) !== JSON.stringify(todoBefore)) {
      return { pass: false, why: 'the rejected card moved anyway' };
    }
    if ((await text('#s9-msg')) !== 'Doing is full') {
      return { pass: false, why: 's9-msg did not say "Doing is full": ' + JSON.stringify(await text('#s9-msg')) };
    }
    // The next action that SUCCEEDS must clear the message.
    await clickOn('s9-doing', 'a', 's9-right');
    if ((await text('#s9-msg')) !== '') {
      return { pass: false, why: 'the message was not emptied by a successful action: ' + JSON.stringify(await text('#s9-msg')) };
    }
    // Other columns must NOT be capped by the same rule.
    for (const x of ['e', 'f', 'g', 'h']) await add(x);
    if ((await cards('s9-todo')).length < 4) return { pass: false, why: 'To Do was capped too - the limit is not specific to Doing' };
    return { pass: true };
  },
};

export const PROBES = [probe44, probe45, probe49, probe54, probe55, probe59];
export const probeFor = (goal) => PROBES.find((p) => p.goal === goal) || null;
