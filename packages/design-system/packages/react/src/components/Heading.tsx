import { cx } from '../utils/cx';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel;
  weight?: 'semibold' | 'bold' | 'extrabold';
}

const levelStyles: Record<HeadingLevel, string> = {
  1: 'text-[--casuya-font-size-4xl] leading-[--casuya-line-height-tight] tracking-[--casuya-letter-spacing-tight]',
  2: 'text-[--casuya-font-size-3xl] leading-[--casuya-line-height-tight] tracking-[--casuya-letter-spacing-tight]',
  3: 'text-[--casuya-font-size-2xl] leading-[--casuya-line-height-snug]',
  4: 'text-[--casuya-font-size-xl] leading-[--casuya-line-height-snug]',
  5: 'text-[--casuya-font-size-lg] leading-[--casuya-line-height-normal]',
  6: 'text-[--casuya-font-size-base] leading-[--casuya-line-height-normal]',
};

const weightStyles = {
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
};

const TagMap: Record<HeadingLevel, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
};

export function Heading({
  level = 1,
  weight = 'bold',
  className,
  children,
  ...props
}: HeadingProps) {
  const Tag = TagMap[level];

  return (
    <Tag
      className={cx(
        'font-[--casuya-font-heading] text-[--casuya-text-primary]',
        levelStyles[level],
        weightStyles[weight],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

Heading.displayName = 'Heading';
