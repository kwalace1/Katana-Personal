import { macrosForGrams, type FoodHit } from '@/lib/food/open-food-facts'
import type { MealEstimate } from '@/lib/food/meal-estimate'
import type { NutritionLabelEstimate } from '@/lib/food/nutrition-label'
import type { MealIngredient } from './types'

export function sumMacros(
  items: { calories?: number; protein?: number; carbs?: number; fat?: number }[],
): { calories: number; protein: number; carbs: number; fat: number } {
  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  for (const item of items) {
    calories += Number(item.calories) || 0
    protein += Number(item.protein) || 0
    carbs += Number(item.carbs) || 0
    fat += Number(item.fat) || 0
  }
  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  }
}

export function ingredientFromFood(hit: FoodHit, grams: number): MealIngredient {
  const macros = macrosForGrams(hit, grams)
  return {
    name: hit.brand && hit.source !== 'usda' && !hit.code.startsWith('usda:') ? `${hit.name} (${hit.brand})` : hit.name,
    grams: Math.round(grams),
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    code: hit.code,
    brand: hit.brand,
    source: hit.source === 'usda' ? 'usda' : 'off',
  }
}

export function rescaleIngredient(item: MealIngredient, grams: number): MealIngredient {
  const g = Math.max(0, grams)
  if (!item.grams || item.grams <= 0) {
    return { ...item, grams: Math.round(g) }
  }
  const f = g / item.grams
  return {
    ...item,
    grams: Math.round(g),
    calories: Math.round(item.calories * f),
    protein: Math.round(item.protein * f * 10) / 10,
    carbs: Math.round(item.carbs * f * 10) / 10,
    fat: Math.round(item.fat * f * 10) / 10,
  }
}

export function ingredientFromLabel(label: NutritionLabelEstimate): MealIngredient {
  const grams = label.servingGrams && label.servingGrams > 0 ? label.servingGrams : 100
  return {
    name: label.name,
    grams: Math.round(grams),
    calories: label.calories,
    protein: label.protein,
    carbs: label.carbs,
    fat: label.fat,
    source: 'label',
  }
}

export function ingredientFromEstimate(estimate: MealEstimate): MealIngredient {
  return {
    name: estimate.name,
    grams: estimate.estimatedGrams && estimate.estimatedGrams > 0 ? Math.round(estimate.estimatedGrams) : 0,
    calories: estimate.calories,
    protein: estimate.protein,
    carbs: estimate.carbs,
    fat: estimate.fat,
    source: 'estimate',
  }
}

export function cloneIngredients(items: MealIngredient[] | undefined): MealIngredient[] {
  return (items || []).map((item) => ({ ...item }))
}
