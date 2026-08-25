let _cachedResult = null;

export function getDeviceMemory() {
  if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
    return navigator.deviceMemory;
  }
  return null;
}

export function getDeviceCores() {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  return null;
}

export function isLowEndDevice() {
  if (_cachedResult !== null) return _cachedResult;

  const memory = getDeviceMemory();
  const cores = getDeviceCores();
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const isLowMemory = memory !== null && memory <= 2;
  const isLowCores = cores !== null && cores <= 4;
  const isOldBrowser = typeof navigator !== 'undefined' && (
    /Chrome\/[0-4][0-9]\./.test(navigator.userAgent) ||
    /Android 4/.test(navigator.userAgent) ||
    /Android 5/.test(navigator.userAgent)
  );

  _cachedResult = (isMobile && (isLowMemory || isLowCores)) || isOldBrowser;

  if (memory === null && cores === null && isMobile) {
    _cachedResult = true;
  }

  return _cachedResult;
}

export function resetDeviceCache() {
  _cachedResult = null;
}
