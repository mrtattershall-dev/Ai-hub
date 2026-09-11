// Reference solution (final state of chain r8) - used only to prove checks-D.mjs can pass.
const SYM = { USD: '$', EUR: '€', GBP: '£' };
const ints = (xs) => { for (const x of xs) if (!Number.isInteger(x)) throw new Error('amounts must be integer cents: ' + x); };
const roundAway = (x) => Math.sign(x) * Math.round(Math.abs(x));
function parseMoney(text) {
  if (typeof text !== 'string') throw new Error('expected a string');
  let s = text.trim();
  const code = /^(.*\S)\s+([A-Z]{3})$/.exec(s); if (code) s = code[1];
  const m = /^(-)?[$€£]?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new Error('not a money amount: ' + text);
  const cents = Number(m[2].replace(/,/g, '')) * 100 + Number((m[3] || '').padEnd(2, '0'));
  return m[1] ? -cents : cents;
}
function formatMoney(cents, code = 'USD') {
  ints([cents]);
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const pre = SYM[code] !== undefined ? SYM[code] : code + ' ';
  return (cents < 0 ? '-' : '') + pre + whole + '.' + String(abs % 100).padStart(2, '0');
}
function addMoney(...amounts) { ints(amounts); return amounts.reduce((a, b) => a + b, 0); }
function subtractMoney(a, b) { ints([a, b]); return a - b; }
function multiplyMoney(cents, factor) { ints([cents]); return roundAway(cents * factor); }
function splitMoney(cents, n) { ints([cents, n]); const base = Math.floor(cents / n), rem = cents - base * n; return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0)); }
function allocateMoney(cents, ratios) {
  ints([cents]); const total = ratios.reduce((a, b) => a + b, 0);
  const shares = ratios.map((r) => cents * r / total); const out = shares.map(Math.floor);
  let left = cents - out.reduce((a, b) => a + b, 0);
  const order = shares.map((s, i) => [s - Math.floor(s), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) { if (left <= 0) break; out[i]++; left--; }
  return out;
}
function taxMoney(cents, ratePct) { ints([cents]); const tax = roundAway(cents * ratePct / 100); return { net: cents, tax, gross: cents + tax }; }
function convertMoney(cents, from, to, rates) {
  ints([cents]); if (!(from in rates) || !(to in rates)) throw new Error('unknown currency: ' + (from in rates ? to : from));
  return roundAway(cents * rates[from] / rates[to]);
}
function sumMoney(list) { ints(list); return list.reduce((a, b) => a + b, 0); }
function compareMoney(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
module.exports = { parseMoney, formatMoney, addMoney, subtractMoney, multiplyMoney, splitMoney, allocateMoney, taxMoney, convertMoney, sumMoney, compareMoney };
