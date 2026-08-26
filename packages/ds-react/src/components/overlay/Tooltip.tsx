import { useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';

export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionStyles: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, children, position = 'top', delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cx(
            'absolute z-[--casuya-z-tooltip] px-2 py-1',
            'bg-[--casuya-surface-tooltip] text-[--casuya-text-inverse]',
            'text-[--casuya-font-size-xs] rounded-[--casuya-radius-sm]',
            'whitespace-nowrap pointer-events-none',
            'shadow-[--casuya-shadow-lg]',
            positionStyles[position],
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

Tooltip.displayName = 'Tooltip';
