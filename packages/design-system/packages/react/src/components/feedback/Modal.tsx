import { useEffect, useCallback, useId } from 'react';
import { FocusTrap } from '@casuya/a11y';
import { cx } from '../../utils/cx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const titleId = useId();
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[--casuya-z-modal] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ? undefined : 'Dialog'}
      aria-labelledby={title ? titleId : undefined}
    >
      <div className="fixed inset-0 bg-[--casuya-surface-overlay]" onClick={onClose} />
      <FocusTrap active={open}>
        <div
          className={cx(
            'relative w-full bg-[--casuya-surface-modal] rounded-[--casuya-radius-xl]',
            'shadow-[--casuya-shadow-xl] border border-[--casuya-border-default]',
            sizeStyles[size],
          )}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-[--casuya-border-default]">
              <h2 id={titleId} className="text-lg font-semibold text-[--casuya-text-primary]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md hover:bg-[--casuya-neutral-100] transition-colors"
                aria-label="Close modal"
              >
                <svg
                  width="20"
                  height="20"
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
          )}
          <div className="px-6 py-4">{children}</div>
        </div>
      </FocusTrap>
    </div>
  );
}

Modal.displayName = 'Modal';
