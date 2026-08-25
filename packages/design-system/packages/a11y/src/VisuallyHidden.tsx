import type { ReactNode } from 'react';

export interface VisuallyHiddenProps {
  children: ReactNode;
  as?: 'span' | 'div';
}

export function VisuallyHidden({ children, as: Tag = 'span' }: VisuallyHiddenProps) {
  return (
    <Tag
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
