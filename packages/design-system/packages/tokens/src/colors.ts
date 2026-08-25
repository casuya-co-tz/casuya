export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ColorTokens {
  white: string;
  black: string;
  transparent: string;
  current: string;

  primary: ColorScale;
  secondary: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  danger: ColorScale;
  info: ColorScale;

  neutral: ColorScale;
  brand: ColorScale;

  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };

  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
    disabled: string;
    link: string;
    linkHover: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  };

  border: {
    default: string;
    hover: string;
    focus: string;
    disabled: string;
    error: string;
    success: string;
  };

  surface: {
    elevated: string;
    card: string;
    modal: string;
    tooltip: string;
    overlay: string;
    pressed: string;
  };
}

export const colors: ColorTokens = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  current: 'currentColor',

  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554',
  },

  secondary: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },

  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  danger: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
    950: '#450A0A',
  },

  info: {
    50: '#ECFEFF',
    100: '#CFFAFE',
    200: '#A5F3FC',
    300: '#67E8F9',
    400: '#22D3EE',
    500: '#06B6D4',
    600: '#0891B2',
    700: '#0E7490',
    800: '#155E75',
    900: '#164E63',
    950: '#083344',
  },

  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  brand: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E',
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
    950: '#052E16',
  },

  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    inverse: '#111827',
  },

  text: {
    primary: '#111827',
    secondary: '#4B5563',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    disabled: '#D1D5DB',
    link: '#2563EB',
    linkHover: '#1D4ED8',
    error: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    info: '#0891B2',
  },

  border: {
    default: '#E5E7EB',
    hover: '#D1D5DB',
    focus: '#3B82F6',
    disabled: '#F3F4F6',
    error: '#FCA5A5',
    success: '#86EFAC',
  },

  surface: {
    elevated: '#FFFFFF',
    card: '#FFFFFF',
    modal: '#FFFFFF',
    tooltip: '#111827',
    overlay: 'rgba(0, 0, 0, 0.5)',
    pressed: '#F9FAFB',
  },
};
