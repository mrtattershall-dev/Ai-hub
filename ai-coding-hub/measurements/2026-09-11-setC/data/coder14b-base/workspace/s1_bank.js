class Bank {
    constructor() {
        this.accounts = {};
    }

    open(name) {
        if (this.accounts[name]) {
            throw new Error('Account already exists');
        }
        this.accounts[name] = 0;
    }

    deposit(name, amount) {
        if (!this.accounts[name]) {
            throw new Error('Account does not exist');
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw new Error('Amount must be a positive number');
        }
        this.accounts[name] += amount;
    }

    balance(name) {
        if (!this.accounts[name]) {
            throw new Error('Account does not exist');
        }
        return this.accounts[name];
    }
}

module.exports = Bank;