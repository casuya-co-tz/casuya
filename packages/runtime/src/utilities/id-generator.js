export class IdGenerator {
  static _counter = 0;
  static _prefix = 'csy';

  static generate(prefix) {
    const p = prefix || this._prefix;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const counter = (this._counter++).toString(36);
    return `${p}_${timestamp}_${random}${counter}`;
  }

  static short() {
    return Math.random().toString(36).substring(2, 10);
  }

  static uuid() {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  static reset() {
    this._counter = 0;
  }
}
