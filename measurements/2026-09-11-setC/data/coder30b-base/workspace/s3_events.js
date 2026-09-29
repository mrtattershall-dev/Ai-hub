class EventBus {
  constructor() {
    this.listeners = {};
  }
  
  on(event, fn) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(fn);
  }
  
  once(event, fn) {
    const onceFn = (...args) => {
      fn(...args);
      this.off(event, onceFn);
    };
    this.on(event, onceFn);
  }
  
  emit(event, ...args) {
    if (!this.listeners[event]) {
      return 0;
    }
    
    let firstError = null;
    this.listeners[event].forEach(fn => {
      try {
        fn(...args);
      } catch (error) {
        if (!firstError) {
          firstError = error;
        }
      }
    });
    
    if (firstError) {
      throw firstError;
    }
    
    return this.listeners[event].length;
  }
  
  off(event, fn) {
    if (!this.listeners[event]) {
      return;
    }
    
    const index = this.listeners[event].indexOf(fn);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }
  
  listenerCount(event) {
    if (!this.listeners[event]) {
      return 0;
    }
    return this.listeners[event].length;
  }
}

module.exports = EventBus;