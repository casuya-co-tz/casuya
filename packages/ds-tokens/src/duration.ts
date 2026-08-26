export interface DurationTokens {
  instant: string;
  fast: string;
  normal: string;
  slow: string;
  slower: string;
  slowest: string;
}

export const duration: DurationTokens = {
  instant: '0ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
  slowest: '700ms',
};
