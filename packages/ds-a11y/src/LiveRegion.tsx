import type { ReactNode } from 'react';

export interface LiveRegionProps {
  children: ReactNode;
  as?: 'div' | 'span';
  'aria-live'?: 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-relevant'?: 'additions' | 'removals' | 'text' | 'all';
}

export function LiveRegion({
  children,
  as: Tag = 'div',
  'aria-live': live = 'polite',
  'aria-atomic': atomic = true,
  'aria-relevant': relevant,
}: LiveRegionProps) {
  return (
    <Tag
      aria-live={live}
      aria-atomic={atomic}
      aria-relevant={relevant}
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </Tag>
  );
}
