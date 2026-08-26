import { cx } from '../utils/cx';

export type BadgeVariants = 'default' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSizes = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariants;
  size?: BadgeSizes;
}

const variantStyles: Record<BadgeVariants, string> = {
  default:
    'bg-[--casuya-neutral-100] text-[--casuya-text-secondary] border-[--casuya-neutral-200]',
  success:
    'bg-[--casuya-success-50] text-[--casuya-text-success] border-[--casuya-success-200]',
  warning:
    'bg-[--casuya-warning-50] text-[--casuya-text-warning] border-[--casuya-warning-200]',
  danger: 'bg-[--casuya-danger-50] text-[--casuya-text-error] border-[--casuya-danger-200]',
  info: 'bg-[--casuya-info-50] text-[--casuya-text-info] border-[--casuya-info-200]',
};

const sizeStyles: Record<BadgeSizes, string> = {
  sm: 'px-[--casuya-spacing-1.5] py-[--casuya-spacing-0.5] text-[--casuya-font-size-xs]',
  md: 'px-[--casuya-spacing-2] py-[--casuya-spacing-0.5] text-[--casuya-font-size-xs]',
};

export function Badge({
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-[--casuya-radius-full] border font-medium',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

Badge.displayName = 'Badge';
