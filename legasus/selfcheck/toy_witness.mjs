// A witness in the shape BIND-1 recognises: one `PASS|FAIL <id>` line per case.
// Known answers:
//   - "big clamps"     exercises the > 10 branch          -> should discriminate INVERT/DROP/BOUNDARY there
//   - "small passes"   exercises the else branch
//   - "string is -1"   exercises the catch                -> should discriminate EXCEPTION mutants
//   - "untouched"      never calls clamp                  -> NOT_EXECUTED under every mutant
//   - "deliberately wrong" FAILS at baseline              -> BASELINE_INVALID, never counted
import { clamp, untouched } from './toy.js';

const t = (id, ok) => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${id}`);
t('big clamps', clamp(50) === 10);
t('small passes', clamp(3) === 3);
t('string is -1', clamp('x') === -1);
t('untouched', untouched(2) === 4);
t('deliberately wrong', clamp(1) === 999);
