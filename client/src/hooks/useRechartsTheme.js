import { useTheme } from '../context/ThemeContext'

/**
 * Recharts does not use Tailwind; tick/grid/tooltip colors must follow app dark mode.
 */
export function useRechartsTheme() {
  const { isDark } = useTheme()

  if (isDark) {
    return {
      gridStroke: '#334155',
      tickFill: '#cbd5e1',
      tooltipContentStyle: {
        backgroundColor: '#1e293b',
        border: '1px solid #475569',
        borderRadius: '8px',
      },
      tooltipLabelStyle: { color: '#f1f5f9' },
      tooltipItemStyle: { color: '#e2e8f0' },
    }
  }

  return {
    gridStroke: '#e2e8f0',
    tickFill: '#94a3b8',
    tooltipContentStyle: {
      backgroundColor: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
    },
    tooltipLabelStyle: { color: '#334155' },
    tooltipItemStyle: { color: '#334155' },
  }
}
