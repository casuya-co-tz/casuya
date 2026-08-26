import { useEffect, useId, useRef } from 'react';
import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, indeterminate, className, id, checked, ...props }, ref) => {
    const autoId = useId();
    const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : `checkbox-${autoId}`);
    const innerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    return (
      <div className={cx('flex items-start gap-2', className)}>
        <div className="relative flex items-center h-5">
          <input
            ref={(node) => {
              (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }}
            type="checkbox"
            id={checkboxId}
            checked={checked}
            aria-invalid={!!error}
            className={cx(
              'h-4 w-4 rounded-[--casuya-radius-sm]',
              'border border-[--casuya-border-default] bg-white',
              'text-[--casuya-primary-500]',
              'focus:outline-none focus:ring-[3px] focus:ring-[--casuya-primary-500]/20 focus:border-[--casuya-border-focus]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-[--casuya-border-error]',
            )}
            {...props}
          />
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="text-[--casuya-font-size-sm] text-[--casuya-text-primary] cursor-pointer leading-5"
          >
            {label}
          </label>
        )}
        {error && (
          <p className="text-xs text-[--casuya-text-error]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
