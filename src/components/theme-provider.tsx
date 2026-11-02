import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'
import { ThemeAttributes } from '@/theme/ThemeAttributes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeAttributes />
      {children}
    </NextThemesProvider>
  )
}


