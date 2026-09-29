const assert = require('assert');
const Bank = require('./s1_bank.js');

describe('Bank', function() {
    let bank;

    beforeEach(function() {
        bank = new Bank();
    });

    it('should open a new account', function() {
        bank.open('Alice');
        assert.strictEqual(bank.balance('Alice'), 0);
    });

    it('should throw an error for opening an existing account', function() {
        bank.open('Bob');
        assert.throws(() => bank.open('Bob'), Error, 'Account already exists');
    });

    it('should deposit to an existing account', function() {
        bank.open('Charlie');
        bank.deposit('Charlie', 100);
        assert.strictEqual(bank.balance('Charlie'), 100);
    });

    it('should throw an error for depositing to an unknown account', function() {
        assert.throws(() => bank.deposit('David', 100), Error, 'Account does not exist');
    });

    it('should throw an error for depositing a non-positive amount', function() {
        bank.open('Eve');
        assert.throws(() => bank.deposit('Eve', -50), Error, 'Amount must be a positive number');
        assert.throws(() => bank.deposit('Eve', 0), Error, 'Amount must be a positive number');
    });

    it('should get the balance of an existing account', function() {
        bank.open('Frank');
        bank.deposit('Frank', 200);
        assert.strictEqual(bank.balance('Frank'), 200);
    });

    it('should throw an error for getting the balance of an unknown account', function() {
        assert.throws(() => bank.balance('Grace'), Error, 'Account does not exist');
    });
});