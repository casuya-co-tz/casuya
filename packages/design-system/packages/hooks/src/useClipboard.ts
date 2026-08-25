import { useState, useCallback, useRef, useEffect } from 'react';

export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined as unknown as ReturnType<typeof setTimeout>);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000) as unknown as ReturnType<typeof setTimeout>;
      return true;
    } catch {
      setCopied(false);
      return false;
    }
  }, []);

  return { copy, copied };
}
