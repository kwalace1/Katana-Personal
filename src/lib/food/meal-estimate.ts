export type MealEstimate = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  estimatedGrams?: number
  confidence?: 'low' | 'medium' | 'high'
  note?: string
}
