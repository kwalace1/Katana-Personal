/**
 * Timeout wrapper for preventing hanging promises
 * Use this to wrap any async operations that might hang
 */

export interface TimeoutOptions {
  timeoutMs?: number
  errorMessage?: string
  fallbackValue?: any
}

/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param options Timeout options
 * @returns The result of the promise or throws timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const {
    timeoutMs = 5000,
    errorMessage = 'Operation timed out',
    fallbackValue = undefined,
  } = options

  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => {
      console.error(`⏱️ Timeout: ${errorMessage}`)
      if (fallbackValue !== undefined) {
        // Don't reject, resolve with fallback
        reject(new Error(errorMessage))
      } else {
        reject(new Error(errorMessage))
      }
    }, timeoutMs)
  )

  try {
    return await Promise.race([promise, timeoutPromise])
  } catch (error) {
    // If timeout and we have a fallback, return it
    if (fallbackValue !== undefined) {
      console.warn(`⚠️ Using fallback value for: ${errorMessage}`)
      return fallbackValue as T
    }
    throw error
  }
}

/**
 * Wraps multiple promises with a timeout
 * Returns partial results if some fail
 */
export async function withTimeoutAll<T>(
  promises: Promise<T>[],
  options: TimeoutOptions = {}
): Promise<T[]> {
  const { timeoutMs = 5000 } = options

  return await Promise.all(
    promises.map((promise) =>
      withTimeout(promise, {
        ...options,
        timeoutMs,
      }).catch((error) => {
        console.error('Promise failed in withTimeoutAll:', error)
        return options.fallbackValue as T
      })
    )
  )
}




