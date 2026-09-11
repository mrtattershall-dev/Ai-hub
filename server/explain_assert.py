"""explain_assert.py - when a model's own Python assert fails, show what each side actually was.

    python -B explain_assert.py <target.py>

Node's assert prints actual-vs-expected; a bare Python `assert f(x) == y` prints only the line.
In the 14B-vs-32B head-to-head, 8 of the 22 times a model's own test failed it was Python, and
the model got no value to reason from - only "AssertionError".

HOW: the same trick as pytest's assertion rewriting. The target is parsed with the stdlib `ast`
and every `assert <comparison>` becomes

    if not (<comparison>):
        __rec(line, [left, right, ...])     # operands evaluated right there, in scope
        raise AssertionError(<message>)

then the rewritten module is executed. Evaluating in place matters: inspecting the frame AFTER
the failure does not work, because `except KeyError as e:` deletes `e` while the exception
unwinds - and the quoted-KeyError test, the one trap BOTH models fell into, asserts on `str(e)`
inside exactly such a block.

Output: the evidence block the hub appends to the run result, for the assert that actually
killed the script (asserts the script catches itself are ignored). Prints nothing when the target
does not die on a comparison assert. Never raises: a helper, not a second failure.
"""
import ast
import os
import sys


def _short(value, limit=300):
    text = repr(value)
    return text if len(text) <= limit else text[:limit] + '...'


class _Rewrite(ast.NodeTransformer):
    def __init__(self, source):
        self.source = source
        self.meta = {}                      # line -> (operand sources, operator names)

    def visit_Assert(self, node):
        if not isinstance(node.test, ast.Compare):
            return node
        test = node.test
        operands = [test.left] + list(test.comparators)
        self.meta[node.lineno] = ([ast.get_source_segment(self.source, o) or '?' for o in operands],
                                  [type(o).__name__ for o in test.ops])
        record = ast.Expr(ast.Call(func=ast.Name('__rec', ast.Load()),
                                   args=[ast.Constant(node.lineno), ast.List(operands, ast.Load())], keywords=[]))
        exc = ast.Name('AssertionError', ast.Load())
        raise_ = ast.Raise(exc=ast.Call(exc, [node.msg], []) if node.msg else exc, cause=None)
        new = ast.If(test=ast.UnaryOp(ast.Not(), node.test), body=[record, raise_], orelse=[])
        return ast.fix_missing_locations(ast.copy_location(new, node))


def explain(target):
    target = os.path.abspath(target)
    try:
        with open(target, encoding='utf-8') as fh:
            source = fh.read()
        rewriter = _Rewrite(source)
        tree = rewriter.visit(ast.parse(source, target))
        code = compile(tree, target, 'exec')
    except Exception:
        return ''

    records = []

    def rec(line, values):
        records.append((line, values))

    sys.path.insert(0, os.path.dirname(target))
    ns = {'__name__': '__main__', '__file__': target, '__builtins__': __builtins__, '__rec': rec}
    try:
        exec(code, ns)
        return ''
    except AssertionError:
        tb = sys.exc_info()[2]
    except BaseException:
        return ''

    # The line that actually killed it: the deepest frame inside the target.
    fatal = None
    while tb is not None:
        if os.path.abspath(tb.tb_frame.f_code.co_filename) == target:
            fatal = tb.tb_lineno
        tb = tb.tb_next
    hit = next((r for r in reversed(records) if r[0] == fatal), None)
    if hit is None or fatal not in rewriter.meta:
        return ''
    line, values = hit
    sources, ops = rewriter.meta[line]
    out = [f'Your assert at {os.path.basename(target)}:{line} failed. Its two sides were:']
    for i, (src, value) in enumerate(zip(sources, values)):
        out.append(f'  {"LEFT " if i == 0 else "RIGHT"} {src}  ->  {_short(value)}')
    out.append(f'  compared with: {", ".join(ops)}')
    return '\n'.join(out)


if __name__ == '__main__':
    if len(sys.argv) == 2:
        try:
            text = explain(sys.argv[1])
        except BaseException:
            text = ''
        if text:
            sys.stdout.write(text + '\n')
