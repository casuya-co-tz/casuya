export class MediaRenderer {
  constructor(options = {}) {
    this._options = {
      parent: null,
      ...options
    };
    this._mediaElements = new Map();
    this._paused = false;
  }

  preload(src, bytes, type) {
    if (this._mediaElements.has(src)) return;
    const mimeType = this._getMimeType(type || src);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    this._mediaElements.set(src, { url, blob, type: mimeType, element: null });
  }

  createAudio(src, options = {}) {
    const entry = this._getOrCreateEntry(src, 'audio');
    if (!entry) return null;
    const audio = new Audio(entry.url);
    audio.controls = options.controls ?? true;
    audio.autoplay = options.autoplay ?? false;
    audio.loop = options.loop ?? false;
    audio.muted = options.muted ?? false;
    audio.preload = options.preload || 'metadata';
    audio.setAttribute('data-casuya-media', '');
    if (this._options.parent) {
      this._options.parent.appendChild(audio);
    }
    entry.element = audio;
    return audio;
  }

  createVideo(src, options = {}) {
    const entry = this._getOrCreateEntry(src, 'video');
    if (!entry) return null;
    const video = document.createElement('video');
    video.src = entry.url;
    video.controls = options.controls ?? true;
    video.autoplay = options.autoplay ?? false;
    video.loop = options.loop ?? false;
    video.muted = options.muted ?? false;
    video.preload = options.preload || 'metadata';
    video.width = options.width || 640;
    video.height = options.height || 360;
    video.setAttribute('data-casuya-media', '');
    if (this._options.parent) {
      this._options.parent.appendChild(video);
    }
    entry.element = video;
    return video;
  }

  getMedia(src) {
    return this._mediaElements.get(src)?.element || null;
  }

  play(src) {
    const el = this.getMedia(src);
    if (el) el.play().catch(() => {});
  }

  pause(src) {
    const el = this.getMedia(src);
    if (el) el.pause();
  }

  pauseAll() {
    this._paused = true;
    for (const entry of this._mediaElements.values()) {
      if (entry.element && !entry.element.paused) {
        entry.element.pause();
      }
    }
  }

  resumeAll() {
    this._paused = false;
  }

  stop(src) {
    const el = this.getMedia(src);
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }

  setVolume(src, volume) {
    const el = this.getMedia(src);
    if (el) {
      el.volume = Math.max(0, Math.min(1, volume));
    }
  }

  seek(src, time) {
    const el = this.getMedia(src);
    if (el) {
      el.currentTime = Math.max(0, Math.min(time, el.duration || 0));
    }
  }

  release(src) {
    const entry = this._mediaElements.get(src);
    if (entry) {
      if (entry.element) {
        entry.element.pause();
        entry.element.remove();
      }
      URL.revokeObjectURL(entry.url);
      this._mediaElements.delete(src);
    }
  }

  _getOrCreateEntry(src, type) {
    if (this._mediaElements.has(src)) {
      return this._mediaElements.get(src);
    }
    if (typeof src === 'string' && (src.startsWith('http') || src.startsWith('blob:'))) {
      const mimeType = this._getMimeType(type);
      const entry = { url: src, blob: null, type: mimeType, element: null };
      this._mediaElements.set(src, entry);
      return entry;
    }
    return null;
  }

  _getMimeType(type) {
    const mimeMap = {
      mp3: 'audio/mpeg',
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      aac: 'audio/aac',
      m4a: 'audio/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo'
    };
    const ext = type.replace(/^.*\./, '').toLowerCase();
    return mimeMap[ext] || type || 'application/octet-stream';
  }

  destroy() {
    for (const src of this._mediaElements.keys()) {
      this.release(src);
    }
  }
}
