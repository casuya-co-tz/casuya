import { useId } from 'react';
import { forwardRef } from '../utils/forward-ref';
import { cx } from '../utils/cx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, fullWidth = true, className, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : `input-${autoId}`);

    return (
      <div className={cx('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[--casuya-font-size-sm] font-medium text-[--casuya-text-primary]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
          }
          className={cx(
            'block rounded-[--casuya-radius-md] px-3 py-2 text-[--casuya-font-size-base]',
            'border border-[--casuya-border-default] bg-white',
            'text-[--casuya-text-primary] placeholder:text-[--casuya-text-tertiary]',
            'transition-colors duration-[--casuya-duration-fast]',
            'focus:outline-none focus:border-[--casuya-border-focus] focus:ring-[3px] focus:ring-[--casuya-border-focus]/20',
            'disabled:bg-[--casuya-neutral-50] disabled:text-[--casuya-text-disabled] disabled:cursor-not-allowed',
            error &&
              'border-[--casuya-border-error] focus:border-[--casuya-border-error] focus:ring-red-400/20',
            'w-full',
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[--casuya-text-error]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[--casuya-text-tertiary]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
