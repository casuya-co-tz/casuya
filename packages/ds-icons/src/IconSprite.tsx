import type { IconName } from './Icon';

interface IconSpriteProps {
  name: IconName;
  size?: number | string;
  className?: string;
}

export function IconSprite({ name, size = 24, className }: IconSpriteProps) {
  return (
    <svg width={size} height={size} className={className} aria-hidden={true}>
      <use href={`/icons/sprite.svg#${name}`} />
    </svg>
  );
}
