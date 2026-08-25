import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export type AlertVariants = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariants;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariants, string> = {
  info: 'bg-[--casuya-info-50] border-[--casuya-info-200] text-[--casuya-text-info]',
  success: 'bg-[--casuya-success-50] border-[--casuya-success-200] text-[--casuya-text-success]',
  warning: 'bg-[--casuya-warning-50] border-[--casuya-warning-200] text-[--casuya-text-warning]',
  danger: 'bg-[--casuya-danger-50] border-[--casuya-danger-200] text-[--casuya-text-error]',
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, dismissible, onDismiss, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={cx(
          'flex gap-3 rounded-[--casuya-radius-md] border p-4 text-[--casuya-font-size-sm]',
          variantStyles[variant],
          className,
        )}
        {...props}
      >
        <div className="flex-1">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div>{children}</div>
        </div>
        {dismissible && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  },
);

Alert.displayName = 'Alert';
