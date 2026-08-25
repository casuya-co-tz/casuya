import { forwardRef } from '../../utils/forward-ref';
import { cx } from '../../utils/cx';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  variant?: 'default' | 'striped' | 'bordered';
  size?: 'sm' | 'md';
}

export interface ThProps extends React.ThHTMLAttributes<HTMLTableHeaderCellElement> {
  sortable?: boolean;
  sorted?: 'asc' | 'desc';
  onSort?: () => void;
  scope?: 'col' | 'row';
}

const variantStyles = {
  default: '',
  striped: '[&_tbody_tr:nth-child(odd)]:bg-[--casuya-bg-secondary]',
  bordered:
    '[&_th]:border [&_td]:border [&_th]:border-[--casuya-border-default] [&_td]:border-[--casuya-border-default]',
};

const sizeStyles = {
  sm: '[&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
  md: '[&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3',
};

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ variant = 'default', size = 'md', className, children, ...props }, ref) => {
    return (
      <div className="w-full overflow-auto">
        <table
          ref={ref}
          className={cx(
            'w-full text-left text-[--casuya-font-size-sm]',
            '[&_th]:text-[--casuya-text-secondary] [&_th]:font-medium [&_th]:text-[--casuya-font-size-xs] [&_th]:uppercase [&_th]:tracking-[--casuya-letter-spacing-wide]',
            '[&_th]:bg-[--casuya-bg-secondary]',
            '[&_td]:text-[--casuya-text-primary]',
            '[&_th]:border-b [&_td]:border-b [&_th]:border-[--casuya-border-default] [&_td]:border-[--casuya-border-default]',
            'border-collapse',
            variantStyles[variant],
            sizeStyles[size],
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
);

Table.displayName = 'Table';

export function Th({ sortable, sorted, onSort, scope = 'col', className, children, ...props }: ThProps) {
  const content = (
    <div className="flex items-center gap-1">
      {children}
      {sortable && sorted && (
        <span className="text-[--casuya-text-tertiary]" aria-hidden="true">
          {sorted === 'asc' ? '\u2191' : '\u2193'}
        </span>
      )}
    </div>
  );

  if (sortable) {
    return (
      <th
        scope={scope}
        className={cx('select-none cursor-pointer hover:text-[--casuya-text-primary]', className)}
        onClick={onSort}
        onKeyDown={onSort ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(); } } : undefined}
        tabIndex={0}
        role="columnheader"
        aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
        {...props}
      >
        {content}
      </th>
    );
  }

  return (
    <th scope={scope} className={className} {...props}>
      {content}
    </th>
  );
}

Th.displayName = 'Th';

export const Td = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableDataCellElement>
>(({ className, children, ...props }, ref) => {
  return (
    <td ref={ref} className={className} {...props}>
      {children}
    </td>
  );
});

Td.displayName = 'Td';
