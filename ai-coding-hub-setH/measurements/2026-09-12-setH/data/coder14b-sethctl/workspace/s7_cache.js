class Cache {
  constructor(capacity, options = {}) {
    this.capacity = capacity;
    this.store = new Map();
    this.ttl = options.ttl || null;
    this.now = options.now || Date.now;
  }

  set(key, value, options = {}) {
    const ttl = options.ttl || this.ttl;
    const expires = ttl ? this.now() + ttl : null;
    this.store.set(key, { value, expires });
    if (this.store.size > this.capacity) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
  }

  get(key) {
    const entry = this.store.get(key);
    if (entry && entry.expires && entry.expires < this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry ? entry.value : undefined;
  }

  has(key) {
    const entry = this.store.get(key);
    if (entry && entry.expires && entry.expires < this.now()) {
      this.store.delete(key);
      return false;
    }
    return entry !== undefined;
  }

  peek(key) {
    const entry = this.store.get(key);
    if (entry && entry.expires && entry.expires < this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry ? entry.value : undefined;
  }

  size() {
    return this.store.size;
  }

  keys() {
    return Array.from(this.store.keys()).filter(key => {
      const entry = this.store.get(key);
      return !entry.expires || entry.expires >= this.now();
    });
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  peek(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }


  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
    this.cache.set(key, value);
    this.usageOrder.set(key, Date.now());
  }

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {

  get(key) {
    if (this.cache.has(key)) {
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }

  keys() {
    return Array.from(this.usageOrder.keys()).reverse();
  }
}
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer");
    }
    this.capacity = capacity;
    this.cache = new Map();
    this.usageOrder = new Map();
  }

  delete(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.usageOrder.delete(key);
      return true;
    }
    return false;
  }

  clear() {
    this.cache.clear();
    this.usageOrder.clear();
  }

  set(key, value) {
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.usageOrder.keys().next().value;
      this.cache.delete(oldestKey);
      this.usageOrder.delete(oldestKey);
    }
    this.cache.set(key, value);
    return undefined;
  }

  has(key) {
    return this.cache.has(key);
  }

  size() {
    return this.cache.size;
  }
}

module.exports = Cache;