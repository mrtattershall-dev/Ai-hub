const Ledger = require('./r1_ledger.js');
const { expect } = require('chai');

describe('Ledger', function() {
    let ledger;

    beforeEach(function() {
        ledger = new Ledger();
    });

    it('should open an account with balance 0', function() {
        ledger.open('account1');
        expect(ledger.balance('account1')).to.equal(0);
    });

    it('should throw an error if account already exists', function() {
        ledger.open('account1');
        expect(() => ledger.open('account1')).to.throw('Account already exists');
    });

    it('should deposit money into an account', function() {
        ledger.open('account1');
        ledger.deposit('account1', 100);
        expect(ledger.balance('account1')).to.equal(100);
    });

    it('should throw an error if depositing into an unknown account', function() {
        expect(() => ledger.deposit('account1', 100)).to.throw('Unknown account');
    });

    it('should throw an error if depositing a non-positive amount', function() {
        ledger.open('account1');
        expect(() => ledger.deposit('account1', -100)).to.throw('Amount must be positive');
    });

    it('should return the balance of an account', function() {
        ledger.open('account1');
        ledger.deposit('account1', 100);
        expect(ledger.balance('account1')).to.equal(100);
    });

    it('should throw an error if checking balance of an unknown account', function() {
        expect(() => ledger.balance('account1')).to.throw('Unknown account');
    });
});