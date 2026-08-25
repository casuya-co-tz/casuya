import { useMediaQuery } from './useMediaQuery';
import { breakpoints } from '@casuya/tokens';

type BreakpointName = keyof typeof breakpoints;

export function useBreakpoint(breakpoint: BreakpointName): boolean {
  const bp = breakpoints[breakpoint] ?? 768;
  const sm = breakpoints.sm;
  const minWidth = sm ?? 640;
  const query = bp === 0 ? `(max-width: ${minWidth - 1}px)` : `(min-width: ${bp}px)`;
  return useMediaQuery(query);
}
