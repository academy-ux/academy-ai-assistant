import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Talent Intelligence Report: AI & UX Design — Academy UX',
  description: 'Market insights on AI\'s impact on UX design roles, compensation, and hiring trends for 2026.',
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
