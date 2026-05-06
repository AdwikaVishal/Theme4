'use client'
/**
 * Lightweight i18n — no extra dependencies.
 * Uses Zustand (already installed) + the JSON message files.
 * Usage:
 *   const t = useT()
 *   t('nav.discovery')          // → "Discovery" | "ಶೋಧನೆ" | "खोज"
 *   t('discovery.found_candidates', { count: 5 })
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import en from '../../messages/en.json'
import kn from '../../messages/kn.json'
import hi from '../../messages/hi.json'

export type Locale = 'en' | 'kn' | 'hi'

const messages: Record<Locale, Record<string, unknown>> = { en, kn, hi }

/** Resolve a dot-path key like "nav.discovery" */
function resolve(obj: Record<string, unknown>, key: string): string {
  const parts = key.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return key
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : key
}

/** Replace {placeholder} tokens */
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

interface I18nStore {
  locale: Locale
  setLocale: (l: Locale) => void
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'mol-lang' }
  )
)

/** Hook — returns a translator function */
export function useT() {
  const locale = useI18nStore((s) => s.locale)
  return (key: string, params?: Record<string, string | number>): string => {
    const raw = resolve(messages[locale] as Record<string, unknown>, key)
    return interpolate(raw, params)
  }
}

/** Current locale (outside React) */
export function getLocale(): Locale {
  return useI18nStore.getState().locale
}
