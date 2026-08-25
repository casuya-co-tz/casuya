import { cx } from '../utils/cx';

export type TextVariants = 'body1' | 'body2' | 'caption' | 'overline' | 'label';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariants;
  as?: 'p' | 'span' | 'div' | 'label';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'error' | 'success' | 'warning';
  align?: 'left' | 'center' | 'right';
}

const variantStyles: Record<TextVariants, string> = {
  body1: 'text-[--casuya-font-size-base] leading-[--casuya-line-height-normal]',
  body2: 'text-[--casuya-font-size-sm] leading-[--casuya-line-height-normal]',
  caption: 'text-[--casuya-font-size-xs] leading-[--casuya-line-height-normal]',
  overline:
    'text-[--casuya-font-size-xs] leading-[--casuya-line-height-tight] uppercase tracking-[--casuya-letter-spacing-wide]',
  label: 'text-[--casuya-font-size-sm] leading-[--casuya-line-height-normal] font-medium',
};

const weightStyles = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorStyles = {
  primary: 'text-[--casuya-text-primary]',
  secondary: 'text-[--casuya-text-secondary]',
  tertiary: 'text-[--casuya-text-tertiary]',
  inverse: 'text-[--casuya-text-inverse]',
  error: 'text-[--casuya-text-error]',
  success: 'text-[--casuya-text-success]',
  warning: 'text-[--casuya-text-warning]',
};

const alignStyles = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Text({
  variant = 'body1',
  as: Tag = 'p',
  weight,
  color = 'primary',
  align,
  className,
  children,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cx(
        variantStyles[variant],
        weight && weightStyles[weight],
        colorStyles[color],
        align && alignStyles[align],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

Text.displayName = 'Text';
