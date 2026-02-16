export default class Objectpool {
  constructor(createFn) {
    this.createFn = createFn;
    this.pool = [];
  }

  get() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.createFn();
  }

  release(obj) {
    this.pool.push(obj);
  }

  clear() {
    this.pool.length = 0;
  }
}