import { useId } from 'react';
import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, className, id, ...props }, ref) => {
    const autoId = useId();
    const radioId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : `radio-${autoId}`);

    return (
      <div className={cx('flex items-center gap-2', className)}>
        <input
          ref={ref}
          type="radio"
          id={radioId}
          className={cx(
            'h-4 w-4 rounded-full',
            'border border-[--casuya-border-default] bg-white',
            'text-[--casuya-primary-500]',
            'focus:outline-none focus:ring-[3px] focus:ring-[--casuya-primary-500]/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        />
        {label && (
          <label
            htmlFor={radioId}
            className="text-[--casuya-font-size-sm] text-[--casuya-text-primary] cursor-pointer"
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Radio.displayName = 'Radio';
