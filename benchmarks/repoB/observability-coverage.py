import json, os, types
root='benchmarks/repoB/pristine/packaging'
sweep=json.load(open('benchmarks/repoB/sweep.json'))
reached=set(sweep['reachedLines'])

def call_time_lines(code, top=True):
    """Lines Python can emit a trace event for, from the code objects that run at CALL time.
    The module-level code object is excluded: it runs at import, before the tracer is installed, so it
    is structurally unobservable by this instrument and must not sit in the denominator."""
    out=set()
    if not top:
        for (_s,_e,ln) in code.co_lines():
            if ln is not None: out.add(ln)
    for c in code.co_consts:
        if isinstance(c, types.CodeType):
            out |= call_time_lines(c, top=False)
    return out

tot=0;hit=0;per=[];orphan=[]
for f in sorted(os.listdir(root)):
    if not f.endswith('.py'): continue
    mod=f[:-3]
    src=open(os.path.join(root,f),encoding='utf-8').read()
    lines=call_time_lines(compile(src,f,'exec'))
    h=sum(1 for l in lines if (mod+':'+str(l)) in reached)
    got={l for l in reached if l.startswith(mod+':')}
    orphan += [l for l in got if int(l.split(':')[1]) not in lines]
    tot+=len(lines);hit+=h;per.append((mod,h,len(lines)))
per.sort(key=lambda r:-(r[1]/max(r[2],1)))
for m,h,t in per: print('  %-22s %4d/%-4d  %5.1f%%'%(m,h,t,100*h/max(t,1)))
print('')
print('CALL-TIME LINE OBSERVABILITY: %d/%d = %.1f%%'%(hit,tot,100*hit/tot))
print('reached-but-not-in-denominator: %d  %s'%(len(orphan),sorted(orphan)[:5]))
