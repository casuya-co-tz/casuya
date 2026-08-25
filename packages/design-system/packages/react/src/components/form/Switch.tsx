import { useId } from 'react';
import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className, id, checked, ...props }, ref) => {
    const autoId = useId();
    const switchId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : `switch-${autoId}`);

    return (
      <div className={cx('flex items-center gap-3', className)}>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            ref={ref}
            type="checkbox"
            role="switch"
            id={switchId}
            checked={checked}
            aria-checked={checked}
            className="sr-only peer"
            {...props}
          />
          <span
            className={cx(
              'w-9 h-5 rounded-full',
              'bg-[--casuya-neutral-200] peer-checked:bg-[--casuya-primary-500]',
              'transition-colors duration-[--casuya-duration-fast]',
              'after:content-[""] after:absolute after:top-[2px] after:left-[2px]',
              'after:bg-white after:rounded-full after:h-4 after:w-4',
              'after:transition-transform after:duration-[--casuya-duration-fast]',
              'peer-checked:after:translate-x-4',
              'peer-focus-visible:ring-[3px] peer-focus-visible:ring-[--casuya-primary-500]/20',
              'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
            )}
          />
        </label>
        {label && (
          <label
            htmlFor={switchId}
            className="text-[--casuya-font-size-sm] text-[--casuya-text-primary] cursor-pointer"
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Switch.displayName = 'Switch';
