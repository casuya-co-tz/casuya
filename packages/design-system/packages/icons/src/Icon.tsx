import { icons } from './icons';

export type IconName = keyof typeof icons;

export interface IconProps {
  name: IconName;
  size?: number | string;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 24, className, title }: IconProps) {
  const path = icons[name];

  if (!path) {
    return null;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
    >
      {title && <title>{title}</title>}
      {path}
    </svg>
  );
}
