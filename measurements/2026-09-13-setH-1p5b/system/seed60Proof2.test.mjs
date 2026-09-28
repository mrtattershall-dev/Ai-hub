// BEHAVIOURAL PROOFS FOR THE POST-GOAL-60 SEED - the remaining five files.
//
// Same standard as seed60Proof.test.mjs: every assertion comes from the literal wording or worked
// examples of goals 1-60, and each file is checked for its NEW deltas AND for the earlier behaviour
// that must survive them.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, statSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const require = createRequire(import.meta.url);

let pass = 0;
let fail = 0;
const t = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '   got ' + JSON.stringify(detail) : '')); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Workspace = post-40 seed overlaid with post-60 files, exactly as the seed will ship.
const ws = mkdtempSync(join(tmpdir(), 'p60b-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
for (const f of readdirSync(join(HERE, 'seed'))) {
  const p = join(HERE, 'seed', f);
  if (statSync(p).isFile()) copyFileSync(p, join(ws, f));
}
for (const f of readdirSync(join(HERE, 'seed60'))) copyFileSync(join(HERE, 'seed60', f), join(ws, f));

const py = (code) => {
  writeFileSync(join(ws, '_p.py'), code, 'utf8');
  const r = spawnSync('python', [join(ws, '_p.py')], { cwd: ws, encoding: 'utf8', timeout: 30000 });
  return (String(r.stdout || '') + String(r.stderr || '')).trim();
};

console.log('  s2_logs.py  goals 42 + 52\n');
{
  const out = py([
    'import s2_logs as m',
    'L = \'127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /a HTTP/1.1" 200 100 0.100\'',
    'L2 = \'1.2.3.4 - - [10/Oct/2023:13:10:00 +0000] "GET /b HTTP/1.1" 500 - 0.200\'',
    'L3 = \'1.2.3.4 - - [11/Nov/2024:09:00:00 +0000] "POST /c HTTP/1.1" 200 50 0.300\'',
    'e = m.parse_log("\\n".join([L, L2, L3]))',
    'print("REG", m.status_counts(e) == {200: 2, 500: 1}, m.error_rate(e) == round(1/3, 4))',
    'print("P50", m.percentile(e, 50) == 0.2)',
    'print("P100", m.percentile(e, 100) == 0.3)',
    'print("P1", m.percentile(e, 1) == 0.1)',
    'ok = False',
    'try:',
    '    m.percentile(e, 0)',
    'except ValueError:',
    '    ok = True',
    'print("P0RAISES", ok)',
    'ok = False',
    'try:',
    '    m.percentile([], 50)',
    'except ValueError:',
    '    ok = True',
    'print("PEMPTY", ok)',
    'print("HOUR", m.by_hour(e) == {"2023-10-10 13": 100, "2024-11-11 09": 50})',
  ].join('\n'));
  const got = (k) => new RegExp(k + ' True').test(out) || new RegExp(k + ' True True').test(out);
  t('goals 22 survive: status_counts and error_rate', /REG True True/.test(out), out.slice(0, 90));
  t('goal 42: nearest-rank 50th percentile', got('P50'), out);
  t('goal 42: 100th percentile is the largest value', got('P100'), out);
  t('goal 42: a tiny p gives the smallest value', got('P1'), out);
  t('goal 42: p = 0 raises ValueError', got('P0RAISES'), out);
  t('goal 42: no values raises ValueError', got('PEMPTY'), out);
  t('goal 52: by_hour keys are YYYY-MM-DD HH with bytes summed, "-" counted as 0', got('HOUR'), out);
}

console.log('\n  s4_markdown.py  goals 44 + 54 (merged)\n');
{
  const out = py([
    'import s4_markdown as m',
    'print("LINK", m.to_html("see [docs](http://x/a)") == \'<p>see <a href="http://x/a">docs</a></p>\')',
    'print("QUOT", "&quot;" in m.to_html(\'[t](http://x/?q=")\'))',
    'print("NOTLINK", "<a " not in m.to_html("a [bracket] and (parens)"))',
    'print("LIST", m.to_html("- one\\n- two") == "<ul><li>one</li><li>two</li></ul>")',
    'print("LISTFMT", m.to_html("- **b** x") == "<ul><li><strong>b</strong> x</li></ul>")',
    'print("LISTLINK", m.to_html("- see [d](u)") == \'<ul><li>see <a href="u">d</a></li></ul>\')',
    'print("LISTEND", m.to_html("- a\\n\\nafter") == "<ul><li>a</li></ul>\\n<p>after</p>")',
    'print("PARA", m.to_html("a\\nb") == "<p>a b</p>")',
    'print("HEAD", m.to_html("# T") == "<h1>T</h1>")',
    'print("EMPH", m.to_html("**b** and *i*") == "<p><strong>b</strong> and <em>i</em></p>")',
    'print("CODE", m.to_html("`a*b*c`") == "<p><code>a*b*c</code></p>")',
    'print("CODELINK", m.to_html("`[x](y)`") == "<p><code>[x](y)</code></p>")',
  ].join('\n'));
  const g = (k) => new RegExp(k + ' True').test(out);
  t('goal 44: links render', g('LINK'), out.slice(0, 120));
  t('goal 44: a quote in the url becomes &quot;', g('QUOT'));
  t('goal 44: plain brackets are not links', g('NOTLINK'));
  t('goal 54: a list renders on one line', g('LIST'));
  t('goal 54: items get inline formatting', g('LISTFMT'));
  t('INTERACTION 44+54: a list item may contain a link', g('LISTLINK'));
  t('goal 54: a blank line ends the list', g('LISTEND'));
  t('goal 4 survives: paragraphs', g('PARA'));
  t('goal 14 survives: headings', g('HEAD'));
  t('goal 24 survives: emphasis', g('EMPH'));
  t('goal 34 survives: inline code', g('CODE'));
  t('INTERACTION 34+44: link syntax inside code is NOT a link', g('CODELINK'));
}

console.log('\n  s5_expr.js  goals 45 + 55 (merged)\n');
{
  const { evaluate } = require(join(ws, 's5_expr.js'));
  const msg = (e) => { try { evaluate(e); return 'NO THROW'; } catch (x) { return String(x.message); } };
  t('goal 45: min with several args', evaluate('min(3, 1, 2)') === 1);
  t('goal 45: max', evaluate('max(3, 1, 2)') === 3);
  t('goal 45: abs and sqrt', evaluate('abs(0 - 7)') === 7 && evaluate('sqrt(9)') === 3);
  t('goal 45: a single argument works', evaluate('min(2) + max(5)') === 7);
  t('goal 45: nested calls', evaluate('max(min(4, 9), 2)') === 4);
  t('goal 55: position of the first unparseable character', /\bat 4\b/.test(msg('2 + * 3')), msg('2 + * 3'));
  t('goal 55: end-of-input reports the input length', /\bat 4\b/.test(msg('(1+2')), msg('(1+2'));
  t('goal 55: a DIFFERENT offset is reported (no hardcoding)', /\bat 12\b/.test(msg('1 + 2 + 2 + $')), msg('1 + 2 + 2 + $'));
  t('INTERACTION 35+55: an unknown NAME still names it, and carries a position',
    /y/.test(msg('y + 1')) && /at 0/.test(msg('y + 1')), msg('y + 1'));
  t('INTERACTION 45+55: an unknown FUNCTION is distinguishable from a variable',
    /unknown function/.test(msg('nope(1)')), msg('nope(1)'));
  t('goal 5 survives: precedence', evaluate('2 + 3 * 4') === 14);
  t('goal 15 survives: parens and unary', evaluate('-(2+3)*2') === -10 && evaluate('2*-3') === -6);
  t('goal 25 survives: power', evaluate('2^3^2') === 512 && evaluate('-2^2') === -4);
  t('goal 35 survives: variables', evaluate('x + 1', { x: 41 }) === 42);
  t('goal 5 survives: division by zero throws', msg('1/0').includes('division by zero'));
}

console.log('\n  s6_graph.py  goals 46 + 56\n');
{
  const out = py([
    'import s6_graph as m',
    'g = m.Graph()',
    'g.add_edge("b", "c"); g.add_edge("a", "c"); g.add_edge("a", "b")',
    'print("TOPO", g.topo_order() == ["a", "b", "c"])',
    'h = m.Graph()',
    'h.add_node("z"); h.add_node("y"); h.add_node("x")',
    'print("TOPOSMALL", h.topo_order() == ["x", "y", "z"])',
    'c = m.Graph(); c.add_edge("p", "q"); c.add_edge("q", "p")',
    'ok = False',
    'try:',
    '    c.topo_order()',
    'except ValueError:',
    '    ok = True',
    'print("TOPOCYCLE", ok)',
    'r = m.Graph(); r.add_edge("x", "y"); r.add_edge("z", "y"); r.add_edge("y", "w")',
    'r.remove_node("y")',
    'print("RM", r.nodes() == ["w", "x", "z"] and r.neighbors("x") == [] and r.neighbors("z") == [])',
    'ok = False',
    'try:',
    '    r.remove_node("nope")',
    'except KeyError:',
    '    ok = True',
    'print("RMKEY", ok)',
    'print("REG", r.bfs("x") == ["x"] and r.has_cycle() is False)',
  ].join('\n'));
  const g = (k) => new RegExp(k + ' True').test(out);
  t('goal 46: topological order', g('TOPO'), out.slice(0, 100));
  t('goal 46: the SMALLEST ready node is always taken next', g('TOPOSMALL'));
  t('goal 46: a cycle raises ValueError', g('TOPOCYCLE'));
  t('goal 56: remove_node drops the node and every edge to it', g('RM'));
  t('goal 56: an unknown node raises KeyError', g('RMKEY'));
  t('goals 16/36 survive after a removal', g('REG'));
}

console.log('\n  s8_grades.py  goals 48 + 58\n');
{
  const out = py([
    'import s8_grades as m',
    'g = m.Gradebook(); g.add_student("a")',
    'for i, mx in enumerate([10, 10, 10], start=1): g.add_assignment("q%d" % i, mx, "quiz")',
    'g.record("a", "q1", 2); g.record("a", "q2", 9); g.record("a", "q3", 10)',
    'print("BASE", g.percent("a") == round(21/30*100, 2))',
    'g.drop_lowest("quiz", 1)',
    'print("DROP", g.percent("a") == round(19/20*100, 2))',
    'h = m.Gradebook(); h.add_student("b"); h.add_assignment("only", 10, "quiz")',
    'h.record("b", "only", 5); h.drop_lowest("quiz", 1)',
    'print("NODROP", h.percent("b") == 50.0)',
    'k = m.Gradebook(); k.add_student("c")',
    'k.add_assignment("a1", 10); k.add_assignment("a2", 10)',
    'k.record("c", "a1", 10)',
    'print("MISSOFF", k.percent("c") == 100.0)',
    'k.set_missing_zero(True)',
    'print("MISSON", k.percent("c") == 50.0)',
    'k.set_missing_zero(False)',
    'print("MISSBACK", k.percent("c") == 100.0)',
    'j = m.Gradebook(); j.add_student("d")',
    'for i in (1, 2, 3): j.add_assignment("x%d" % i, 10, "quiz")',
    'j.record("d", "x1", 10); j.record("d", "x2", 10)',
    'j.set_missing_zero(True); j.drop_lowest("quiz", 1)',
    'print("BOTH", j.percent("d") == 100.0)',
    'print("REG", m.letter(90) == "A" and m.letter(59) == "F")',
  ].join('\n'));
  const g = (k) => new RegExp(k + ' True').test(out);
  t('goal 38 survives: base percent', g('BASE'), out.slice(0, 120));
  t('goal 48: drop_lowest ignores the n lowest by percentage', g('DROP'));
  t('goal 48: NO drop when the student has only n scores', g('NODROP'));
  t('goal 58: default keeps existing behaviour', g('MISSOFF'));
  t('goal 58: missing-zero counts every assignment', g('MISSON'));
  t('goal 58: turning it back off restores the old answer', g('MISSBACK'));
  t('INTERACTION 48+58: a missing-zero score is itself droppable', g('BOTH'));
  t('goal 28 survives: letter()', g('REG'));
}

console.log('\n  s10_desk.js  goals 50 + 60\n');
{
  const desk = require(join(ws, 's10_desk.js'));
  const { Library } = require(join(ws, 's1_library.js'));
  const { Cache } = require(join(ws, 's7_cache.js'));
  const l = new Library();
  l.addBook('a', 'Dune', 1);
  l.addBook('b', 'Anathem', 1);
  t('goal 10 survives: shelfLine', desk.shelfLine(l) === 'Anathem, Dune');
  l.checkout('a', 'ann', 0);
  l.checkout('b', 'bob', 0);
  t('goal 20 survives: availability', desk.availability(l, 'a') === '0/1');
  t('goal 30 survives: memberLine', desk.memberLine(l, 'ann') === 'ann: a');
  t('goal 50: no overdue entries gives an empty string', desk.overdueLines(l, 10) === '');
  const lines = desk.overdueLines(l, 30);
  t('goal 50: one line per overdue entry, in library.overdue order',
    lines === 'ann owes a (16 days)\nbob owes b (16 days)', JSON.stringify(lines));
  l.returnBook('a', 'ann', 30);
  t('goal 60: nobody with a zero balance appears', desk.fineReport(l, ['bob']) === '');
  t('goal 51 interaction: the return produced a fine', l.fines('ann') === 400, l.fines('ann'));
  t('goal 60: dollars with two decimals', desk.fineReport(l, ['ann']) === 'ann: $4.00', desk.fineReport(l, ['ann']));
  const l2 = new Library();
  l2.addBook('x', 'X', 3);
  for (const [who, day] of [['zoe', 0], ['amy', 0], ['bea', 0]]) l2.checkout('x', who, day);
  l2.returnBook('x', 'zoe', 20);   // 6 late -> 150
  l2.returnBook('x', 'amy', 30);   // 16 late -> 400
  l2.returnBook('x', 'bea', 20);   // 6 late -> 150
  t('goal 60: sorted by amount desc, then by name',
    desk.fineReport(l2, ['zoe', 'amy', 'bea']) === 'amy: $4.00\nbea: $1.50\nzoe: $1.50',
    JSON.stringify(desk.fineReport(l2, ['zoe', 'amy', 'bea'])));
  t('goal 40 survives: makeLookup memoises', (() => {
    const c = new Cache(4);
    const f = desk.makeLookup(l2, c);
    const a = f('x');
    return a === f('x') && c.has('x');
  })());
}

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
