export class MediaAPI {
  constructor(options = {}) {
    this._options = {
      renderer: null,
      eventBus: null,
      ...options
    };
    this._players = new Map();
    this._listeners = new Map();
  }

  play(src, options = {}) {
    if (this._options.renderer) {
      const mediaRenderer = this._options.renderer._subRenderers?.media;
      if (mediaRenderer) {
        const type = this._getMediaType(src);
        if (type === 'video') {
          mediaRenderer.createVideo(src, options);
        } else {
          mediaRenderer.createAudio(src, options);
        }
        mediaRenderer.play(src);
        return true;
      }
    }
    const player = this._createPlayer(src, options);
    if (player) {
      player.play().catch(() => {});
      return true;
    }
    return false;
  }

  pause(src) {
    if (this._options.renderer?._subRenderers?.media) {
      this._options.renderer._subRenderers.media.pause(src);
    }
    const player = this._players.get(src);
    if (player) player.pause();
  }

  stop(src) {
    if (this._options.renderer?._subRenderers?.media) {
      this._options.renderer._subRenderers.media.stop(src);
    }
    const player = this._players.get(src);
    if (player) {
      player.pause();
      player.currentTime = 0;
    }
  }

  seek(src, time) {
    if (this._options.renderer?._subRenderers?.media) {
      this._options.renderer._subRenderers.media.seek(src, time);
    }
    const player = this._players.get(src);
    if (player) {
      player.currentTime = Math.max(0, Math.min(time, player.duration || 0));
    }
  }

  setVolume(src, volume) {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this._options.renderer?._subRenderers?.media) {
      this._options.renderer._subRenderers.media.setVolume(src, clamped);
    }
    const player = this._players.get(src);
    if (player) player.volume = clamped;
  }

  getVolume(src) {
    const player = this._players.get(src);
    return player ? player.volume : 1;
  }

  getDuration(src) {
    const player = this._players.get(src);
    return player ? player.duration : 0;
  }

  getCurrentTime(src) {
    const player = this._players.get(src);
    return player ? player.currentTime : 0;
  }

  isPlaying(src) {
    const player = this._players.get(src);
    return player ? !player.paused : false;
  }

  pauseAll() {
    for (const player of this._players.values()) {
      player.pause();
    }
  }

  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(listener);
  }

  off(event, listener) {
    if (!this._listeners.has(event)) return;
    this._listeners.set(event, this._listeners.get(event).filter(l => l !== listener));
  }

  _getMediaType(src) {
    const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
    const ext = src.split('.').pop()?.toLowerCase();
    if (videoExts.includes(ext)) return 'video';
    return 'audio';
  }

  _createPlayer(src, options) {
    if (this._players.has(src)) return this._players.get(src);
    const type = this._getMediaType(src);
    let player;
    if (type === 'video') {
      player = document.createElement('video');
      player.src = src;
      player.controls = options.controls ?? true;
      if (options.autoplay) player.autoplay = true;
      if (options.loop) player.loop = true;
      if (options.muted) player.muted = true;
      player.preload = options.preload || 'metadata';
    } else {
      player = new Audio(src);
      player.controls = options.controls ?? true;
      if (options.loop) player.loop = true;
    }
    this._players.set(src, player);
    player.addEventListener('ended', () => this._emit('media:ended', { src }));
    player.addEventListener('error', (e) => this._emit('media:error', { src, error: e }));
    return player;
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try { listener(data); } catch {}
      }
    }
    this._options.eventBus?.emit(event, data);
  }

  destroy() {
    for (const player of this._players.values()) {
      player.pause();
      player.remove?.();
    }
    this._players.clear();
    this._listeners.clear();
  }
}
