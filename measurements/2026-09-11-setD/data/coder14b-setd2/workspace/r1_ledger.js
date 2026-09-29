class Ledger {
  constructor() {
    this.accounts = {};
  }
static fromCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data line');
  }

  const header = lines[0].split(',');
  if (header[0] !== 'account' || header[1] !== 'balance') {
    throw new Error('CSV header must be "account,balance"');
  }

  const ledger = new Ledger();
  for (let i = 1; i < lines.length; i++) {
    const [account, balanceStr] = lines[i].split(',');
    if (balanceStr === undefined) {
      throw new Error(`Malformed line: ${lines[i]}`);
    }

    const balance = parseFloat(balanceStr);
    if (isNaN(balance)) {
      throw new Error(`Invalid balance: ${balanceStr}`);
    }

    if (balance > 0) {
      ledger.accounts[account] = balance;
    }
  }

  return ledger;
}
toCSV() {
  let csv = 'account,balance\n';
  for (const [account, balance] of Object.entries(this.accounts)) {
    csv += `${account},${balance}\n`;
  }
  return csv;
}
}

module.exports = Ledger;