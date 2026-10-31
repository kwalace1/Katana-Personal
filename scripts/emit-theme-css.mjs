import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('src/theme/families.ts', 'utf8')
const names = [
  'SUNRISE_LIGHT',
  'SUNRISE_DARK',
  'SUNSET_LIGHT',
  'SUNSET_DARK',
  'OCEAN_LIGHT',
  'OCEAN_DARK',
  'FOREST_LIGHT',
  'FOREST_DARK',
  'SPRING_LIGHT',
  'SPRING_DARK',
  'SUMMER_LIGHT',
  'SUMMER_DARK',
  'AUTUMN_LIGHT',
  'AUTUMN_DARK',
  'WINTER_LIGHT',
  'WINTER_DARK',
]
const selectors = {
  SUNRISE_LIGHT: "[data-theme='sunrise']",
  SUNRISE_DARK: ".dark[data-theme='sunrise']",
  SUNSET_LIGHT: "[data-theme='sunset']",
  SUNSET_DARK: ".dark[data-theme='sunset']",
  OCEAN_LIGHT: "[data-theme='ocean']",
  OCEAN_DARK: ".dark[data-theme='ocean']",
  FOREST_LIGHT: "[data-theme='forest']",
  FOREST_DARK: ".dark[data-theme='forest']",
  SPRING_LIGHT: "[data-theme='spring']",
  SPRING_DARK: ".dark[data-theme='spring']",
  SUMMER_LIGHT: "[data-theme='summer']",
  SUMMER_DARK: ".dark[data-theme='summer']",
  AUTUMN_LIGHT: "[data-theme='autumn']",
  AUTUMN_DARK: ".dark[data-theme='autumn']",
  WINTER_LIGHT: "[data-theme='winter']",
  WINTER_DARK: ".dark[data-theme='winter']",
}

function block(name) {
  const re = new RegExp(`export const ${name}[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\n\\}`)
  const match = src.match(re)
  if (!match) throw new Error(`missing ${name}`)
  return [...match[1].matchAll(/'(--[^']+)': '([^']+)'/g)]
    .map(([, key, value]) => `  ${key}: ${value};`)
    .join('\n')
}

let css = '/* Atmosphere and seasonal themes. Classic stays on :root and .dark in index.css. */\n'
for (const name of names) {
  css += `\n${selectors[name]} {\n${block(name)}\n}\n`
}
writeFileSync('src/theme/families.css', css)
console.log('wrote', css.length)
