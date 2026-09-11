// Reference solution (final state of chain r10) - used only to prove checks-D.mjs can pass.
const { Ledger } = require('./r1_ledger.js');
const money = require('./r8_money.js');
const cents = (ledger, name) => Math.round(ledger.balance(name) * 100);
function balancesReport(ledger, names) { return names.map((n) => n + ': ' + money.formatMoney(cents(ledger, n))); }
function totalReport(ledger, names) { return 'Total: ' + money.formatMoney(money.addMoney(...names.map((n) => cents(ledger, n)))); }
function interestPreview(ledger, names, ratePct) { return names.map((n) => n + ': ' + money.formatMoney(money.multiplyMoney(cents(ledger, n), ratePct / 100))); }
function evenSplit(ledger, from, names) {
  const parts = money.splitMoney(cents(ledger, from), names.length);
  parts.forEach((c, i) => { if (c > 0) ledger.transfer(from, names[i], c / 100); });
  return parts;
}
function historyReport(ledger, name) { return ledger.history(name).map((h) => h.type + ' ' + money.formatMoney(Math.round(h.amount * 100))); }
function taxReport(ledger, names, ratePct) {
  return names.map((n) => { const t = money.taxMoney(cents(ledger, n), ratePct); return n + ': net ' + money.formatMoney(t.net) + ' tax ' + money.formatMoney(t.tax) + ' gross ' + money.formatMoney(t.gross); });
}
function convertBalances(ledger, names, code, rates) { return names.map((n) => money.convertMoney(cents(ledger, n), 'USD', code, rates)); }
function currencyReport(ledger, names, code, rates) { return names.map((n) => n + ': ' + money.formatMoney(convertBalances(ledger, [n], code, rates)[0], code)); }
function richest(ledger, n) {
  const rows = ledger.toCSV().split('\n').slice(1).map((l) => { const i = l.lastIndexOf(','); return { name: l.slice(0, i), bal: Number(l.slice(i + 1)) }; });
  rows.sort((a, b) => b.bal - a.bal || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return rows.slice(0, n).map((r) => r.name);
}
module.exports = { Ledger, balancesReport, totalReport, interestPreview, evenSplit, historyReport, taxReport, convertBalances, currencyReport, richest };
