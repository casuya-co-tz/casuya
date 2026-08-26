import { cx } from '../../utils/cx';

export type TagVariants = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariants;
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

const variantStyles: Record<TagVariants, string> = {
  default: 'bg-[--casuya-neutral-100] text-[--casuya-text-secondary]',
  primary: 'bg-[--casuya-primary-50] text-[--casuya-primary-700]',
  success: 'bg-[--casuya-success-50] text-[--casuya-success-700]',
  warning: 'bg-[--casuya-warning-50] text-[--casuya-warning-700]',
  danger: 'bg-[--casuya-danger-50] text-[--casuya-danger-700]',
  info: 'bg-[--casuya-info-50] text-[--casuya-info-700]',
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[--casuya-font-size-xs]',
  md: 'px-2 py-1 text-[--casuya-font-size-xs]',
};

export function Tag({
  variant = 'default',
  size = 'sm',
  removable,
  onRemove,
  className,
  children,
  ...props
}: TagProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-[--casuya-radius-sm] font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label={typeof children === 'string' ? `Remove ${children}` : 'Remove'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

Tag.displayName = 'Tag';
