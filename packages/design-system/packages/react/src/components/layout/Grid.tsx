import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type GridSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'full';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: GridCols;
  sm?: GridCols;
  md?: GridCols;
  lg?: GridCols;
  xl?: GridCols;
  gap?: number;
  as?: 'div' | 'section' | 'article' | 'main';
}

export interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: GridSpan;
  sm?: GridSpan;
  md?: GridSpan;
  lg?: GridSpan;
}

const colMap: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
  10: 'grid-cols-10',
  11: 'grid-cols-11',
  12: 'grid-cols-12',
};

const spanMap: Record<GridSpan, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
  10: 'col-span-10',
  11: 'col-span-11',
  12: 'col-span-12',
  full: 'col-span-full',
};

const gapMap: Record<string, string> = {
  '0': 'gap-0',
  '1': 'gap-[--casuya-spacing-1]',
  '2': 'gap-[--casuya-spacing-2]',
  '3': 'gap-[--casuya-spacing-3]',
  '4': 'gap-[--casuya-spacing-4]',
  '5': 'gap-[--casuya-spacing-5]',
  '6': 'gap-[--casuya-spacing-6]',
  '8': 'gap-[--casuya-spacing-8]',
  '10': 'gap-[--casuya-spacing-10]',
};

const allCols: Record<string, string> = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
  5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8',
  9: 'grid-cols-9', 10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12',
};

const allSpans: Record<string, string> = {
  1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3', 4: 'col-span-4',
  5: 'col-span-5', 6: 'col-span-6', 7: 'col-span-7', 8: 'col-span-8',
  9: 'col-span-9', 10: 'col-span-10', 11: 'col-span-11', 12: 'col-span-12',
  full: 'col-span-full',
};

function buildBreakpointMap(prefix: string, mapping: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mapping).map(([key, val]) => [key, val.replace(/^(col-span-|grid-cols-)/, `${prefix}:$&`)])
  );
}

const breakpointColMap: Record<string, Record<string, string>> = {
  sm: buildBreakpointMap('sm', allCols),
  md: buildBreakpointMap('md', allCols),
  lg: buildBreakpointMap('lg', allCols),
  xl: buildBreakpointMap('xl', allCols),
};

const breakpointSpanMap: Record<string, Record<string, string>> = {
  sm: buildBreakpointMap('sm', allSpans),
  md: buildBreakpointMap('md', allSpans),
  lg: buildBreakpointMap('lg', allSpans),
};

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ cols = 1, sm, md, lg, xl, gap = 4, as: Tag = 'div', className, children, ...props }, ref) => {
    const responsive = [
      sm && breakpointColMap.sm?.[sm],
      md && breakpointColMap.md?.[md],
      lg && breakpointColMap.lg?.[lg],
      xl && breakpointColMap.xl?.[xl],
    ].filter(Boolean);

    return (
      <Tag
        ref={ref}
        className={cx('grid', colMap[cols], ...responsive, gapMap[gap] || `gap-${gap}`, className)}
        {...props}
      >
        {children}
      </Tag>
    );
  },
);

Grid.displayName = 'Grid';

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  ({ colSpan, sm, md, lg, className, children, ...props }, ref) => {
    const responsive = [
      sm && breakpointSpanMap.sm?.[sm],
      md && breakpointSpanMap.md?.[md],
      lg && breakpointSpanMap.lg?.[lg],
    ].filter(Boolean);

    return (
      <div
        ref={ref}
        className={cx(colSpan && spanMap[colSpan], ...responsive, className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GridItem.displayName = 'GridItem';
