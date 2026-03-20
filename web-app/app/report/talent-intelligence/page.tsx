'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { slides, reportMeta } from '@/components/report/report-data'
import { ShareDialog } from '@/components/report/ShareDialog'
import { Share2, Download, Presentation, Menu, X, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── SLIDE RENDERERS ──

function CoverSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-end px-8 md:px-16 lg:px-24 pb-16 md:pb-24 relative">
      <div className="absolute top-8 left-8 md:left-16 lg:left-24 text-[13px] text-foreground/30 font-normal italic tracking-wide">
        {reportMeta.confidential}
      </div>
      <div className="absolute top-8 right-8 md:right-16 lg:right-24 text-[13px] text-foreground/30 font-normal">
        {reportMeta.date}
      </div>
      <h1 className="text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.92] tracking-[-0.03em] text-black whitespace-pre-line">
        {slide.title}
      </h1>
      {slide.titleSecondary && (
        <span className="text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.92] tracking-[-0.03em] text-foreground/25 block">
          {slide.titleSecondary}
        </span>
      )}
      <div className="mt-16 flex flex-col md:flex-row gap-4 md:gap-0">
        <div className="md:flex-1" />
        <div className="flex flex-col md:flex-row gap-4 md:gap-16">
          <p className="text-[15px] text-foreground/40 font-normal max-w-xs">{slide.content.leftText}</p>
          <p className="text-[15px] text-foreground/40 font-normal max-w-xs">{slide.content.rightText}</p>
        </div>
      </div>
    </div>
  )
}

function SectionDividerSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-between px-8 md:px-16 lg:px-24 py-10 bg-[#111111] text-white relative overflow-hidden">
      {/* Main title */}
      <div className="flex-1 flex items-start pt-8">
        <h2 className="text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.95] tracking-[-0.03em] text-white whitespace-pre-line">
          {slide.title}
        </h2>
      </div>
      {/* Bottom bar */}
      <div className="flex items-end justify-between">
        <span className="text-[2.5rem] md:text-[3.5rem] font-bold text-white/90 tabular-nums leading-none">
          {slide.chapterNumber !== undefined ? String(slide.chapterNumber).padStart(2, '0') : ''}
        </span>
        <div className="flex gap-12">
          {slide.subtitle && (
            <span className="text-[13px] text-white/50 font-normal">{slide.subtitle}</span>
          )}
          <span className="text-[13px] text-white/50 font-normal">{reportMeta.title}</span>
        </div>
      </div>
    </div>
  )
}

function TwoColumnSlide({ slide }: { slide: typeof slides[0] }) {
  const { content } = slide
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      {slide.subtitle && (
        <p className="text-[13px] font-normal text-foreground/35 tracking-wide mb-3">{slide.subtitle}</p>
      )}
      <div className="flex flex-col md:flex-row gap-12 md:gap-20">
        {/* Left: title */}
        <div className="md:w-[40%] shrink-0">
          <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line">
            {slide.title}
          </h2>
          {slide.titleSecondary && (
            <span className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground/30 whitespace-pre-line block">
              {slide.titleSecondary}
            </span>
          )}
          {content.bodyText && !content.bigNumber && (
            <p className="text-[14px] text-foreground/45 font-normal mt-6 max-w-md leading-[1.7]">{content.bodyText}</p>
          )}
        </div>

        {/* Right: content */}
        <div className="flex-1">
          {/* Two sub-columns of text */}
          {content.leftText && content.rightText && !content.bullets && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                {content.leftText.split('\n\n').map((p, i) => (
                  <p key={i} className="text-[14px] text-foreground/55 font-normal leading-[1.7]">{p}</p>
                ))}
              </div>
              <div className="space-y-4">
                {content.rightText.split('\n\n').map((p, i) => (
                  <p key={i} className="text-[14px] text-foreground/55 font-normal leading-[1.7]">{p}</p>
                ))}
                {content.rightList && (
                  <ol className="mt-3 space-y-2">
                    {content.rightList.map((item, i) => (
                      <li key={i} className="text-[14px] text-foreground/55 font-normal leading-[1.7]">
                        <span className="font-semibold text-black/70">{i + 1}.</span> {item}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}

          {/* Bullets + right list layout (role evolution style) */}
          {content.bullets && (
            <div className="space-y-10">
              <div>
                {content.leftText && (
                  <h3 className="text-[16px] font-semibold text-black/70 mb-4">{content.leftText}</h3>
                )}
                <ul className="space-y-3">
                  {content.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2.5 text-[14px] text-foreground/50 font-normal leading-[1.7]">
                      <span className="text-foreground/25 mt-0.5 shrink-0">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              {content.rightText && (
                <div className="border-t border-black/[0.08] pt-8">
                  <h3 className="text-[16px] font-semibold text-black/70 mb-4">{content.rightText}</h3>
                  {content.rightList && (
                    <ul className="space-y-3">
                      {content.rightList.map((item, i) => (
                        <li key={i} className="flex gap-2.5 text-[14px] text-foreground/50 font-normal leading-[1.7]">
                          <span className="text-foreground/25 mt-0.5 shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MarketStatsSlide({ slide }: { slide: typeof slides[0] }) {
  const { content } = slide
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      {slide.subtitle && (
        <p className="text-[13px] font-normal text-foreground/35 tracking-wide mb-3">{slide.subtitle}</p>
      )}
      <div className="flex flex-col md:flex-row gap-12 md:gap-20">
        {/* Left: title + body */}
        <div className="md:w-[40%] shrink-0">
          <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line">
            {slide.title}
          </h2>
          {content.bodyText && (
            <p className="text-[13px] text-foreground/40 font-normal mt-8 max-w-sm leading-[1.7]">{content.bodyText}</p>
          )}
        </div>

        {/* Right: stacked stat cards with top borders */}
        <div className="flex-1 space-y-0">
          {content.stats?.map((stat, i) => (
            <div key={i} className="border-t-[3px] border-black pt-5 pb-8">
              <p className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-black tracking-[-0.02em] leading-none mb-3">
                {stat.value}
              </p>
              <p className="text-[13px] text-foreground/40 font-normal leading-[1.7] max-w-md">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatsGridSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line">
        {slide.title}
      </h2>
      {slide.titleSecondary && (
        <span className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground/25 block mb-12">
          {slide.titleSecondary}
        </span>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {slide.content.stats?.map((stat, i) => (
          <div key={i} className="bg-[#f5f5f3] rounded-2xl p-6">
            <p className="text-[14px] font-semibold text-black/70 mb-2">{stat.label}</p>
            <p className="text-[13px] text-foreground/40 font-normal leading-[1.7]">{stat.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TableSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      <div className="flex flex-col md:flex-row gap-12 md:gap-20">
        {/* Left: title + footnote */}
        <div className="md:w-[35%] shrink-0">
          <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line mb-8">
            {slide.title}
          </h2>
          <div className="text-[13px] text-foreground/35 font-normal leading-[1.7] space-y-3 max-w-xs">
            <p>{slide.subtitle}</p>
            <p><strong className="text-foreground/60">Anthropic sets the ceiling.</strong> Some senior candidates won't engage below $1M+ base.</p>
          </div>
        </div>

        {/* Right: table */}
        <div className="flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/10">
                <th className="text-left pb-3 text-[12px] font-normal text-foreground/35">Company</th>
                <th className="text-left pb-3 text-[12px] font-normal text-foreground/35">Role</th>
                <th className="text-right pb-3 text-[12px] font-normal text-foreground/35">Base Salary</th>
              </tr>
            </thead>
            <tbody>
              {slide.content.companies?.map((row, i) => (
                <tr key={i} className="border-b border-black/[0.06]">
                  <td className="py-3.5 text-[14px] font-medium text-black/70">{row.company}</td>
                  <td className="py-3.5 text-[14px] font-normal text-foreground/45">{row.role}</td>
                  <td className="py-3.5 text-[14px] font-medium text-black/70 text-right tabular-nums">{row.salary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function QuoteSlide({ slide }: { slide: typeof slides[0] }) {
  const { content } = slide
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line mb-4">
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p className="text-[14px] text-foreground/40 font-normal mb-10">{slide.subtitle}</p>
      )}
      <div className="flex flex-col md:flex-row gap-12 md:gap-0">
        {/* Left: body text */}
        <div className="md:w-[45%] md:pr-12">
          {content.bodyText && (
            <div className="space-y-4">
              {content.bodyText.split('\n\n').map((p, i) => (
                <p key={i} className="text-[14px] text-foreground/50 font-normal leading-[1.7]">{p}</p>
              ))}
            </div>
          )}
        </div>

        {/* Vertical divider */}
        <div className="hidden md:block w-px bg-black/10 shrink-0" />

        {/* Right: quote */}
        <div className="md:flex-1 md:pl-12 flex flex-col justify-center">
          {content.quote && (
            <blockquote>
              <p className="text-[clamp(1.1rem,2.5vw,1.5rem)] font-medium text-black/65 leading-[1.5] text-center">
                &ldquo;{content.quote}&rdquo;
              </p>
              <footer className="mt-6 text-center">
                <p className="text-[13px] font-medium text-foreground/50">{content.attribution}, <span className="text-foreground/35 font-normal">{content.attributionTitle}</span></p>
              </footer>
            </blockquote>
          )}
        </div>
      </div>
    </div>
  )
}

function CardsGridSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      <h2 className="text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line">
        {slide.title}
      </h2>
      {slide.titleSecondary && (
        <span className="text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground/30 block">
          {slide.titleSecondary}
        </span>
      )}
      {slide.subtitle && (
        <p className="text-[14px] text-foreground/35 font-normal mt-2 mb-10">{slide.subtitle}</p>
      )}
      {!slide.subtitle && <div className="mb-10" />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slide.content.cards?.map((card, i) => (
          <div key={i} className="bg-[#f5f5f3] rounded-2xl p-6">
            <h3 className="text-[14px] font-semibold text-black/70 mb-2">{card.title}</h3>
            <p className="text-[13px] text-foreground/40 font-normal leading-[1.7]">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThreeTierSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      {slide.subtitle && (
        <p className="text-[13px] text-foreground/35 font-normal mb-3 max-w-2xl">{slide.subtitle}</p>
      )}
      <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line mb-14">
        {slide.title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slide.content.tiers?.map((tier, i) => (
          <div
            key={i}
            className={cn(
              "rounded-2xl p-7",
              i === 2 ? "bg-black/[0.04] ring-1 ring-black/[0.06]" : "bg-[#f5f5f3]"
            )}
          >
            <span className="text-[11px] font-semibold text-foreground/25 uppercase tracking-[0.15em]">{tier.tier}</span>
            <h3 className="text-[18px] font-bold text-black/75 mt-1.5 mb-3">{tier.label}</h3>
            <p className="text-[13px] text-foreground/40 font-normal leading-[1.7]">{tier.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompanyProfilesSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      <h2 className="text-[clamp(2rem,4.5vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line mb-3">
        {slide.title}
      </h2>
      {slide.subtitle && (
        <p className="text-[14px] text-foreground/35 font-normal mb-10 max-w-2xl">{slide.subtitle}</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {slide.content.profiles?.map((profile, i) => (
          <div key={i} className="bg-[#f5f5f3] rounded-2xl p-5">
            {/* Company label pill */}
            <span className="inline-block text-[10px] font-medium text-foreground/40 bg-black/[0.05] rounded px-2 py-0.5 mb-3 tracking-wide">
              {profile.name}
            </span>
            <p className="text-[14px] font-semibold text-black/70 mb-3 leading-snug">{profile.headline}</p>
            <ul className="space-y-1.5">
              {profile.details.map((d, j) => (
                <li key={j} className="text-[12px] text-foreground/40 font-normal leading-[1.6]">{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecommendationsSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground/30 whitespace-pre-line mb-10">
        {slide.title}
      </h2>
      <div className="space-y-4">
        {slide.content.recommendations?.map((rec, i) => (
          <div key={i} className="bg-[#f5f5f3] rounded-2xl p-6 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-black/70 mb-1.5">{rec.title}</h3>
              <p className="text-[13px] text-foreground/40 font-normal leading-[1.7]">{rec.description}</p>
            </div>
            <span className="text-[11px] font-medium text-foreground/30 bg-black/[0.04] px-3 py-1.5 rounded-lg whitespace-nowrap self-start">
              {rec.timing}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClosingSlide({ slide }: { slide: typeof slides[0] }) {
  return (
    <div className="report-slide min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 py-20">
      {slide.subtitle && (
        <p className="text-[13px] text-foreground/30 font-normal mb-3">{slide.subtitle}</p>
      )}
      <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.05] tracking-[-0.02em] text-black whitespace-pre-line mb-10">
        {slide.title}
      </h2>
      <p className="text-[12px] font-semibold text-foreground/25 uppercase tracking-[0.15em] mb-6">Three deep dives planned</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {slide.content.nextSteps?.map((step, i) => (
          <div key={i} className="bg-[#f5f5f3] rounded-2xl p-6">
            <span className="text-[2rem] font-bold text-black/10 tabular-nums">{i + 1}</span>
            <h3 className="text-[14px] font-semibold text-black/65 mt-2 mb-1.5">{step.title}</h3>
            <p className="text-[13px] text-foreground/40 font-normal leading-[1.7]">{step.description}</p>
          </div>
        ))}
      </div>
      {slide.content.bodyText && (
        <div className="text-center border-t border-black/[0.06] pt-8">
          {slide.content.bodyText.split('\n').map((line, i) => (
            <p key={i} className="text-[14px] text-foreground/30 font-normal">{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SLIDE RENDERER MAP ──

function SlideRenderer({ slide }: { slide: typeof slides[0] }) {
  switch (slide.type) {
    case 'cover': return <CoverSlide slide={slide} />
    case 'section-divider': return <SectionDividerSlide slide={slide} />
    case 'section-header': return <SectionDividerSlide slide={slide} />
    case 'two-column': return <TwoColumnSlide slide={slide} />
    case 'market-stats': return <MarketStatsSlide slide={slide} />
    case 'stats-grid': return <StatsGridSlide slide={slide} />
    case 'table': return <TableSlide slide={slide} />
    case 'quote': return <QuoteSlide slide={slide} />
    case 'cards-grid': return <CardsGridSlide slide={slide} />
    case 'three-tier': return <ThreeTierSlide slide={slide} />
    case 'company-profiles': return <CompanyProfilesSlide slide={slide} />
    case 'recommendations': return <RecommendationsSlide slide={slide} />
    case 'closing': return <ClosingSlide slide={slide} />
    default: return null
  }
}

// ── MAIN PAGE ──

export default function TalentIntelligenceReport() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  // Intersection observer for tracking active slide
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = slideRefs.current.indexOf(entry.target as HTMLDivElement)
            if (idx !== -1) setActiveSlide(idx)
          }
        })
      },
      { threshold: 0.4, root: isPresenting ? containerRef.current : null }
    )

    slideRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [isPresenting])

  // Keyboard navigation — always active (left/right arrows navigate slides)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'ArrowRight' || (isPresenting && (e.key === 'ArrowDown' || e.key === ' '))) {
        e.preventDefault()
        const next = Math.min(activeSlide + 1, slides.length - 1)
        slideRefs.current[next]?.scrollIntoView({ behavior: 'smooth' })
      } else if (e.key === 'ArrowLeft' || (isPresenting && e.key === 'ArrowUp')) {
        e.preventDefault()
        const prev = Math.max(activeSlide - 1, 0)
        slideRefs.current[prev]?.scrollIntoView({ behavior: 'smooth' })
      } else if (e.key === 'Escape' && isPresenting) {
        setIsPresenting(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isPresenting, activeSlide])

  const scrollToSlide = useCallback((idx: number) => {
    slideRefs.current[idx]?.scrollIntoView({ behavior: 'smooth' })
    setSidebarOpen(false)
  }, [])

  const handleExportPDF = () => {
    window.print()
  }

  const handlePresent = () => {
    setIsPresenting(true)
    slideRefs.current[0]?.scrollIntoView({ behavior: 'instant' })
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  // Build chapter index for sidebar
  const chapterIndex: { chapter: string; slideIdx: number }[] = []
  const seen = new Set<string>()
  slides.forEach((s, i) => {
    if (!seen.has(s.chapter)) {
      seen.add(s.chapter)
      chapterIndex.push({ chapter: s.chapter, slideIdx: i })
    }
  })

  const currentSlide = slides[activeSlide]
  const isDarkSlide = currentSlide?.dark

  return (
    <div className="fixed inset-0 z-[60] bg-[#f0eeeb] overflow-hidden flex">
      {/* ── LEFT NAV DOTS ── */}
      <div className={cn(
        "hidden md:flex flex-col items-center justify-center w-8 shrink-0 gap-1 z-20 print:hidden transition-colors duration-500",
        isDarkSlide ? "bg-[#111111]" : "bg-transparent"
      )}>
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => scrollToSlide(i)}
            className={cn(
              "w-1 rounded-full transition-all duration-300",
              i === activeSlide
                ? cn("h-4", isDarkSlide ? "bg-white/60" : "bg-black/50")
                : cn("h-1", isDarkSlide ? "bg-white/15 hover:bg-white/30" : "bg-black/10 hover:bg-black/25")
            )}
            title={slides[i].title.split('\n')[0]}
          />
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── TOP BAR ── */}
        <div className={cn(
          "shrink-0 flex items-center justify-between px-4 md:px-6 h-11 z-20 print:hidden transition-all duration-500",
          isPresenting ? "opacity-0 hover:opacity-100" : "opacity-100",
          isDarkSlide ? "bg-[#111111]" : "bg-transparent"
        )}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            >
              {sidebarOpen
                ? <X className={cn("h-4 w-4", isDarkSlide ? "text-white/40" : "text-foreground/40")} />
                : <Menu className={cn("h-4 w-4", isDarkSlide ? "text-white/40" : "text-foreground/40")} />
              }
            </button>
            <div className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1",
              isDarkSlide ? "bg-white/[0.06]" : "bg-black/[0.05]"
            )}>
              <span className={cn("text-[12px] font-medium hidden sm:inline", isDarkSlide ? "text-white/50" : "text-foreground/45")}>
                {reportMeta.title}
              </span>
              {activeSlide > 0 && (
                <>
                  <span className={cn("text-[12px] hidden sm:inline", isDarkSlide ? "text-white/20" : "text-black/15")}>/</span>
                  <span className={cn("text-[12px] hidden sm:inline", isDarkSlide ? "text-white/30" : "text-foreground/25")}>
                    Chapter {chapterIndex.findIndex(c => slides[activeSlide].chapter === c.chapter) + 1} of {chapterIndex.length}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {[
              { label: 'Share', icon: Share2, onClick: () => setShareOpen(true) },
              { label: 'Export', icon: Download, onClick: handleExportPDF },
              { label: isPresenting ? 'Exit' : 'Present', icon: Presentation, onClick: isPresenting ? () => { setIsPresenting(false); document.exitFullscreen?.().catch(() => {}) } : handlePresent },
            ].map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                  isDarkSlide
                    ? "text-white/50 hover:bg-white/[0.06]"
                    : "text-foreground/45 hover:bg-black/[0.04]"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── SLIDE CONTAINER ── */}
        <div
          ref={containerRef}
          className={cn(
            "flex-1 overflow-y-auto scroll-smooth",
            isPresenting && "snap-y snap-mandatory"
          )}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              ref={(el) => { slideRefs.current[i] = el }}
              className={cn(
                "relative",
                isPresenting && "snap-start snap-always"
              )}
              data-slide-id={slide.id}
            >
              <div className={cn(
                slide.dark ? "bg-[#111111]" : "bg-[#eceae6]",
              )}>
                <div className={cn(
                  "mx-auto",
                  slide.dark ? "max-w-full" : "max-w-[1400px]"
                )}>
                  <SlideRenderer slide={slide} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MOBILE SIDEBAR ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 md:hidden print:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#f0eeeb] border-r border-black/10 p-6 pt-16 overflow-y-auto">
            <p className="text-[11px] font-semibold text-foreground/25 uppercase tracking-[0.15em] mb-4">Chapters</p>
            <div className="space-y-0.5">
              {chapterIndex.map((ch) => (
                <button
                  key={ch.chapter}
                  onClick={() => scrollToSlide(ch.slideIdx)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                    slides[activeSlide].chapter === ch.chapter
                      ? "bg-black/[0.06] text-black/70"
                      : "text-foreground/35 hover:text-foreground/55 hover:bg-black/[0.03]"
                  )}
                >
                  {ch.chapter}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SHARE DIALOG ── */}
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={reportMeta.title}
      />

      {/* ── BACK TO TOP ── */}
      {activeSlide > 2 && !isPresenting && (
        <button
          onClick={() => scrollToSlide(0)}
          className="fixed bottom-6 right-6 z-20 h-9 w-9 rounded-full bg-black/[0.06] hover:bg-black/10 flex items-center justify-center transition-all print:hidden"
        >
          <ArrowUp className="h-3.5 w-3.5 text-foreground/40" />
        </button>
      )}
    </div>
  )
}
