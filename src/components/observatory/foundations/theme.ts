import { type CSSProperties } from "react"

/* AIOX light operational palette.
 * Component-scoped so the Observatory can stay light even inside the
 * dark-first Brandbook shell. Values defer to the canonical DS tokens
 * from globals.css, with stable fallbacks for isolated renders. */
export const observatoryThemeVars: CSSProperties = {
  "--paper": "oklch(0.9644 0.0172 103.15)",
  "--paper-alt": "oklch(0.9252 0.0174 103.16)",
  "--paper-deep": "oklch(0.89 0.015 103.16)",
  "--ink": "oklch(0.235 0.0116 122.3)",
  "--ink-2": "rgba(50, 52, 43, 0.78)",
  "--ink-3": "rgba(50, 52, 43, 0.55)",
  "--ink-dim": "rgba(50, 52, 43, 0.38)",
  "--ink-faint": "rgba(50, 52, 43, 0.18)",
  "--rule": "rgba(156, 156, 156, 0.24)",
  "--rule-soft": "rgba(156, 156, 156, 0.12)",
  "--rule-strong": "rgba(156, 156, 156, 0.35)",
  "--lime-ink": "oklch(0.6801 0.1625 120.61)",
  "--lime-fill": "var(--primary, oklch(0.934 0.2264 121.95))",
  "--warning-ink": "oklch(0.48 0.13 70.08)",
  "--danger-ink": "oklch(0.6368 0.2078 25.33)",
  "--dash-control-h": "34px",
  "--dash-header-h": "44px",
  "--serif": "var(--font-bb-sans), 'Geist', system-ui, sans-serif",
} as CSSProperties

export const observatoryDarkThemeVars: CSSProperties = {
  "--paper": "var(--aiox-dark, #050505)",
  "--paper-alt": "var(--aiox-surface, #101012)",
  "--paper-deep": "var(--aiox-surface-2, #171719)",
  "--ink": "var(--aiox-cream-alt, #f5f4e7)",
  "--ink-2": "rgba(245, 244, 231, 0.78)",
  "--ink-3": "rgba(245, 244, 231, 0.55)",
  "--ink-dim": "rgba(245, 244, 231, 0.38)",
  "--ink-faint": "rgba(245, 244, 231, 0.18)",
  "--rule": "rgba(245, 244, 231, 0.16)",
  "--rule-soft": "rgba(245, 244, 231, 0.08)",
  "--rule-strong": "rgba(245, 244, 231, 0.28)",
  "--lime-ink": "var(--aiox-lime, #d1ff00)",
  "--lime-fill": "var(--aiox-lime, #d1ff00)",
  "--warning-ink": "oklch(0.79 0.17 72)",
  "--danger-ink": "oklch(0.73 0.22 25)",
  "--dash-control-h": "34px",
  "--dash-header-h": "44px",
  "--serif": "var(--font-bb-sans), 'Geist', system-ui, sans-serif",
} as CSSProperties

export const MONO_FONT = "var(--font-bb-mono), 'Geist Mono', ui-monospace, monospace"
export const SANS_FONT = "var(--font-bb-sans), 'Geist', system-ui, sans-serif"
export const DISPLAY_FONT = "var(--font-bb-display), var(--font-bb-sans), system-ui, sans-serif"
export const SERIF_FONT = SANS_FONT
