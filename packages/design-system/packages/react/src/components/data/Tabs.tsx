import { useState, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../utils/cx';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  variant: 'underline' | 'pills';
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultTab?: string;
  activeTab?: string;
  onChange?: (id: string) => void;
  variant?: 'underline' | 'pills';
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultTab,
  activeTab: controlledTab,
  onChange,
  variant = 'underline',
  children,
  className,
}: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab || '');
  const isControlled = controlledTab !== undefined;
  const activeTab = isControlled ? controlledTab : internalTab;

  const setActiveTab = useCallback(
    (id: string) => {
      if (!isControlled) setInternalTab(id);
      onChange?.(id);
    },
    [isControlled, onChange],
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, variant }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.displayName = 'Tabs';

export interface TabListProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function TabList({ children, className, 'aria-label': ariaLabel }: TabListProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabList must be used within Tabs');

  const variantStyles = {
    underline: 'border-b border-[--casuya-border-default] gap-0',
    pills: 'gap-1',
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx('flex', variantStyles[ctx.variant], className)}
    >
      {children}
    </div>
  );
}

TabList.displayName = 'TabList';

export interface TabProps {
  id: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Tab({ id, children, className, disabled }: TabProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab must be used within Tabs');
  const isActive = ctx.activeTab === id;

  const underlineStyle = isActive
    ? 'text-[--casuya-primary-600] border-b-2 border-[--casuya-primary-500] -mb-[1px]'
    : 'text-[--casuya-text-secondary] border-b-2 border-transparent hover:text-[--casuya-text-primary] hover:border-[--casuya-border-hover]';

  const pillsStyle = isActive
    ? 'bg-[--casuya-primary-500] text-white'
    : 'text-[--casuya-text-secondary] hover:bg-[--casuya-neutral-100] hover:text-[--casuya-text-primary]';

  return (
    <button
      role="tab"
      id={`tab-${id}`}
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      disabled={disabled}
      onClick={() => ctx.setActiveTab(id)}
      className={cx(
        'px-4 py-2.5 text-[--casuya-font-size-sm] font-medium transition-all duration-[--casuya-duration-fast]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[--casuya-primary-500]/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'whitespace-nowrap',
        ctx.variant === 'underline' ? underlineStyle : pillsStyle,
        className,
      )}
    >
      {children}
    </button>
  );
}

Tab.displayName = 'Tab';

export interface TabPanelProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, children, className }: TabPanelProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabPanel must be used within Tabs');

  if (ctx.activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cx('pt-4', className)}
    >
      {children}
    </div>
  );
}

TabPanel.displayName = 'TabPanel';
