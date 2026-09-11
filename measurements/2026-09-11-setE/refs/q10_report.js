// Reference solution (final state of chain q10) - used only to prove checks-E.mjs can pass.
const { Warehouse } = require('./q1_stock.js');
const { render } = require('./q4_template.js');
const rows = (w) => w.skus().map((sku) => ({ sku, qty: w.stock(sku) }));
const skuLine = (w, sku) => render('{{sku}}: {{qty}}', { sku, qty: w.stock(sku) });
const itemLine = (w, sku) => render('{{item.sku}} has {{item.qty}}', { item: { sku, qty: w.stock(sku) } });
const reservedLine = (w, sku) => render('{{sku}}: {{available}} of {{qty}} free', { sku, available: w.available(sku), qty: w.stock(sku) });
const shoutLine = (w, sku) => render('{{sku | upper}}: {{qty}}', { sku, qty: w.stock(sku) });
const stockTable = (w) => render('{{#rows}}{{sku}}={{qty}};{{/rows}}', { rows: rows(w) });
const emptyNote = (w) => render('{{^rows}}no stock{{/rows}}{{#rows}}{{sku}} {{/rows}}', { rows: rows(w) });
const lowReport = (w, threshold) => render('low: {{#low}}{{.}} {{/low}}', { low: w.lowStock(threshold) });
const jsonReport = (w) => render('{{{json}}}', { json: JSON.stringify(w.toJSON()) });
const historyReport = (w, sku) => render('history: {{> events}}', { events: w.history(sku) }, { events: '{{#events}}{{type}} {{qty}}, {{/events}}' });
module.exports = { Warehouse, skuLine, itemLine, reservedLine, shoutLine, stockTable, emptyNote, lowReport, jsonReport, historyReport };
