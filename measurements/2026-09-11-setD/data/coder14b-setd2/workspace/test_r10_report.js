// test_r10_report.js

const assert = require('assert');
const { balancesReport } = require('./r10_report.js');

// Test cases will go here

const Ledger = require('./r1_ledger.js');
const { formatMoney } = require('./r8_money.js');

describe('balancesReport', function() {
    it('should return the correct balance report for a single account', function() {
        const ledger = new Ledger();
        ledger.open('alice');
        ledger.deposit('alice', 12.50);
        const names = ['alice'];
        const report = balancesReport(ledger, names);
        assert.deepStrictEqual(report, ['alice: $12.50']);
    });

    it('should return the correct balance report for multiple accounts', function() {
        const ledger = new Ledger();
        ledger.open('alice');
        ledger.deposit('alice', 12.50);
        ledger.open('bob');
        ledger.deposit('bob', 25.75);
        const names = ['alice', 'bob'];
        const report = balancesReport(ledger, names);
        assert.deepStrictEqual(report, ['alice: $12.50', 'bob: $25.75']);
    });

    it('should return the correct balance report for an account with zero balance', function() {
        const ledger = new Ledger();
        ledger.open('alice');
        const names = ['alice'];
        const report = balancesReport(ledger, names);
        assert.deepStrictEqual(report, ['alice: $0.00']);
    });

    it('should return the correct balance report for an account with negative balance', function() {
        const ledger = new Ledger();
        ledger.open('alice');
        ledger.deposit('alice', -12.50);
        const names = ['alice'];
        const report = balancesReport(ledger, names);
        assert.deepStrictEqual(report, ['alice: -$12.50']);
    });
});