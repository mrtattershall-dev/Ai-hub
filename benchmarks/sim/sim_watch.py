#!/usr/bin/env python3
"""SIM watcher — SIM-0 (healthy world, observe only) and SIM-1 (injected mutants).

Frozen definition: SIM-0_SIM-1_PREREG.md (committed before this file existed).

    python3 sim_watch.py sim0      -> JSON verdict on stdout
    python3 sim_watch.py sim1      -> JSON verdict on stdout

DOCTRINE: observe from outside. The checker reads only raw world state (grid.cells) and declared config
(rows, cols, topology, birth, survival) and computes every expected value with its OWN implementation,
written from the Grid docstrings/comments - it never calls a Grid method to decide whether Grid is right.
Each invariant is also isolated from the others' machinery: known patterns are placed with coordinates the
checker computes itself, not with load_pattern, so a load_pattern bug cannot mask or fake a known-pattern
result.
"""
import hashlib
import json
import os
import platform
import random
import sys
import time
import types

HERE = os.path.dirname(os.path.abspath(__file__))
VENDOR = os.path.join(HERE, 'vendor')
sys.path.insert(0, VENDOR)
from life.patterns import PATTERNS  # noqa: E402  (pattern shapes are DATA, read directly)

GRID_PATH = os.path.join(VENDOR, 'life', 'grid.py')
with open(GRID_PATH, encoding='utf-8') as fh:
    GRID_SRC = fh.read().replace('\r\n', '\n')   # normalise so mutant anchors cannot miss on CRLF
GRID_SHA = hashlib.sha256(GRID_SRC.encode()).hexdigest()[:16]

INVARIANTS = ['I-GEN', 'I-POP', 'I-TRANS', 'I-RESET', 'I-PATTERN', 'I-HASHFN', 'I-HASHPAIR', 'I-KNOWN']
TOPOS = ['plane', 'torus', 'klein_bottle', 'mobius_strip', 'projective_plane']
RULES = {'B3/S23': ({3}, {2, 3}), 'B36/S23': ({3, 6}, {2, 3}), 'B2/S': ({2}, set())}


def load_grid_class(src, name):
    mod = types.ModuleType(name)
    mod.__file__ = GRID_PATH
    exec(compile(src, '<' + name + '>', 'exec'), mod.__dict__)
    return mod.Grid


# ── THE ORACLE — written from the docstrings, not from the method bodies ─────────────────────────────
def o_wrap(topo, rows, cols, r, c, reading):
    """plane: off-grid is dead. torus: both axes modulo. klein_bottle: columns wrap normally, rows wrap with
    a horizontal flip. mobius_strip: rows have hard edges, columns wrap with a vertical flip.
    projective_plane: both axes wrap with a flip on the opposite axis; a neighbour outside BOTH axes is
    ambiguous in the spec - reading 'A' processes the row crossing first, reading 'B' the column crossing."""
    inr, inc = 0 <= r < rows, 0 <= c < cols
    if topo == 'torus':
        return r % rows, c % cols
    if topo == 'plane':
        return (r, c) if inr and inc else None
    if topo == 'klein_bottle':
        nc = c % cols
        return (r, nc) if inr else (r % rows, cols - 1 - nc)
    if topo == 'mobius_strip':
        if not inr:
            return None
        return (r, c) if inc else (rows - 1 - r, c % cols)
    if topo == 'projective_plane':
        if inr and inc:
            return r, c
        if not inr and inc:
            return r % rows, cols - 1 - c
        if inr and not inc:
            return rows - 1 - r, c % cols
        if reading == 'A':
            return r % rows, (cols - 1 - c) % cols
        return (rows - 1 - r) % rows, c % cols
    raise ValueError('unknown topology ' + str(topo))


def o_next(cells, rows, cols, topo, birth, survival, reading='A'):
    """Next world: a live cell with n neighbours in `survival` survives and ages by 1; a dead cell with n
    neighbours in `birth` is born with age 1; everything else is dead (Grid comments: value = age in gens)."""
    new = [[0] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            n = 0
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    m = o_wrap(topo, rows, cols, r + dr, c + dc, reading)
                    if m is not None and cells[m[0]][m[1]] > 0:
                        n += 1
            v = cells[r][c]
            if v > 0 and n in survival:
                new[r][c] = v + 1
            elif v == 0 and n in birth:
                new[r][c] = 1
    return new


def live(cells):
    return frozenset((r, c) for r, row in enumerate(cells) for c, v in enumerate(row) if v > 0)


def placed(name, rows, cols, dr, dc):
    return frozenset(((r + dr) % rows, (c + dc) % cols) for r, c in PATTERNS[name]['cells'])


# ── the watcher's record ─────────────────────────────────────────────────────────────────────────────
class Watch:
    def __init__(self):
        self.evals = {k: 0 for k in INVARIANTS}
        self.alarm_count = {k: 0 for k in INVARIANTS + ['CRASH']}
        self.first = {}          # invariant -> first place it fired (latency)
        self.sample = []
        self.reading = {'A': 0, 'B': 0, 'both': 0}
        self.telemetry = []

    def check(self, inv, ok, where, detail=''):
        self.evals[inv] += 1
        if not ok:
            self.alarm(inv, where, detail)

    def alarm(self, inv, where, detail=''):
        self.alarm_count[inv] += 1
        self.first.setdefault(inv, where)
        if len(self.sample) < 40:
            self.sample.append({'inv': inv, 'where': where, 'detail': str(detail)[:220]})

    def total_alarms(self):
        return sum(self.alarm_count.values())


def new_grid(Grid, rows, cols, topo, rule):
    g = Grid(rows, cols)
    g.topology = topo
    g.birth, g.survival = set(RULES[rule][0]), set(RULES[rule][1])
    return g


# ── scenarios ────────────────────────────────────────────────────────────────────────────────────────
def soup_run(Grid, w, rows, cols, topo, rule, seed, ticks, telemetry=False):
    where0 = 'soup %dx%d %s %s seed=%d' % (rows, cols, topo, rule, seed)
    rnd = random.Random(seed)
    try:
        g = new_grid(Grid, rows, cols, topo, rule)
        for r in range(rows):
            for c in range(cols):
                if rnd.random() < 0.35:
                    g.set_alive(r, c)
        w.check('I-POP', g.population == len(live(g.cells)), where0 + ' after seeding',
                'population=%s counted=%s' % (g.population, len(live(g.cells))))
    except Exception as e:  # noqa: BLE001
        w.alarm('CRASH', where0 + ' setup', repr(e))
        return
    seen_h, seen_s = {}, {}
    birth, survival = set(g.birth), set(g.survival)
    for t in range(1, ticks + 1):
        where = where0 + ' tick=%d' % t
        prev = [row[:] for row in g.cells]
        gen0 = g.generation
        try:
            g.step()
            h = g.state_hash()
        except Exception as e:  # noqa: BLE001
            w.alarm('CRASH', where, repr(e))
            return
        cells = g.cells
        w.check('I-GEN', g.generation == gen0 + 1, where, 'generation %s -> %s' % (gen0, g.generation))
        s = live(cells)
        w.check('I-POP', g.population == len(s), where, 'population=%s counted=%s' % (g.population, len(s)))
        exp_a = o_next(prev, rows, cols, topo, birth, survival, 'A')
        ok_a = cells == exp_a
        ok_b = ok_a
        if topo == 'projective_plane':
            exp_b = o_next(prev, rows, cols, topo, birth, survival, 'B')
            ok_b = cells == exp_b
            if ok_a and ok_b:
                w.reading['both'] += 1
            elif ok_a:
                w.reading['A'] += 1
            elif ok_b:
                w.reading['B'] += 1
        ok = ok_a or ok_b
        detail = ''
        if not ok:
            diff = [(r, c, prev[r][c], cells[r][c], exp_a[r][c]) for r in range(rows) for c in range(cols) if cells[r][c] != exp_a[r][c]]
            detail = 'cells differ at %d position(s); first (r,c,before,grid,expected)=%s' % (len(diff), diff[:3])
        w.check('I-TRANS', ok, where, detail)
        # I-HASHFN: the hash must be a function of the live-cell positions, and injective on what we saw
        prior_h = seen_s.get(s)
        prior_s = seen_h.get(h)
        w.check('I-HASHFN', (prior_h is None or prior_h == h) and (prior_s is None or prior_s == s), where,
                'same positions gave a different hash' if prior_h not in (None, h) else 'different positions gave the same hash')
        seen_s[s] = h
        seen_h[h] = s
        if telemetry and t <= 10:
            w.telemetry.append({'mode': 'grid', 'topology': topo, 'rule': rule, 'tick': t, 'generation': g.generation,
                                'population': g.population, 'stateHash': h[:12],
                                'invariants': {'generationIncrements': g.generation == gen0 + 1,
                                               'populationMatchesCells': g.population == len(s),
                                               'transitionMatchesRule': ok}})


def api_ops(Grid, w, rows, cols, seed, nops):
    where0 = 'api %dx%d seed=%d' % (rows, cols, seed)
    rnd = random.Random(seed)
    names = sorted(PATTERNS)
    try:
        g = new_grid(Grid, rows, cols, 'torus', 'B3/S23')
    except Exception as e:  # noqa: BLE001
        w.alarm('CRASH', where0 + ' setup', repr(e))
        return
    for i in range(nops):
        op = rnd.choice(['alive', 'alive', 'dead', 'dead', 'toggle', 'toggle', 'pattern', 'clear', 'step'])
        where = where0 + ' op#%d=%s' % (i, op)
        try:
            if op == 'alive':
                g.set_alive(rnd.randrange(rows), rnd.randrange(cols))
            elif op == 'dead':
                g.set_dead(rnd.randrange(rows), rnd.randrange(cols))
            elif op == 'toggle':
                g.toggle(rnd.randrange(rows), rnd.randrange(cols))
            elif op == 'pattern':
                g.load_pattern(rnd.choice(names), rnd.randrange(-rows, 2 * rows), rnd.randrange(-cols, 2 * cols))
            elif op == 'clear':
                g.clear()
                w.check('I-RESET', g.generation == 0 and g.population == 0 and not live(g.cells), where,
                        'after clear: generation=%s population=%s live=%d' % (g.generation, g.population, len(live(g.cells))))
            elif op == 'step':
                g.step()
        except Exception as e:  # noqa: BLE001
            w.alarm('CRASH', where, repr(e))
            return
        w.check('I-POP', g.population == len(live(g.cells)), where,
                'population=%s counted=%s' % (g.population, len(live(g.cells))))


def pattern_placements(Grid, w, rows, cols):
    for name in sorted(PATTERNS):
        for dr, dc in [(0, 0), (rows - 1, cols - 1), (rows - 2, 1), (1, cols - 2), (-1, -1), (rows + 3, cols + 5), (rows // 2, cols // 2)]:
            where = 'pattern %s %dx%d offset=(%d,%d)' % (name, rows, cols, dr, dc)
            try:
                g = new_grid(Grid, rows, cols, 'torus', 'B3/S23')
                g.load_pattern(name, dr, dc)
            except Exception as e:  # noqa: BLE001
                w.alarm('CRASH', where, repr(e))
                continue
            exp = placed(name, rows, cols, dr, dc)
            got = live(g.cells)
            w.check('I-PATTERN', got == exp, where, 'placed %d cells, expected %d; missing %s' % (len(got), len(exp), sorted(exp - got)[:4]))


def hash_pairs(Grid, w, seed):
    rnd = random.Random(seed)
    for i in range(40):
        rows, cols = rnd.choice([(8, 8), (9, 14), (16, 16)])
        k = rnd.randrange(1, 12)
        allpos = [(r, c) for r in range(rows) for c in range(cols)]
        a = rnd.sample(allpos, k)
        b = rnd.sample(allpos, k)
        if set(a) == set(b):
            continue
        where = 'hashpair #%d %dx%d k=%d' % (i, rows, cols, k)
        try:
            g1 = new_grid(Grid, rows, cols, 'torus', 'B3/S23')
            g2 = new_grid(Grid, rows, cols, 'torus', 'B3/S23')
            g3 = new_grid(Grid, rows, cols, 'torus', 'B3/S23')
            for r, c in a:
                g1.set_alive(r, c)
                g3.set_alive(r, c)
            for r, c in b:
                g2.set_alive(r, c)
            # same positions, different ages: write ages directly into the world
            for r, c in a:
                g3.cells[r][c] = rnd.randrange(2, 9)
            h1, h2, h3 = g1.state_hash(), g2.state_hash(), g3.state_hash()
        except Exception as e:  # noqa: BLE001
            w.alarm('CRASH', where, repr(e))
            continue
        w.check('I-HASHPAIR', h1 != h2, where + ' equal-population/different-positions', 'hashes equal: %s' % h1[:12])
        w.check('I-HASHPAIR', h1 == h3, where + ' same-positions/different-ages', 'hashes differ')


def known_patterns(Grid, w):
    """Torus. Placed with checker-computed coordinates (set_alive), never load_pattern."""
    for rows, cols in [(8, 8), (9, 14), (16, 16)]:
        for name, dr, dc in [('blinker', rows - 1, cols - 2), ('block', rows - 1, cols - 1), ('glider', rows - 2, cols - 2)]:
            where0 = 'known %s %dx%d offset=(%d,%d)' % (name, rows, cols, dr, dc)
            try:
                g = new_grid(Grid, rows, cols, 'torus', 'B3/S23')
                start = placed(name, rows, cols, dr, dc)
                for r, c in start:
                    g.set_alive(r, c)
                if name == 'blinker':
                    g.step()
                    one = live(g.cells)
                    g.step()
                    two = live(g.cells)
                    w.check('I-KNOWN', one != start and two == start, where0, 'blinker: after1 changed=%s after2 back=%s' % (one != start, two == start))
                elif name == 'block':
                    for t in range(1, 6):
                        g.step()
                        w.check('I-KNOWN', live(g.cells) == start, where0 + ' tick=%d' % t, 'block moved')
                else:
                    cur = start
                    for t in range(1, 9):
                        for _ in range(4):
                            g.step()
                        nxt = live(g.cells)
                        ok = any(frozenset(((r + a) % rows, (c + b) % cols) for r, c in cur) == nxt for a in (-1, 1) for b in (-1, 1))
                        w.check('I-KNOWN', ok, where0 + ' period=%d' % t, 'glider not a (+-1,+-1) translation of itself after 4 steps')
                        cur = nxt
            except Exception as e:  # noqa: BLE001
                w.alarm('CRASH', where0, repr(e))


def battery(Grid, w, full):
    sizes = [(8, 8), (9, 14), (16, 16)] if full else [(8, 8), (9, 14)]
    rules = list(RULES) if full else ['B3/S23', 'B36/S23']
    seeds = [11, 23, 37, 51] if full else [11, 23]
    ticks = 120 if full else 40
    first = True
    for rows, cols in sizes:
        for topo in TOPOS:
            for rule in rules:
                for seed in seeds:
                    soup_run(Grid, w, rows, cols, topo, rule, seed, ticks, telemetry=first)
                    first = False
    for rows, cols in sizes:
        for seed in seeds:
            api_ops(Grid, w, rows, cols, seed, 300 if full else 150)
        pattern_placements(Grid, w, rows, cols)
    hash_pairs(Grid, w, 7)
    known_patterns(Grid, w)


# ── SIM-1 mutants: exact-once substitutions (frozen in the prereg) ────────────────────────────────────
MUTANTS = [
    ('M1', 'generation frozen', 'self.generation += 1', 'pass  # MUTANT M1', ['I-GEN']),
    ('M2', 'population double-counts', 'new[r][c] = self.cells[r][c] + 1\n                    pop += 1',
     'new[r][c] = self.cells[r][c] + 1\n                    pop += 2', ['I-POP']),
    ('M3', 'clear keeps generation', '    def clear(self):\n        self.cells = [[0] * self.cols for _ in range(self.rows)]\n        self.generation = 0\n',
     '    def clear(self):\n        self.cells = [[0] * self.cols for _ in range(self.rows)]\n', ['I-RESET']),
    ('M4', 'torus wrap broken', '        if topo == self.TOPO_TORUS:\n            return r % rows, c % cols',
     '        if topo == self.TOPO_TORUS:\n            return min(max(r, 0), rows - 1), min(max(c, 0), cols - 1)', ['I-TRANS', 'I-KNOWN']),
    ('M5', 'load_pattern stops wrapping', 'self.set_alive((r + offset_r) % self.rows, (c + offset_c) % self.cols)',
     'self.set_alive(r + offset_r, c + offset_c)', ['I-PATTERN']),
    ('M6', 'hash ignores position', 'alive.append(r * self.cols + c)', 'alive.append(0)', ['I-HASHPAIR']),
    ('M7', 'ages frozen', 'new[r][c] = self.cells[r][c] + 1', 'new[r][c] = self.cells[r][c]', ['I-TRANS']),
    ('M8', 'set_dead leaks population', 'self.population -= 1', 'pass  # MUTANT M8', ['I-POP']),
]


def env():
    return {'python': platform.python_version(), 'platform': platform.platform(), 'gridSha256': GRID_SHA}


def sim0():
    t0 = time.time()
    Grid = load_grid_class(GRID_SRC, 'grid_clean')
    w = Watch()
    battery(Grid, w, full=True)
    unevaluated = [k for k, v in w.evals.items() if v == 0]
    passed = w.total_alarms() == 0 and not unevaluated
    return {'sim': 'SIM-0', 'env': env(), 'pass': passed, 'alarms': w.total_alarms(), 'alarmsByInvariant': w.alarm_count,
            'alarmSample': w.sample, 'evaluations': w.evals, 'unevaluated': unevaluated,
            'projectiveReadingMatched': w.reading, 'telemetrySample': w.telemetry, 'edits': 0,
            'seconds': round(time.time() - t0, 1)}


def sim1():
    t0 = time.time()
    rows_out = []
    caught_by = {k: [] for k in INVARIANTS}
    for mid, name, find, repl, designated in MUTANTS:
        n = GRID_SRC.count(find)
        if n != 1:
            rows_out.append({'id': mid, 'name': name, 'applied': False, 'why': 'anchor occurs %d times, not exactly once' % n})
            continue
        src = GRID_SRC.replace(find, repl)
        try:
            Grid = load_grid_class(src, 'grid_' + mid)
        except Exception as e:  # noqa: BLE001
            rows_out.append({'id': mid, 'name': name, 'applied': True, 'loadError': repr(e)})
            continue
        w = Watch()
        battery(Grid, w, full=False)
        fired = {k: v for k, v in w.alarm_count.items() if v}
        for k in fired:
            if k in caught_by:
                caught_by[k].append(mid)
        rows_out.append({'id': mid, 'name': name, 'applied': True, 'designated': designated,
                         'caughtByDesignated': all(d in fired for d in designated),
                         'fired': fired, 'firstFired': {k: w.first.get(k) for k in fired}})
    all_applied = all(r.get('applied') for r in rows_out)
    all_caught = all(r.get('caughtByDesignated') for r in rows_out)
    never = [k for k, v in caught_by.items() if not v]
    return {'sim': 'SIM-1', 'env': env(), 'pass': all_applied and all_caught and not never,
            'mutants': rows_out, 'invariantKilledBy': caught_by, 'invariantsNeverFired': never,
            'seconds': round(time.time() - t0, 1)}


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'sim0'
    out = sim0() if which == 'sim0' else sim1()
    print(json.dumps(out, indent=1))
