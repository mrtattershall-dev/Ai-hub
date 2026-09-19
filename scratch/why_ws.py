import ast
BS = chr(92)
src = open('benchmarks/devrepo/pristine/textwrap.py', encoding='utf-8').read()
tree = ast.parse(src)
for n in ast.walk(tree):
    if isinstance(n, ast.FunctionDef) and n.name == 'dedent':
        seg = ast.get_source_segment(src, n)
        for i, l in enumerate(seg.split(chr(10)), 1):
            if l.rstrip().endswith(BS):
                print('continuation at line', i, ':', repr(l))
        # now apply the "preserving" transform and see what python says
        damaged = chr(10).join((x + '  ') if x.strip() else x for x in seg.split(chr(10)))
        try:
            ast.parse(damaged)
            print('damaged still parses')
        except SyntaxError as e:
            print('SyntaxError:', e.msg, 'line', e.lineno)
            print('  offending:', repr(damaged.split(chr(10))[e.lineno - 1]))
        break
