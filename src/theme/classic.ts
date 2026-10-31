/**
 * Classic Light and Classic Dark, copied from the existing :root and .dark
 * values in src/index.css. These are the only palettes Phase 1 paints.
 * A new family is another record like this, plus a CSS block that sets the
 * same variables. Modules keep using the variables, not these objects.
 */
export type ThemePalette = Record<string, string>

export const CLASSIC_LIGHT: ThemePalette = {
  '--background': '210 16% 97%',
  '--foreground': '215 18% 12%',
  '--card': '0 0% 100%',
  '--card-foreground': '215 18% 12%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '215 18% 12%',
  '--primary': '172 48% 28%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '210 12% 94%',
  '--secondary-foreground': '215 14% 22%',
  '--muted': '210 10% 94%',
  '--muted-foreground': '215 8% 40%',
  '--accent': '172 22% 93%',
  '--accent-foreground': '172 48% 22%',
  '--destructive': '4 72% 52%',
  '--destructive-foreground': '0 0% 100%',
  '--border': '214 12% 88%',
  '--input': '214 12% 88%',
  '--ring': '172 48% 28%',
  '--kp-glow': '168 55% 70%',
  '--kp-glow-2': '200 55% 78%',
  '--kp-glow-3': '155 40% 78%',
  '--kp-glass': '0 0% 100%',
  '--kp-glass-edge': '0 0% 100%',
  '--kp-specular': '0 0% 100%',
  '--kp-lens': '172 40% 55%',
}

export const CLASSIC_DARK: ThemePalette = {
  '--background': '220 14% 7%',
  '--foreground': '210 16% 96%',
  '--card': '220 12% 10%',
  '--card-foreground': '210 16% 96%',
  '--popover': '220 12% 10%',
  '--popover-foreground': '210 16% 96%',
  '--primary': '168 42% 48%',
  '--primary-foreground': '200 25% 8%',
  '--secondary': '220 10% 14%',
  '--secondary-foreground': '210 14% 90%',
  '--muted': '220 8% 14%',
  '--muted-foreground': '215 8% 62%',
  '--accent': '172 14% 16%',
  '--accent-foreground': '168 40% 78%',
  '--destructive': '4 62% 48%',
  '--destructive-foreground': '0 0% 100%',
  '--border': '220 8% 18%',
  '--input': '220 8% 18%',
  '--ring': '168 42% 48%',
  '--kp-glow': '168 35% 28%',
  '--kp-glow-2': '210 40% 24%',
  '--kp-glow-3': '155 25% 18%',
  '--kp-glass': '200 18% 16%',
  '--kp-glass-edge': '168 25% 75%',
  '--kp-specular': '168 35% 85%',
  '--kp-lens': '168 40% 45%',
}

export function classicPalette(appearance: 'light' | 'dark'): ThemePalette {
  return appearance === 'dark' ? CLASSIC_DARK : CLASSIC_LIGHT
}
