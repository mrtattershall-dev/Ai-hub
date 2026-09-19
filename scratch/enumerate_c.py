"""Mechanical Repo C enumeration. Boring properties only.

Importing a third-party package executes its module-level code, which can print. The first version of
this script lost its JSON to PIL's feature report - the run-0 channel-pollution class exactly. So every
import happens with stdout AND stderr captured, and the result is written to a FILE rather than a stream
anything else can write to.
"""
import contextlib, doctest, importlib, io, json, os, pkgutil, sys, types

OUT = 'benchmarks/repoC_candidates.json'
BURNED = {'packaging'}
STDLIB = set(sys.stdlib_module_names)
MIN_DOCTESTS, MIN_LINES, MAX_LINES = 20, 500, 20000

sink = io.StringIO()


def traceable_lines(path):
    try:
        src = open(path, encoding='utf-8').read()
        code = compile(src, path, 'exec')
    except BaseException:
        return 0

    def walk(c, top):
        n = 0
        if not top:
            n += len({ln for (_s, _e, ln) in c.co_lines() if ln is not None})
        for k in c.co_consts:
            if isinstance(k, types.CodeType):
                n += walk(k, False)
        return n
    return walk(code, True)


rows = []
for m in pkgutil.iter_modules():
    name = m.name
    if not m.ispkg or name in BURNED or name in STDLIB or name.startswith('_'):
        continue
    try:
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            mod = importlib.import_module(name)
    except BaseException:
        continue
    path = getattr(mod, '__path__', None)
    if not path:
        continue
    root = list(path)[0]
    pys = []
    for dirpath, _d, files in os.walk(root):
        for f in files:
            if f.endswith('.py'):
                pys.append(os.path.join(dirpath, f))
    if not pys:
        continue
    lines = sum(traceable_lines(p) for p in pys)
    finder = doctest.DocTestFinder(exclude_empty=True)
    ex = 0
    try:
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            for t in finder.find(mod, name):
                ex += len(t.examples)
            for sub in pkgutil.walk_packages(path, name + '.'):
                try:
                    sm = importlib.import_module(sub.name)
                    for t in finder.find(sm, sub.name):
                        ex += len(t.examples)
                except BaseException:
                    continue
    except BaseException:
        pass
    rows.append({'name': name, 'files': len(pys), 'doctests': ex, 'lines': lines,
                 'root': root,
                 'eligible': ex >= MIN_DOCTESTS and MIN_LINES <= lines <= MAX_LINES})

rows.sort(key=lambda r: (-r['doctests'], r['name']))
with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump({'criteria': {'min_doctests': MIN_DOCTESTS, 'min_lines': MIN_LINES,
                            'max_lines': MAX_LINES, 'burned': sorted(BURNED)},
               'candidates': rows}, fh, indent=1)
print('wrote ' + OUT + ' with ' + str(len(rows)) + ' candidates')
