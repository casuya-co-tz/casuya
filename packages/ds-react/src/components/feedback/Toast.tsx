import { useEffect, useRef, useState } from 'react';
import { cx } from '../../utils/cx';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
  duration?: number;
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-[--casuya-success-500] text-white',
  error: 'bg-[--casuya-danger-500] text-white',
  info: 'bg-[--casuya-primary-500] text-white',
  warning: 'bg-[--casuya-warning-500] text-white',
};

export function Toast({ toast, onDismiss, duration = 4000 }: ToastProps) {
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      exitTimerRef.current = setTimeout(() => onDismiss(toast.id), 200);
    }, duration);
    return () => {
      clearTimeout(timer);
      clearTimeout(exitTimerRef.current);
    };
  }, [toast.id, duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'flex items-center gap-3 px-4 py-3 rounded-[--casuya-radius-md] shadow-[--casuya-shadow-lg]',
        'text-[--casuya-font-size-sm] font-medium',
        'transition-all duration-[--casuya-duration-normal]',
        variantStyles[toast.variant],
        exiting ? 'opacity-0 translate-x-2' : 'opacity-100',
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

Toast.displayName = 'Toast';
