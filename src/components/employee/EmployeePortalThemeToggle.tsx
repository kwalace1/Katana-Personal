import { useEffect, useState } from 'react'
import { Check, Laptop, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ThemeChoice = 'light' | 'dark' | 'system'

const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Laptop },
]

export function EmployeePortalThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" className="h-9 shrink-0 px-2" aria-hidden>
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const active = (theme ?? 'system') as ThemeChoice
  const TriggerIcon =
    resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-2.5"
          title="Appearance"
          aria-label="Choose light or dark mode"
        >
          <TriggerIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline text-xs font-medium capitalize">{active}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            className="cursor-pointer"
            onClick={() => setTheme(value)}
          >
            <Icon className="mr-2 h-4 w-4" />
            {label}
            {active === value && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
