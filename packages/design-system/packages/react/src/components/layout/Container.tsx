import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  as?: 'div' | 'section' | 'article' | 'main' | 'header' | 'footer';
}

const sizeStyles = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1400px]',
  full: 'max-w-none',
};

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = 'lg', as: Tag = 'div', className, children, ...props }, ref) => {
    return (
      <Tag
        ref={ref}
        className={cx(
          'mx-auto px-[--casuya-spacing-4] sm:px-[--casuya-spacing-6] lg:px-[--casuya-spacing-8]',
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);

Container.displayName = 'Container';
