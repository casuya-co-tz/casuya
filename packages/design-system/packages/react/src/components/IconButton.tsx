import { forwardRef } from '../utils/forward-ref';
import { cx } from '../utils/cx';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles = {
  primary:
    'bg-[--casuya-primary-500] text-white hover:bg-[--casuya-primary-600] active:bg-[--casuya-primary-700]',
  secondary:
    'bg-[--casuya-neutral-100] text-[--casuya-text-primary] hover:bg-[--casuya-neutral-200] active:bg-[--casuya-neutral-300]',
  ghost:
    'bg-transparent text-[--casuya-text-primary] hover:bg-[--casuya-neutral-100] active:bg-[--casuya-neutral-200]',
};

const sizeStyles = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, variant = 'ghost', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={cx(
          'inline-flex items-center justify-center rounded-[--casuya-radius-md]',
          'transition-all duration-[--casuya-duration-fast]',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[--casuya-primary-500]/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        <span className={cx('flex', iconSizes[size])}>{children}</span>
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
