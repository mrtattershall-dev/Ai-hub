function isLeapYear(year) {
    if (year % 4 !== 0) return false;
    if (year % 100 !== 0) return true;
    if (year % 400 !== 0) return false;
    return true;
}

// Assertions for isLeapYear
console.assert(isLeapYear(2020) === true, '2020 should be a leap year');
console.assert(isLeapYear(1900) === false, '1900 should not be a leap year');
console.assert(isLeapYear(2000) === true, '2000 should be a leap year');
console.assert(isLeapYear(2021) === false, '2021 should not be a leap year');
function daysBetween(a, b) {
    const [yearA, monthA, dayA] = a.split('-').map(Number);
    const [yearB, monthB, dayB] = b.split('-').map(Number);

    if (isNaN(yearA) || isNaN(monthA) || isNaN(dayA) || isNaN(yearB) || isNaN(monthB) || isNaN(dayB)) {
        throw new Error('Malformed date string');
    }

    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);

// Adjust for leap year and month differences
if (monthA !== monthB) {
    const daysInMonthA = new Date(yearA, monthA, 0).getDate();
    const daysInMonthB = new Date(yearB, monthB, 0).getDate();
    const daysDifference = Math.abs((daysInMonthA - dayA) + dayB);
    return daysDifference;
}

return Math.abs(dayB - dayA);

// Adjust for leap year and month differences
if (monthA !== monthB) {
    const daysInMonthA = new Date(yearA, monthA, 0).getDate();
    const daysInMonthB = new Date(yearB, monthB, 0).getDate();
    const daysDifference = Math.abs((daysInMonthA - dayA) + dayB);
    return daysDifference;
}

return Math.abs(dayB - dayA);

// Adjust for leap year and month differences
if (monthA !== monthB) {
    const daysInMonthA = new Date(yearA, monthA, 0).getDate();
    const daysInMonthB = new Date(yearB, monthB, 0).getDate();
    const daysDifference = Math.abs((daysInMonthA - dayA) + dayB);
    return daysDifference;
}

return Math.abs(dayB - dayA);

    const timeDifference = dateB - dateA;
    const dayDifference = timeDifference / (1000 * 60 * 60 * 24);

    return Math.abs(dayDifference);
}

// Assertions for daysBetween
console.assert(daysBetween('2023-01-01', '2023-01-02') === 1, '1 day difference');
console.assert(daysBetween('2023-01-01', '2023-01-01') === 0, '0 day difference');
console.assert(daysBetween('2023-01-02', '2023-01-01') === 1, '1 day difference');
console.assert(daysBetween('2022-02-28', '2022-03-01') === 2, '2 days difference in February');
console.assert(daysBetween('2020-02-28', '2020-03-01') === 1, '1 day difference in leap year February');
function testDaysBetween() {
    try {
        daysBetween('2023-02-30', '2023-03-01');
        console.error('Assertion failed: 2 days difference in February');
    } catch (e) {
        if (e.message !== 'Malformed date string') {
            console.error('Assertion failed: Incorrect error message for malformed date string');
        }
    }

    try {
        daysBetween('2020-02-29', '2020-03-01');
        console.error('Assertion failed: 1 day difference in leap year February');
    } catch (e) {
        if (e.message !== 'Malformed date string') {
            console.error('Assertion failed: Incorrect error message for malformed date string');
        }
    }
}

testDaysBetween();
