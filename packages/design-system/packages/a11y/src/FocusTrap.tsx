import { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function FocusTrap({ children, active = true }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusableElements = () =>
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    const focusFirstElement = () => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        elements[0]!.focus();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const elements = getFocusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0]!;
      const last = elements[elements.length - 1]!;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    focusFirstElement();
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
}
