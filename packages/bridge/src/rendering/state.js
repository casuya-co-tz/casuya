/** Tracks idle -> loading -> ready | error and emits render:<state> on the bus. */

export const RENDER_STATES = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
});

export class RenderStateManager {
  constructor(bus) {
    this._bus = bus;
    this.state = RENDER_STATES.IDLE;
  }

  set(state, payload) {
    this.state = state;
    this._bus?.emit(`render:${state}`, payload);
  }
}
