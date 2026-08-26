import { cx } from '../../utils/cx';

export interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2.5',
};

const variantStyles = {
  primary: 'bg-[--casuya-primary-500]',
  success: 'bg-[--casuya-success-500]',
  warning: 'bg-[--casuya-warning-500]',
  danger: 'bg-[--casuya-danger-500]',
};

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant = 'primary',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-valuenow={Math.min(Math.max(value, 0), max)}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cx(
          'flex-1 rounded-full bg-[--casuya-neutral-200] overflow-hidden',
          sizeStyles[size],
        )}
      >
        <div
          className={cx(
            'h-full rounded-full transition-all duration-[--casuya-duration-normal]',
            variantStyles[variant],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-[--casuya-text-secondary] font-medium tabular-nums">
          {Math.round(percent)}%
        </span>
      )}
    </div>
  );
}

ProgressBar.displayName = 'ProgressBar';
