import { useEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement>(
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || !(event.target instanceof Node) || ref.current.contains(event.target)) return;
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler]);

  return ref;
}
