class TaskGraph {
  constructor() {
    this.tasks = new Map();
  }

  add(id, duration) {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id ${id} already exists.`);
    }
    if (duration <= 0) {
      throw new Error(`Duration must be a positive number.`);
    }
    this.tasks.set(id, duration);
  }

  has(id) {
    return this.tasks.has(id);
  }

  size() {
    return this.tasks.size;
  }
}

module.exports = TaskGraph;