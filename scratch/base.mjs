import { surveyFrontier } from '../legasus/legaexercise/survey.mjs';
const { frontier, runs } = surveyFrontier({ rootDir: 'benchmarks/repoB/pristine', packageName: 'packaging' });
const t = {}; for (const f of Object.values(frontier)) t[f.state] = (t[f.state]||0)+1;
console.log('subjects:', Object.keys(frontier).length, JSON.stringify(t));
console.log('assertions: held', runs.filter(r=>r.held===true).length, 'failed', runs.filter(r=>r.held===false).length, 'none', runs.filter(r=>r.held===null).length);
for (const k of ['utils.parse_wheel_filename','utils.parse_sdist_filename','utils.canonicalize_name','tags.sys_tags','tags.platform_tags','tags.cpython_tags'])
  console.log(' ', k.padEnd(28), frontier[k] ? frontier[k].state + '  held=' + frontier[k].held : 'ABSENT');
console.log('FAILED subjects:', Object.values(frontier).filter(f=>f.state==='FALSIFIED').map(f=>f.subject).join(', ') || '(none)');
