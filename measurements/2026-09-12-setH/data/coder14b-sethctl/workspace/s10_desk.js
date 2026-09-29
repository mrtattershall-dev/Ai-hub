// s10_desk.js

// Outline of the shelfLine function
const library = require('./s1_library.js');
const cache = require('./s7_cache.js');

function shelfLine(library) {
    const titles = library.titles();
    return titles.length > 0 ? titles.join(', ') : '(empty)';
}

function shelfLine(library) {
    const titles = library.titles();
    return titles.length > 0 ? titles.join(', ') : '(empty)';
}
function availability(library, isbn) {
    const book = library.findBook(isbn);
    if (book) {
        return `${book.available}/${book.copies}`;
    }
    return '0/0';
}
module.exports.availability = availability;
module.exports = {
    shelfLine,
    memberLine
};

module.exports = {
    shelfLine
};

module.exports = {
    shelfLine
};