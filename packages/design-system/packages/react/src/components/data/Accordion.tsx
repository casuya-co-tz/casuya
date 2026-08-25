import { useState, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';

interface AccordionContextValue {
  openItems: string[];
  toggle: (id: string) => void;
  allowMultiple: boolean;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps {
  defaultOpen?: string[];
  allowMultiple?: boolean;
  children: ReactNode;
  className?: string;
}

export function Accordion({
  defaultOpen = [],
  allowMultiple = false,
  children,
  className,
}: AccordionProps) {
  const [openItems, setOpenItems] = useState<string[]>(defaultOpen);

  const toggle = useCallback(
    (id: string) => {
      setOpenItems((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : allowMultiple ? [...prev, id] : [id],
      );
    },
    [allowMultiple],
  );

  return (
    <AccordionContext.Provider value={{ openItems, toggle, allowMultiple }}>
      <div className={cx('divide-y divide-[--casuya-border-default]', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

Accordion.displayName = 'Accordion';

export interface AccordionItemProps {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}

export function AccordionItem({ id, title, children, className }: AccordionItemProps) {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('AccordionItem must be used within Accordion');
  const isOpen = ctx.openItems.includes(id);

  return (
    <div className={cx('py-1', className)}>
      <h3>
        <button
          type="button"
          onClick={() => ctx.toggle(id)}
          aria-expanded={isOpen}
          aria-controls={`accordion-content-${id}`}
          className={cx(
            'flex w-full items-center justify-between px-4 py-3 text-left',
            'text-[--casuya-font-size-sm] font-medium text-[--casuya-text-primary]',
            'hover:bg-[--casuya-neutral-50] rounded-[--casuya-radius-md]',
            'transition-colors duration-[--casuya-duration-fast]',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[--casuya-primary-500]/40',
          )}
        >
          {title}
          <svg
            className={cx(
              'h-4 w-4 text-[--casuya-text-tertiary] transition-transform duration-[--casuya-duration-fast]',
              isOpen && 'rotate-180',
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h3>
      <div
        id={`accordion-content-${id}`}
        role="region"
        hidden={!isOpen}
        className={cx(
          'px-4 pb-3 text-[--casuya-font-size-sm] text-[--casuya-text-secondary]',
          isOpen && 'animate-[fadeIn_200ms_ease]',
        )}
      >
        {children}
      </div>
    </div>
  );
}

AccordionItem.displayName = 'AccordionItem';
