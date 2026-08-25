import { forwardRef } from '../utils/forward-ref';
import { cx } from '../utils/cx';

export type StackDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse';
export type StackAlignment = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type StackSpacing =
  | 0
  | 0.5
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 8
  | 10
  | 12
  | 16
  | 20
  | 24;

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: StackDirection;
  align?: StackAlignment;
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  spacing?: StackSpacing;
  wrap?: boolean;
  as?: 'div' | 'nav' | 'section' | 'article' | 'aside' | 'main' | 'header' | 'footer';
}

const directionStyles: Record<StackDirection, string> = {
  row: 'flex-row',
  column: 'flex-col',
  'row-reverse': 'flex-row-reverse',
  'column-reverse': 'flex-col-reverse',
};

const alignStyles: Record<StackAlignment, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyStyles = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const spacingMap: Record<StackSpacing, string> = {
  0: 'gap-0',
  0.5: 'gap-[--casuya-spacing-0.5]',
  1: 'gap-[--casuya-spacing-1]',
  2: 'gap-[--casuya-spacing-2]',
  3: 'gap-[--casuya-spacing-3]',
  4: 'gap-[--casuya-spacing-4]',
  5: 'gap-[--casuya-spacing-5]',
  6: 'gap-[--casuya-spacing-6]',
  8: 'gap-[--casuya-spacing-8]',
  10: 'gap-[--casuya-spacing-10]',
  12: 'gap-[--casuya-spacing-12]',
  16: 'gap-[--casuya-spacing-16]',
  20: 'gap-[--casuya-spacing-20]',
  24: 'gap-[--casuya-spacing-24]',
};

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'column',
      align = 'stretch',
      justify,
      spacing = 4,
      wrap = false,
      as: Tag = 'div',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <Tag
        ref={ref}
        className={cx(
          'flex',
          directionStyles[direction],
          alignStyles[align],
          justify && justifyStyles[justify],
          spacingMap[spacing],
          wrap && 'flex-wrap',
          className,
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);

Stack.displayName = 'Stack';
