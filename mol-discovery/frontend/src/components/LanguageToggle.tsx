'use client'
import { useState } from 'react'
import { useI18nStore, type Locale } from '@/lib/i18n'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Language toggle supporting English, Kannada, and Hindi.
 *
 * When switching to a non-English locale:
 *  1. Instantly swaps all static strings via the Zustand i18n store (JSON-based).
 *  2. Walks the DOM for any remaining English text nodes and batch-translates
 *     them via POST /api/translate/page-batch (Sarvam API).
 *
 * Switching back to English reloads the page — cleanest way to restore
 * original DOM text without tracking every mutation.
 */

const LOCALE_CONFIG: Record<Locale, {
  label: string
  icon: string
  target: string   // Sarvam target locale code
  title: string
}> = {
  en: { label: 'EN',      icon: '🌐', target: 'en-IN', title: 'Switch language' },
  kn: { label: 'ಕನ್ನಡ',  icon: '🇮🇳', target: 'kn-IN', title: 'Switch to English' },
  hi: { label: 'हिंदी',   icon: '🇮🇳', target: 'hi-IN', title: 'Switch to English' },
}

const LOCALE_CYCLE: Locale[] = ['en', 'kn', 'hi']

async function translateDomTo(targetLocale: string) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const el = node.parentElement
        if (!el) return NodeFilter.FILTER_REJECT
        if (el.closest('script, style, noscript, [data-no-translate]'))
          return NodeFilter.FILTER_REJECT
        if (el.closest('[data-translated="true"]'))
          return NodeFilter.FILTER_REJECT
        const text = node.textContent?.trim() ?? ''
        if (text.length > 1 && /[a-zA-Z]{2,}/.test(text))
          return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_REJECT
      },
    }
  )

  let node: Node | null
  while ((node = walker.nextNode())) nodes.push(node as Text)
  if (nodes.length === 0) return

  const originalTexts = nodes.map(n => n.textContent?.trim() ?? '')

  try {
    const res = await fetch(`${API_BASE}/api/translate/page-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: originalTexts, source: 'en-IN', target: targetLocale }),
    })

    if (res.ok) {
      const { translations }: { translations: string[] } = await res.json()
      nodes.forEach((n, i) => {
        if (translations[i] && translations[i] !== n.textContent) {
          n.textContent = translations[i]
          if (n.parentElement)
            n.parentElement.setAttribute('data-translated', 'true')
        }
      })
    }
  } catch (err) {
    console.warn('Page-batch translation failed (static strings still translated):', err)
  }
}

export default function LanguageToggle() {
  const { locale, setLocale } = useI18nStore()
  const [translating, setTranslating] = useState(false)

  const currentIdx = LOCALE_CYCLE.indexOf(locale)
  const nextLocale = LOCALE_CYCLE[(currentIdx + 1) % LOCALE_CYCLE.length]
  const nextConfig = LOCALE_CONFIG[nextLocale]
  const currentConfig = LOCALE_CONFIG[locale]

  const handleClick = async () => {
    if (nextLocale === 'en') {
      // Restore English — reload is the simplest reliable reset
      setLocale('en')
      window.location.reload()
      return
    }

    // ── Step 1: instant static swap ──────────────────────────────────
    setLocale(nextLocale)
    setTranslating(true)

    // Give React one tick to re-render with translated static strings
    await new Promise(r => setTimeout(r, 80))

    // ── Step 2: translate remaining DOM text nodes ───────────────────
    await translateDomTo(nextConfig.target)

    setTranslating(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={translating}
      title={currentConfig.title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border
                 border-blue-400 dark:border-blue-500
                 bg-blue-50 dark:bg-blue-900/30
                 text-blue-700 dark:text-blue-300
                 text-sm font-semibold
                 hover:bg-blue-100 dark:hover:bg-blue-800/40
                 disabled:opacity-60 disabled:cursor-wait
                 transition-colors select-none"
    >
      <span className="text-base leading-none">
        {translating ? '⏳' : nextConfig.icon}
      </span>
      <span>
        {translating ? '...' : nextConfig.label}
      </span>
    </button>
  )
}
