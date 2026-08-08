export type NutritionLabelEstimate = {
  name: string
  servingSizeLabel?: string
  servingGrams?: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence?: 'low' | 'medium' | 'high'
  note?: string
}
