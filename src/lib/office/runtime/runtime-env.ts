/** Vite runtime environment detection (ported from SwarmClaw's process.env version). */
export function isProductionRuntime(): boolean {
  return import.meta.env.PROD
}

export function isDevelopmentLikeRuntime(): boolean {
  return !isProductionRuntime()
}
