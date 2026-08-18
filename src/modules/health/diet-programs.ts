import type { DietPlanDay, DietPlanMeal, DietPlanPattern, MealCategory } from './types'

export type DietProgram = {
  id: string
  name: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  pattern: DietPlanPattern
  days: DietPlanDay[]
  premium: boolean
}

function meal(
  name: string,
  category: MealCategory,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  ingredients: { name: string; grams: number; calories: number; protein: number; carbs: number; fat: number }[] = [],
): DietPlanMeal {
  return {
    name,
    category,
    calories,
    protein,
    carbs,
    fat,
    ingredients: ingredients.map((item) => ({ ...item, source: 'manual' as const })),
  }
}

export const DIET_PRESETS = [
  { name: 'Cut · 1,800', calories: 1800, protein: 160, carbs: 150, fat: 55 },
  { name: 'Maintain · 2,200', calories: 2200, protein: 160, carbs: 220, fat: 70 },
  { name: 'Bulk · 2,800', calories: 2800, protein: 190, carbs: 320, fat: 80 },
] as const

export const DIET_PROGRAMS: DietProgram[] = [
  {
    id: 'high-protein-cut',
    name: 'High-protein cut',
    level: 'Beginner',
    description: 'Four simple meals around 1,800 kcal with lean protein at every sitting.',
    calories: 1800,
    protein: 165,
    carbs: 150,
    fat: 55,
    pattern: 'cycle',
    premium: false,
    days: [
      {
        name: 'Training day',
        meals: [
          meal('Greek yogurt bowl', 'breakfast', 420, 38, 42, 10, [
            { name: 'Nonfat Greek yogurt', grams: 250, calories: 150, protein: 26, carbs: 10, fat: 0 },
            { name: 'Blueberries', grams: 100, calories: 57, protein: 1, carbs: 14, fat: 0 },
            { name: 'Granola', grams: 40, calories: 180, protein: 5, carbs: 24, fat: 6 },
            { name: 'Honey', grams: 10, calories: 30, protein: 0, carbs: 8, fat: 0 },
          ]),
          meal('Chicken rice bowl', 'lunch', 560, 52, 55, 12, [
            { name: 'Chicken breast', grams: 180, calories: 297, protein: 56, carbs: 0, fat: 6 },
            { name: 'White rice, cooked', grams: 180, calories: 234, protein: 4, carbs: 51, fat: 0 },
            { name: 'Broccoli', grams: 120, calories: 41, protein: 3, carbs: 8, fat: 0 },
          ]),
          meal('Salmon + potatoes', 'dinner', 620, 48, 42, 24, [
            { name: 'Salmon', grams: 160, calories: 333, protein: 36, carbs: 0, fat: 20 },
            { name: 'Potato, baked', grams: 200, calories: 186, protein: 4, carbs: 42, fat: 0 },
            { name: 'Olive oil', grams: 8, calories: 72, protein: 0, carbs: 0, fat: 8 },
          ]),
          meal('Cottage cheese snack', 'snack', 200, 27, 11, 5, [
            { name: 'Cottage cheese', grams: 200, calories: 180, protein: 24, carbs: 8, fat: 5 },
            { name: 'Strawberries', grams: 80, calories: 26, protein: 1, carbs: 6, fat: 0 },
          ]),
        ],
      },
    ],
  },
  {
    id: 'balanced-maintain',
    name: 'Balanced maintain',
    level: 'Beginner',
    description: 'A weekday-style 2,200 kcal rotation you can copy and swap.',
    calories: 2200,
    protein: 155,
    carbs: 230,
    fat: 70,
    pattern: 'weekdays',
    premium: false,
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((name) => ({
      name,
      meals:
        name === 'Sunday' || name === 'Saturday'
          ? [
              meal('Oats + eggs', 'breakfast', 520, 32, 58, 16),
              meal('Turkey sandwich', 'lunch', 610, 42, 62, 18),
              meal('Pasta + chicken', 'dinner', 780, 48, 88, 22),
              meal('Fruit + yogurt', 'snack', 290, 18, 36, 6),
            ]
          : [
              meal('Eggs, toast, fruit', 'breakfast', 480, 30, 48, 16),
              meal('Beef rice bowl', 'lunch', 680, 46, 62, 22),
              meal('White fish + veg', 'dinner', 640, 48, 48, 20),
              meal('Protein shake', 'snack', 250, 30, 18, 4),
            ],
    })),
  },
  {
    id: 'performance-bulk',
    name: 'Performance bulk',
    level: 'Intermediate',
    description: 'Higher-calorie training days with named meals and ingredients you can copy.',
    calories: 2800,
    protein: 190,
    carbs: 330,
    fat: 80,
    pattern: 'cycle',
    premium: true,
    days: [
      {
        name: 'Lift day',
        meals: [
          meal('Bagel breakfast', 'breakfast', 720, 42, 88, 18, [
            { name: 'Bagel', grams: 110, calories: 290, protein: 11, carbs: 56, fat: 2 },
            { name: 'Eggs', grams: 150, calories: 215, protein: 19, carbs: 1, fat: 15 },
            { name: 'Banana', grams: 120, calories: 107, protein: 1, carbs: 27, fat: 0 },
            { name: 'Peanut butter', grams: 16, calories: 94, protein: 4, carbs: 3, fat: 8 },
          ]),
          meal('Burrito bowl', 'lunch', 820, 58, 90, 22),
          meal('Steak + rice', 'dinner', 900, 62, 80, 28),
          meal('Chocolate milk + oats', 'snack', 360, 28, 48, 8),
        ],
      },
      {
        name: 'Rest day',
        meals: [
          meal('Yogurt parfait', 'breakfast', 480, 36, 52, 12),
          meal('Chicken wrap', 'lunch', 640, 48, 58, 18),
          meal('Salmon pasta', 'dinner', 780, 46, 72, 28),
          meal('Greek yogurt', 'snack', 220, 22, 16, 6),
        ],
      },
    ],
  },
]
