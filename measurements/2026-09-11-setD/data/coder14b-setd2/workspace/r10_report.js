// r10_report.js

function balancesReport(ledger, names) {
  // existing code
}

function totalReport(ledger, names) {
  // existing code
}

function interestPreview(ledger, names, ratePct) {
  // existing code
}

function evenSplit(ledger, from, names) {
  // Calculate the total balance to split
  const totalBalance = ledger.balance(from);

  // Calculate the amount to split evenly
  const splitAmount = Math.floor(totalBalance / names.length);

  // Calculate the remainder to distribute
  const remainder = totalBalance % names.length;

  // Array to store the amounts moved
  const amountsMoved = [];

  // Transfer the balance to each account
  names.forEach((name, index) => {
    const amount = splitAmount + (index < remainder ? 1 : 0);
    ledger.transfer(from, name, amount);
    amountsMoved.push(amount);
  });

  return amountsMoved;
}

module.exports = {
  balancesReport,
  totalReport,
  interestPreview,
  evenSplit
};
function historyReport(ledger, name) {
  const history = ledger[name] || [];
  return history.map(entry => `${entry.type} $${entry.amount.toFixed(2)}`).join('\n');
}
module.exports = {
  balancesReport,
  totalReport,
  interestPreview,
  evenSplit,
  historyReport
};
function taxReport(ledger, names, ratePct) {
  return names.map(name => {
    const balance = ledger.balance(name);
    const tax = Math.floor(balance * (ratePct / 100));
    const gross = balance + tax;
    return `${name}: net $${formatMoney(balance)} tax $${formatMoney(tax)} gross $${formatMoney(gross)}`;
  }).join('\n');
}

module.exports = {
  balancesReport,
  totalReport,
  interestPreview,
  evenSplit,
  historyReport,
  taxReport
};
/**
 * Converts balances from USD to a specified currency code using convertMoney.
 * @param {Object} ledger - The ledger object containing balances.
 * @param {Array} names - The names of the accounts to convert.
 * @param {string} code - The target currency code.
 * @param {Object} rates - The exchange rates object.
 * @returns {Array} - An array of each balance converted to cents.
 */
function convertBalances(ledger, names, code, rates) {
  return names.map(name => {
    const balance = ledger[name];
    const converted = convertMoney(balance, 'USD', code, rates);
    return Math.round(converted * 100); // Convert to cents
  });
}

module.exports = {
  balancesReport,
  totalReport,
  interestPreview,
  evenSplit,
  historyReport,
  taxReport,
  convertBalances
};
function formatMoney(amount, code) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount / 100);
}

function currencyReport(ledger, names, code, rates) {
  const convertedBalances = convertBalances(ledger, names, code, rates);
  return names.map(name => {
    const balance = convertedBalances[names.indexOf(name)];
    return `${name}: ${formatMoney(balance, code)}`;
  }).join('\n');
}

module.exports.currencyReport = currencyReport;
function richest(ledger, n) {
    const csvData = ledger.toCSV();
    const lines = csvData.split('\n');
    const accounts = [];

    for (let i = 1; i < lines.length; i++) {
        const [name, balance] = lines[i].split(',');
        accounts.push({ name, balance: parseFloat(balance) });
    }

    accounts.sort((a, b) => {
        if (b.balance !== a.balance) {
            return b.balance - a.balance;
        }
        return a.name.localeCompare(b.name);
    });

    return accounts.slice(0, n).map(account => account.name);
}

module.exports.richest = richest;
