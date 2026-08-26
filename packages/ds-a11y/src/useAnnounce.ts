import { useCallback, useRef } from 'react';

export function useAnnounce() {
  const regionRef = useRef<HTMLDivElement | null>(null);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    let region = regionRef.current;

    if (!region) {
      region = document.createElement('div');
      region.setAttribute('role', 'status');
      region.setAttribute('aria-atomic', 'true');
      region.style.position = 'absolute';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.padding = '0';
      region.style.margin = '-1px';
      region.style.overflow = 'hidden';
      region.style.clip = 'rect(0, 0, 0, 0)';
      region.style.whiteSpace = 'nowrap';
      region.style.border = '0';
      document.body.appendChild(region);
      regionRef.current = region;
    }

    region.setAttribute('aria-live', priority);
    region.textContent = '';
    requestAnimationFrame(() => {
      region!.textContent = message;
    });
  }, []);

  return announce;
}
