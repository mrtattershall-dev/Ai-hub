const Ledger = require('./r1_ledger.js');

function testFromCSV() {
  const csv = `account,balance
  account1,100
  account2,200
  account3,-50`;

  const ledger = Ledger.fromCSV(csv);
  console.log(ledger.toCSV());
}

testFromCSV();