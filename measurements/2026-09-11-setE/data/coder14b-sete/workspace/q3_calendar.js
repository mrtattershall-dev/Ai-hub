class Calendar {
  constructor() {
    this.meetings = [];
  }

  toText() {
    return this.list().map(meeting => {
      const startHour = Math.floor(meeting.start / 60);
      const startMinute = meeting.start % 60;
      const endHour = Math.floor(meeting.end / 60);
      const endMinute = meeting.end % 60;
      return `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}-${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')} ${meeting.id}`;
    }).join('\n');
  }

  add(id, start, end) {
    if (typeof id !== 'string' || typeof start !== 'number' || typeof end !== 'number') {
      throw new Error('Invalid input types');
    }
    if (start < 0 || start >= 1440 || end <= start || end > 1440) {
      throw new Error('Invalid start or end time');
    }
if (this.meetings.some(meeting => meeting.id === id)) {
  throw new Error('Duplicate ID');
}

if (this.meetings.some(meeting => meeting.start < end && start < meeting.end)) {
  throw new Error('Overlap detected');
}

this.meetings.push({ id, start, end });
  }

  get(id) {
    return this.meetings.find(meeting => meeting.id === id) || null;
  }

  list() {
    return this.meetings.slice().sort((a, b) => {
      if (a.start === b.start) {
        return a.id.localeCompare(b.id);
      }
      return a.start - b.start;
    });
  }

  move(id, newStart) {
    const meeting = this.meetings.find(meeting => meeting.id === id);
    if (!meeting) {
      throw new Error('Unknown ID');
    }

    const duration = meeting.end - meeting.start;
    const newEnd = newStart + duration;

    if (newStart < 0 || newEnd > 1440 || newStart >= newEnd) {
      throw new Error('Invalid start or end time');
    }

    if (this.meetings.some(meeting => meeting.id !== id && meeting.start < newEnd && newStart < meeting.end)) {
      throw new Error('Overlap detected');
    }

    meeting.start = newStart;
    meeting.end = newEnd;
  }
}

module.exports = Calendar;
const assert = require('assert');

const calendar = new Calendar();

// Test add method
calendar.add('1', 30, 60);
calendar.add('2', 90, 120);
assert.throws(() => calendar.add('1', 150, 180), Error, 'Duplicate ID');
assert.throws(() => calendar.add('3', 180, 150), Error, 'Invalid start or end time');
assert.throws(() => calendar.add('4', -10, 10), Error, 'Invalid start or end time');
assert.throws(() => calendar.add('5', 1500, 1600), Error, 'Invalid start or end time');

// Test get method
assert.deepStrictEqual(calendar.get('1'), { id: '1', start: 30, end: 60 });
assert.deepStrictEqual(calendar.get('2'), { id: '2', start: 90, end: 120 });
assert.strictEqual(calendar.get('3'), null);

// Test list method
assert.deepStrictEqual(calendar.list(), [
  { id: '1', start: 30, end: 60 },
  { id: '2', start: 90, end: 120 }
]);

console.log('All tests passed!');
// Test move method
calendar.add('3', 150, 180);
calendar.move('3', 200);
assert.deepStrictEqual(calendar.get('3'), { id: '3', start: 200, end: 230 });
assert.throws(() => calendar.move('4', 250), Error, 'Unknown ID');
assert.throws(() => calendar.move('3', -50), Error, 'Invalid start or end time');
assert.throws(() => calendar.move('3', 1400), Error, 'Invalid start or end time');
assert.throws(() => calendar.move('3', 100), Error, 'Overlap detected');
