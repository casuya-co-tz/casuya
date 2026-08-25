export interface SkipLinkProps {
  targetId?: string;
  label?: string;
}

export function SkipLink({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      style={{
        position: 'absolute',
        top: '-100%',
        left: 0,
        zIndex: 9999,
        padding: '0.5rem 1rem',
        background: 'var(--casuya-primary-500)',
        color: 'white',
        textDecoration: 'none',
      }}
      className="focus:top-0"
      onFocus={(e) => {
        (e.target as HTMLElement).style.top = '0';
      }}
      onBlur={(e) => {
        (e.target as HTMLElement).style.top = '-100%';
      }}
    >
      {label}
    </a>
  );
}
