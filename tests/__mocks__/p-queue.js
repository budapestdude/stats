// Mock p-queue for testing
class MockQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 1;
    this.interval = options.interval || 0;
    this.intervalCap = options.intervalCap || 1;
    this.timeout = options.timeout || 0;
    this.throwOnTimeout = options.throwOnTimeout || false;
    this.autoStart = options.autoStart !== false;
    
    this.pending = 0;
    this.size = 0;
    this.isPaused = false;
  }

  async add(task, options = {}) {
    if (typeof task !== 'function') {
      throw new Error('Task must be a function');
    }
    
    this.pending++;
    this.size++;
    
    try {
      const result = await task();
      return result;
    } finally {
      this.pending--;
      this.size--;
    }
  }

  clear() {
    this.size = 0;
  }

  pause() {
    this.isPaused = true;
  }

  start() {
    this.isPaused = false;
  }

  async onEmpty() {
    return Promise.resolve();
  }

  async onIdle() {
    return Promise.resolve();
  }
}

module.exports = MockQueue;
module.exports.default = MockQueue;