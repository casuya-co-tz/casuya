import { forwardRef } from '../utils/forward-ref';
import { cx } from '../utils/cx';

export type ButtonVariants = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSizes = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariants;
  size?: ButtonSizes;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariants, string> = {
  primary:
    'bg-[--casuya-primary-500] text-white hover:bg-[--casuya-primary-600] active:bg-[--casuya-primary-700] focus-visible:ring-[--casuya-primary-500]',
  secondary:
    'bg-[--casuya-neutral-100] text-[--casuya-text-primary] hover:bg-[--casuya-neutral-200] active:bg-[--casuya-neutral-300] focus-visible:ring-[--casuya-neutral-400]',
  danger:
    'bg-[--casuya-danger-500] text-white hover:bg-[--casuya-danger-600] active:bg-[--casuya-danger-700] focus-visible:ring-[--casuya-danger-500]',
  ghost:
    'bg-transparent text-[--casuya-text-primary] hover:bg-[--casuya-neutral-100] active:bg-[--casuya-neutral-200] focus-visible:ring-[--casuya-neutral-400]',
  outline:
    'border border-[--casuya-border-default] bg-transparent text-[--casuya-text-primary] hover:bg-[--casuya-neutral-50] active:bg-[--casuya-neutral-100] focus-visible:ring-[--casuya-neutral-400]',
};

const sizeStyles: Record<ButtonSizes, string> = {
  sm: 'px-[--casuya-spacing-3] py-[--casuya-spacing-1] text-[--casuya-font-size-sm] h-8',
  md: 'px-[--casuya-spacing-4] py-[--casuya-spacing-2] text-[--casuya-font-size-base] h-10',
  lg: 'px-[--casuya-spacing-6] py-[--casuya-spacing-3] text-[--casuya-font-size-lg] h-12',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cx(
          'inline-flex items-center justify-center gap-2 rounded-[--casuya-radius-md] font-medium',
          'transition-all duration-[--casuya-duration-fast]',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          'select-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
