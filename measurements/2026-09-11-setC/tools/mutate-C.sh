#!/bin/bash
# mutate-C.sh : proves checks-C.mjs catches regressions. Each mutant = refs/ + one planted bug;
# the listed goals must fail (and, for the own-test mutants, show CT: impl passes, as-is fails).
D=C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-11-setC
T=$(mktemp -d)
mut() { # name file sed-expr expect
  rm -rf "$T/w"; cp -r "$D/refs" "$T/w"
  if [ "$2" = APPEND ]; then printf '%s\n' "$3" >> "$T/w/$4"; want=$5; else sed -i "$3" "$T/w/$2"; want=$4; fi
  got=$(node "$D/tools/checks-C.mjs" "$T/w" | grep -E '^ ?[0-9]+ (fail|CT)' | awk '{print $1":"$2}' | tr '\n' ' ')
  printf '%-34s want %-18s got %s\n' "$1" "$want" "$got"
}
mut "transfer not all-or-nothing"  s1_bank.js 's/this._amt(amount); const a = this._acct(from); const b = this._acct(to);/this._amt(amount); const a = this._acct(from); a.balance -= amount; a.balance += amount; if (amount <= a.balance) a.balance -= amount; const b = this._acct(to); a.balance += amount;/' "3:fail"
mut "failed withdraw in history"   s1_bank.js 's/if (amount > a.balance) throw new Error(.insufficient funds.); a.balance -= amount; a.history.push({ type: .withdraw., amount });/a.history.push({ type: "withdraw", amount }); if (amount > a.balance) throw new Error("insufficient funds"); a.balance -= amount;/' "4:fail"
mut "notes omit transfer"          S1_NOTES.md '/transfer(from/d' "5:fail"
mut "apostrophe split (step 3 undone)" s2_text.py "s/(?:'\[a-z0-9\]+)\*//" "8:fail"
mut "CLI runs on import"           s2_text.py 's/^if __name__ == "__main__":/if True:/' "10:fail"
mut "emit stops at first throw"    s3_events.js 's/try { x.fn(...args); } catch (e) { if (!first) first = e; }/x.fn(...args);/' "14:fail"
mut "once not removed"             s3_events.js 's/if (x.once) {/if (false) {/' "13:fail 15:fail"
mut "no matrix validation"         s4_matrix.js 's/for (const v of row) if (typeof v/for (const v of []) if (typeof v/' "20:fail"
mut "get does not refresh LRU"     s5_cache.js 's/this.map.delete(key); this.map.set(key, e); this.s.hits++;/this.s.hits++;/' "21:fail"
mut "delete counts as miss"        s5_cache.js 's/delete(key) { return this.map.delete(key); }/delete(key) { this.s.misses++; return this.map.delete(key); }/' "24:fail"
mut "power left-associative"       s6_parser.js 's/return b \*\* unary();/return b ** primary();/' "30:fail"
mut "ids reused after load"        s7_todo.py 's/t._next = data\["next"\]/t._next = 1/' "33:fail"
mut "no 405"                       s8_router.js "s/return pathMatched ? '405' : '404';/return '404';/" "40:fail"
mut "wildcard matches bare /files" s8_router.js 's/if (segs.length <= i) return null; //' "38:fail"
mut "JS own assert wrong -> CT"    APPEND "require('assert').strictEqual(1, 2);" s3_events.js "11-15:CT"
mut "PY own assert wrong -> CT"    APPEND "assert 1 == 2, 'own test wrong'" s7_todo.py "31-35:CT"
rm -rf "$T"
