module.exports = {
  parseMoney: function(text) {
    const regex = /^\$?(-?\d+)(,\d{3})*(\.\d{2})?$/;
    if (!regex.test(text)) {
      throw new Error('Invalid money format');
    }
    const cleanedText = text.replace(/,/g, '');
    const dollars = parseFloat(cleanedText);
    return Math.round(dollars * 100);
  },
  formatMoney: function(cents) {
    // Implementation of formatMoney
  }
};