import type { Config } from 'tailwindcss';

/**
 * Design tokens from extracted-frontend-screens/.../clinical_operations_system/DESIGN.md
 * Warm-neutral surfaces, blue primary, strict semantic traffic-light colors, Inter.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f7f9fb',
        surface: '#ffffff',
        line: '#e2e8f0',
        ink: {
          DEFAULT: '#191c1e', // on-surface
          muted: '#45464d', // on-surface-variant
          soft: '#76777d', // outline
        },
        primary: {
          DEFAULT: '#2170e4',
          50: '#eef5ff',
          100: '#dbe9ff',
          500: '#2170e4',
          600: '#0058be',
          700: '#004395',
        },
        success: { DEFAULT: '#0f9d6f', bg: '#e7f6f0', fg: '#04734f' },
        warning: { DEFAULT: '#d18f00', bg: '#fdf3e0', fg: '#8a5d00' },
        danger: { DEFAULT: '#ba1a1a', bg: '#ffdad6', fg: '#93000a' },
        ink900: '#0f1729',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['30px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'title-lg': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        'body-md': ['14px', { lineHeight: '20px' }],
        'body-sm': ['13px', { lineHeight: '18px' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '500' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        raised: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
