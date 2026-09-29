// Calendar class for managing meetings
class Calendar {
  constructor() {
    this.meetings = [];
    this.meetingMap = new Map();
  }
  
  add(id, start, end) {
    // Validate inputs
    if (typeof id !== 'string') {
      throw new Error('ID must be a string');
    }
    
    if (!Number.isInteger(start) || start < 0 || start >= 1440) {
      throw new Error('Start must be an integer between 0 and 1439');
    }
    
    if (!Number.isInteger(end) || end < 0 || end > 1440) {
      throw new Error('End must be an integer between 0 and 1440');
    }
    
    if (start >= end) {
      throw new Error('Start must be less than end');
    }
    
    if (this.meetingMap.has(id)) {
      throw new Error('Duplicate ID');
    }
    
    // Check for overlapping meetings
    const overlapping = this.conflicts(start, end);
    if (overlapping.length > 0) {
      throw new Error('Meeting overlaps with existing meeting(s): ' + overlapping.join(', '));
    }
    
    const meeting = { id, start, end };
    this.meetings.push(meeting);
    this.meetingMap.set(id, meeting);
  }
  
  get(id) {
    return this.meetingMap.get(id) || null;
  }
  
  list() {
    // Sort by start time, then by id
    return [...this.meetings].sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.id.localeCompare(b.id);
    });
  }
  
  conflicts(start, end) {
    // Validate inputs
    if (!Number.isInteger(start) || start < 0 || start >= 1440) {
      throw new Error('Start must be an integer between 0 and 1439');
    }
    
    if (!Number.isInteger(end) || end < 0 || end > 1440) {
      throw new Error('End must be an integer between 0 and 1440');
    }
    
    if (start >= end) {
      throw new Error('Start must be less than end');
    }
    
    // Find meetings that overlap with the given range
    // Two intervals [a,b) and [c,d) overlap if a < d and c < b
    const overlapping = this.meetings.filter(meeting => {
      return meeting.start < end && start < meeting.end;
    });
    
    // Sort by start time and return IDs
    return overlapping.sort((a, b) => a.start - b.start).map(meeting => meeting.id);
  }
  
  remove(id) {
    // Check if meeting exists
    const meeting = this.meetingMap.get(id);
    if (!meeting) {
      return false;
    }
    
    // Remove from meetings array
    const index = this.meetings.indexOf(meeting);
    if (index !== -1) {
      this.meetings.splice(index, 1);
    }
    
    // Remove from meetingMap
    this.meetingMap.delete(id);
    
    return true;
  }
  
  move(id, newStart) {
    // Validate newStart
    if (!Number.isInteger(newStart) || newStart < 0 || newStart >= 1440) {
      throw new Error('Start must be an integer between 0 and 1439');
    }
    
    // Check if meeting exists
    const meeting = this.meetingMap.get(id);
    if (!meeting) {
      throw new Error('Unknown ID');
    }
    
    // Calculate duration
    const duration = meeting.end - meeting.start;
    const newEnd = newStart + duration;
    
    // Validate newEnd
    if (newEnd > 1440) {
      throw new Error('Meeting would extend beyond the day');
    }
    
    // Check for overlapping meetings (excluding the meeting being moved)
    const overlapping = this.conflicts(newStart, newEnd);
    // Remove the current meeting from the overlapping list if it's there
    const filteredOverlapping = overlapping.filter(overlappingId => overlappingId !== id);
    
    if (filteredOverlapping.length > 0) {
      throw new Error('Meeting overlaps with existing meeting(s): ' + filteredOverlapping.join(', '));
    }
    
    // Update the meeting
    meeting.start = newStart;
    meeting.end = newEnd;
    
    // Re-sort the meetings array
    this.meetings.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.id.localeCompare(b.id);
    });
  }
  
  freeSlots(dayStart, dayEnd, minLength) {
    // Validate inputs
    if (!Number.isInteger(dayStart) || dayStart < 0 || dayStart >= 1440) {
      throw new Error('dayStart must be an integer between 0 and 1439');
    }
    
    if (!Number.isInteger(dayEnd) || dayEnd < 0 || dayEnd > 1440) {
      throw new Error('dayEnd must be an integer between 0 and 1440');
    }
    
    if (dayStart >= dayEnd) {
      throw new Error('dayStart must be less than dayEnd');
    }
    
    if (!Number.isInteger(minLength) || minLength < 0) {
      throw new Error('minLength must be a non-negative integer');
    }
    
    // Get all meetings that overlap with [dayStart, dayEnd)
    const overlappingMeetings = this.meetings.filter(meeting => {
      return meeting.start < dayEnd && dayStart < meeting.end;
    });
    
    // Sort meetings by start time
    overlappingMeetings.sort((a, b) => a.start - b.start);
    
    // Find gaps between meetings
    const gaps = [];
    let currentStart = dayStart;
    
    for (const meeting of overlappingMeetings) {
      // If there's a gap between currentStart and this meeting's start
      if (meeting.start > currentStart) {
        const gapLength = meeting.start - currentStart;
        if (gapLength >= minLength) {
          gaps.push([currentStart, meeting.start]);
        }
      }
      // Move currentStart to the end of this meeting
      currentStart = Math.max(currentStart, meeting.end);
    }
    
    // Check for final gap between last meeting and dayEnd
    if (dayEnd > currentStart) {
      const gapLength = dayEnd - currentStart;
      if (gapLength >= minLength) {
        gaps.push([currentStart, dayEnd]);
      }
    }
    
    // Sort gaps by start time
    gaps.sort((a, b) => a[0] - b[0]);
    
    return gaps;
  }

  firstFree(duration, after = 0) {
    // Validate inputs
    if (!Number.isInteger(duration) || duration < 0) {
      throw new Error('Duration must be a non-negative integer');
    }
    
    if (!Number.isInteger(after) || after < 0 || after >= 1440) {
      throw new Error('After must be an integer between 0 and 1439');
    }
    
    // If duration is 0, we can always find a slot at the after time
    if (duration === 0) {
      return after;
    }
    
    // Get all meetings that overlap with [after, 1440)
    const overlappingMeetings = this.meetings.filter(meeting => {
      return meeting.start < 1440 && after < meeting.end;
    });
    
    // Sort meetings by start time
    overlappingMeetings.sort((a, b) => a.start - b.start);
    
    // Check if there's a gap at or after 'after' that fits the duration
    let currentStart = after;
    
    for (const meeting of overlappingMeetings) {
      // If there's a gap between currentStart and this meeting's start
      if (meeting.start > currentStart) {
        const gapLength = meeting.start - currentStart;
        if (gapLength >= duration) {
          return currentStart;
        }
      }
      // Move currentStart to the end of this meeting
      currentStart = Math.max(currentStart, meeting.end);
    }
    
    // Check if there's a final gap between last meeting and 1440
    if (1440 > currentStart) {
      const gapLength = 1440 - currentStart;
      if (gapLength >= duration) {
        return currentStart;
      }
    }
    
    // No suitable slot found
    return null;
  }
}

module.exports = { Calendar };