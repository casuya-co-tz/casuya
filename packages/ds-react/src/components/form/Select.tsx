import { useId } from 'react';
import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'children'
> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, hint, options, placeholder, fullWidth = true, className, id, ...props },
    ref,
  ) => {
    const autoId = useId();
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : `select-${autoId}`);

    return (
      <div className={cx('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-[--casuya-font-size-sm] font-medium text-[--casuya-text-primary]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          className={cx(
            'block rounded-[--casuya-radius-md] px-3 py-2 text-[--casuya-font-size-base]',
            'border border-[--casuya-border-default] bg-white',
            'text-[--casuya-text-primary]',
            'transition-colors duration-[--casuya-duration-fast]',
            'focus:outline-none focus:border-[--casuya-border-focus] focus:ring-[3px] focus:ring-[--casuya-border-focus]/20',
            'disabled:bg-[--casuya-neutral-50] disabled:text-[--casuya-text-disabled] disabled:cursor-not-allowed',
            error &&
              'border-[--casuya-border-error] focus:border-[--casuya-border-error] focus:ring-red-400/20',
            'w-full appearance-none',
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-[--casuya-text-error]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-[--casuya-text-tertiary]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
