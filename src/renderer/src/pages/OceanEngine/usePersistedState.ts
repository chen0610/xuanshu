import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

interface UsePersistedStateOptions<T> {
  serialize?: (value: T) => string
  deserialize?: (raw: string) => T
  shouldPersist?: (value: T) => boolean
}

const defaultSerialize = <T>(value: T): string => String(value)

export function usePersistedState<T>(
  key: string,
  defaultValue: T | (() => T),
  options: UsePersistedStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const { serialize = defaultSerialize, deserialize, shouldPersist = () => true } = options

  const [value, setValue] = useState<T>(() => {
    const fallback = defaultValue instanceof Function ? defaultValue() : defaultValue

    try {
      const stored = localStorage.getItem(key)
      if (stored === null) return fallback
      return deserialize ? deserialize(stored) : (stored as T)
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    if (!shouldPersist(value)) return

    try {
      localStorage.setItem(key, serialize(value))
    } catch {
      // localStorage may be unavailable in restricted environments.
    }
  }, [key, serialize, shouldPersist, value])

  return [value, setValue]
}

export const persistNonEmptyString = (value: string): boolean => value.length > 0
export const deserializeBoolean = (raw: string): boolean => raw === 'true'
