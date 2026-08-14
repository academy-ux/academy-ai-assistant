import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function formatCurrency(n: number) {
  if (!Number.isFinite(n)) return '—'
  // Avoid the "-$0" render for tiny negative rounding artifacts
  return usd.format(Math.round(n) === 0 ? 0 : n)
}

export function formatPct(fraction: number, digits = 1) {
  if (!Number.isFinite(fraction)) return '—'
  return `${(fraction * 100).toFixed(digits)}%`
}
