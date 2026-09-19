"""Diagnose the two Repo C observation failures. Measurement only - r3 is not modified."""
import io, json, subprocess, sys, contextlib, importlib

sys.path.insert(0, 'benchmarks/repoC/pristine')

# H1: SETUP_FAILED:NameError - does CPython's own doctest ALSO fail these, i.e. is it the CORPUS?
import doctest
sink = io.StringIO()
with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
    import pyparsing
    import pyparsing.actions as actions
finder = doctest.DocTestFinder(exclude_empty=True)
runner = doctest.DocTestRunner(verbose=False)
out = io.StringIO()
for t in finder.find(actions, 'pyparsing.actions'):
    runner.run(t, out=out.write)
r = runner.summarize(verbose=False)
print('H1 CPython doctest on pyparsing.actions:')
print('    attempted=%d  failed=%d' % (r.attempted, r.failed))
print('    -> if failed>0 the docstrings are ILLUSTRATIVE, not runnable: a corpus property')

# H2: does an invocation that PRINTS corrupt r3's observe() JSON channel?
print('')
print('H2 does stdout from the invocation corrupt the witness channel?')
prog = (
    'import sys, json\n'
    'print("CONTAMINATION")\n'
    'print(json.dumps({"status": "OK"}))\n'
)
p = subprocess.run([sys.executable, '-c', prog], capture_output=True, text=True)
raw = p.stdout
print('    raw stdout: ' + repr(raw[:60]))
try:
    json.loads(raw)
    print('    JSON.parse would SUCCEED')
except Exception as e:
    print('    JSON.parse would FAIL: ' + type(e).__name__)
    print('    -> any doctest example that prints makes observe() return null -> UNOBSERVABLE')
