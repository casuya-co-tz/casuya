import { forwardRef } from '../utils/forward-ref';
import { cx } from '../utils/cx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles = {
  elevated:
    'bg-[--casuya-surface-elevated] shadow-[--casuya-shadow-base] border border-[--casuya-border-default]',
  outlined: 'bg-white border border-[--casuya-border-default]',
  filled: 'bg-[--casuya-bg-secondary] border border-transparent',
};

const paddingStyles = {
  none: 'p-0',
  sm: 'p-[--casuya-spacing-3]',
  md: 'p-[--casuya-spacing-5]',
  lg: 'p-[--casuya-spacing-8]',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'elevated', padding = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cx(
          'rounded-[--casuya-radius-lg]',
          variantStyles[variant],
          paddingStyles[padding],
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
