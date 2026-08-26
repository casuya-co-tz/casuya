import { cx } from '../../utils/cx';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

const variantStyles = {
  text: 'rounded-[--casuya-radius-sm] h-4',
  circular: 'rounded-full',
  rectangular: 'rounded-[--casuya-radius-md]',
};

export function Skeleton({ variant = 'text', width, height, className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cx('bg-[--casuya-neutral-200] animate-pulse', variantStyles[variant], className)}
      style={{ width, height }}
    />
  );
}

Skeleton.displayName = 'Skeleton';
