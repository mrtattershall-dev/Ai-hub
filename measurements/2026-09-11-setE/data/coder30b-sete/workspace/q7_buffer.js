class TextBuffer {
  constructor(text = '') {
    this._text = text;
    this._history = [];
    this._historyPointer = -1;
    this._grouping = false;
    this._groupedOperations = [];
    this._groupStartText = '';
  }
  
  beginGroup() {
    this._grouping = true;
    this._groupedOperations = [];
    this._groupStartText = this._text;
  }
  
  endGroup() {
    if (this._grouping) {
      this._grouping = false;
      // Save the entire group as a single state
      if (this._groupedOperations.length > 0) {
        // Clear redo history when a new edit is made
        this._history = this._history.slice(0, this._historyPointer + 1);
        // Save the state before the group started
        this._history.push(this._groupStartText);
        this._historyPointer = this._history.length - 1;
      }
    }
  }
  
  text() {
    return this._text;
  }
  
  lines() {
    return this._text.split('\n');
  }
  
  lineCol(pos) {
    if (pos < 0 || pos > this._text.length) {
      throw new Error('Position out of bounds');
    }
    
    let line = 0;
    let col = 0;
    let currentPos = 0;
    
    while (currentPos < pos) {
      if (this._text[currentPos] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
      currentPos++;
    }
    
    return { line, col };
  }
  
  posOf(line, col) {
    if (line < 0 || col < 0) {
      throw new Error('Line and column must be non-negative');
    }
    
    let currentLine = 0;
    let currentCol = 0;
    let pos = 0;
    
    // Skip to the start of the requested line
    while (currentLine < line) {
      if (pos >= this._text.length) {
        throw new Error('Line out of bounds');
      }
      if (this._text[pos] === '\n') {
        currentLine++;
      }
      pos++;
    }
    
    // Skip to the requested column in that line
    while (currentCol < col) {
      if (pos >= this._text.length) {
        throw new Error('Column out of bounds');
      }
      if (this._text[pos] === '\n') {
        throw new Error('Column out of bounds');
      }
      pos++;
      currentCol++;
    }
    
    return pos;
  }
  
  insert(pos, str) {
    if (pos < 0 || pos > this._text.length) {
      throw new Error('Position out of bounds');
    }
    
    // If we're in a group, store the operation instead of saving to history
    if (this._grouping) {
      this._groupedOperations.push({
        type: 'insert',
        pos: pos,
        str: str
      });
    } else {
      // Save current state to history before making change
      this._saveState();
      this._text = this._text.slice(0, pos) + str + this._text.slice(pos);
    }
  }
  
  remove(pos, length) {
    if (pos < 0 || pos >= this._text.length || pos + length > this._text.length) {
      throw new Error('Position or length out of bounds');
    }
    
    // If we're in a group, store the operation instead of saving to history
    if (this._grouping) {
      this._groupedOperations.push({
        type: 'remove',
        pos: pos,
        length: length
      });
    } else {
      // Save current state to history before making change
      this._saveState();
      this._text = this._text.slice(0, pos) + this._text.slice(pos + length);
    }
  }
  
  _saveState() {
    if (this._grouping) {
      // When in a group, we don't save individual states
      return;
    } else {
      // Clear redo history when a new edit is made
      this._history = this._history.slice(0, this._historyPointer + 1);
      this._history.push(this._text);
      this._historyPointer = this._history.length - 1;
    }
  }
  
  undo() {
    if (this._historyPointer <= 0) {
      return false;
    }
    this._historyPointer--;
    this._text = this._history[this._historyPointer];
    return true;
  }
  
  redo() {
    if (this._historyPointer >= this._history.length - 1) {
      return false;
    }
    this._historyPointer++;
    this._text = this._history[this._historyPointer];
    return true;
  }

  find(str, from = 0) {
    if (typeof str !== 'string') {
      throw new Error('Search string must be a string');
    }
    if (from < 0 || from > this._text.length) {
      throw new Error('From position out of bounds');
    }
    return this._text.indexOf(str, from);
  }

  findAll(str) {
    if (typeof str !== 'string') {
      throw new Error('Search string must be a string');
    }
    const indexes = [];
    let pos = 0;
    while (pos <= this._text.length - str.length) {
      const foundPos = this._text.indexOf(str, pos);
      if (foundPos === -1) {
        break;
      }
      indexes.push(foundPos);
      pos = foundPos + 1; // Move by 1 to find overlapping matches
    }
    return indexes;
  }
  
  replaceAll(search, replacement) {
    if (typeof search !== 'string' || typeof replacement !== 'string') {
      throw new Error('Search and replacement must be strings');
    }
    
    if (search === '') {
      return 0; // Nothing to replace
    }
    
    // Save current state to history before making changes
    this._saveState();
    
    let count = 0;
    let pos = 0;
    let newText = '';
    
    // Find all occurrences and build new text
    while (pos <= this._text.length - search.length) {
      const foundPos = this._text.indexOf(search, pos);
      if (foundPos === -1) {
        break;
      }
      count++;
      newText += this._text.slice(pos, foundPos) + replacement;
      pos = foundPos + search.length;
    }
    
    // Add the remaining part of the text
    newText += this._text.slice(pos);
    
    // Update the text
    this._text = newText;
    
    return count;
  }
}

module.exports = { TextBuffer };