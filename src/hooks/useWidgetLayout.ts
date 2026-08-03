import { useState, useEffect } from 'react'

export interface WidgetLayoutItem {
  id: string
  type: string
  visible: boolean
}

interface UseWidgetLayoutOptions {
  defaultLayout: WidgetLayoutItem[]
  storageKey?: string
}

export function useWidgetLayout({ defaultLayout, storageKey = 'widget-layout' }: UseWidgetLayoutOptions) {
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(defaultLayout)
  const [isEditMode, setIsEditMode] = useState(false)

  // Load layout from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLayout(parsed)
      } catch (error) {
        console.error('Failed to parse saved layout:', error)
      }
    }
  }, [storageKey])

  // Auto-save layout to localStorage whenever it changes
  useEffect(() => {
    if (layout.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(layout))
    }
  }, [layout, storageKey])

  // Save layout to localStorage
  const saveLayout = () => {
    localStorage.setItem(storageKey, JSON.stringify(layout))
  }

  // Update widget order
  const reorderWidgets = (newOrder: string[]) => {
    const reordered = newOrder.map(id => 
      layout.find(item => item.id === id)
    ).filter((item): item is WidgetLayoutItem => item !== undefined)
    
    setLayout(reordered)
  }

  // Toggle widget visibility
  const toggleWidget = (id: string) => {
    setLayout(prev => 
      prev.map(item => 
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    )
  }

  // Reset to default layout
  const resetLayout = () => {
    setLayout(defaultLayout)
    localStorage.removeItem(storageKey)
  }

  // Get visible widgets in order
  const visibleWidgets = layout.filter(item => item.visible)

  return {
    layout,
    visibleWidgets,
    isEditMode,
    setIsEditMode,
    reorderWidgets,
    toggleWidget,
    saveLayout,
    resetLayout,
  }
}



