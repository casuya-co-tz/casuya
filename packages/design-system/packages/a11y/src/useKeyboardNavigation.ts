import { useEffect, useRef } from 'react';

export interface UseKeyboardNavigationOptions {
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

const KEY_MAP: Record<string, keyof UseKeyboardNavigationOptions> = {
  ArrowUp: 'onArrowUp',
  ArrowDown: 'onArrowDown',
  ArrowLeft: 'onArrowLeft',
  ArrowRight: 'onArrowRight',
  Enter: 'onEnter',
  Escape: 'onEscape',
};

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (options.enabled === false) return;

    const handler = (event: KeyboardEvent) => {
      const key = KEY_MAP[event.key];
      if (!key) return;

      const callback = optionsRef.current[key];
      if (typeof callback === 'function') {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [options.enabled]);
}
