import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-slate': '#2C3E50',
        'buy-primary': '#0F766E',
        'buy-tint': '#E6F4F1',
        'sell-primary': '#4338CA',
        'sell-tint': '#ECEBFF',
        cta: '#C2410C',
        'cta-hover': '#9A3412',
        surface: '#FFFFFF',
        bg: '#F5F7FA',
        success: '#15803D',
        warning: '#B45309',
        danger: '#B91C1C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
