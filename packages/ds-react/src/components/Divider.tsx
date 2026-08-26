import { forwardRef } from '../utils/forward-ref';
import { cx } from '../utils/cx';

export interface DividerProps extends React.HTMLAttributes<HTMLElement> {
  orientation?: 'horizontal' | 'vertical';
  color?: 'default' | 'subtle';
}

const orientationStyles = {
  horizontal: 'w-full border-t',
  vertical: 'h-full border-l self-stretch',
};

const colorStyles = {
  default: 'border-[--casuya-border-default]',
  subtle: 'border-[--casuya-neutral-100]',
};

export const Divider = forwardRef<HTMLElement, DividerProps>(
  ({ orientation = 'horizontal', color = 'default', className, ...props }, ref) => {
    const Tag = orientation === 'vertical' ? 'div' : 'hr';
    return (
      <Tag
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={ref as any}
        className={cx(
          'border-0',
          orientationStyles[orientation],
          colorStyles[color],
          className,
        )}
        role="separator"
        aria-orientation={orientation}
        {...props}
      />
    );
  },
);

Divider.displayName = 'Divider';
