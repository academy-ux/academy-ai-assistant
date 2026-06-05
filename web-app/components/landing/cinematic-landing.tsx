'use client'

import { useRef } from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import {
  ArrowRight,
  FileText,
  BarChart3,
  Waves,
  RefreshCw,
  Sparkles,
  Check,
} from 'lucide-react'
import { Orb } from '@/components/ui/orb'
import { useCinematicMotion } from './use-cinematic-motion'

export function CinematicLanding() {
  const rootRef = useRef<HTMLDivElement>(null)
  useCinematicMotion(rootRef)

  return (
    <div ref={rootRef} className="cinematic-cursor-area relative bg-background text-foreground">
      {/* ── Custom cursor ─────────────────────────────────────────────── */}
      <div data-cursor aria-hidden="true">
        <span data-cursor-text />
      </div>

      {/* ── Preloader ─────────────────────────────────────────────────── */}
      <div
        data-preloader
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#272727] text-[#e3e5de]"
      >
        <div className="flex flex-col items-center gap-8 px-6">
          <span className="text-xs uppercase tracking-[0.4em] text-[#e3e5de]/50">
            Academy
          </span>
          <span className="font-serif italic text-3xl sm:text-4xl tracking-tight text-[#e3e5de]">
            Interview Assistant
          </span>
          <div className="mt-2 h-px w-[180px] sm:w-[240px] overflow-hidden bg-[#e3e5de]/15">
            <div
              data-preloader-bar
              className="h-full w-full origin-left bg-[#ebba99]"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        </div>
        <span
          data-preloader-count
          className="absolute bottom-8 right-8 text-xs tabular-nums tracking-[0.3em] text-[#e3e5de]/40"
        >
          00
        </span>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        data-hero
        data-parallax-section
        data-mouse-parallax
        className="relative flex min-h-[100svh] items-center overflow-hidden"
      >
        {/* Ambient field */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            data-parallax-layer
            data-parallax-speed="0.25"
            className="absolute -left-[10%] -top-[15%] h-[55%] w-[55%]"
          >
            <div
              data-mouse-depth="0.03"
              className="cine-drift h-full w-full rounded-full bg-peach/25 blur-[130px]"
            />
          </div>
          <div
            data-parallax-layer
            data-parallax-speed="0.16"
            className="absolute -bottom-[20%] -right-[10%] h-[60%] w-[60%]"
          >
            <div
              data-mouse-depth="0.05"
              className="cine-drift-slow h-full w-full rounded-full bg-primary/20 blur-[140px]"
            />
          </div>
          <div className="cine-grain absolute inset-0 opacity-[0.04]" />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-[1600px] grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
          {/* Copy column */}
          <div className="flex flex-col items-start text-left">
            <div
              data-hero-step
              className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-card/40 px-4 py-2 backdrop-blur-md"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs font-medium tracking-wide text-primary/80">
                Academy · Interview Assistant
              </span>
            </div>

            <h1
              data-hero-lines
              className="font-sans text-[15vw] font-medium leading-[0.92] tracking-tighter text-foreground sm:text-7xl lg:text-8xl"
              aria-label="Every interview, automatically understood."
            >
              <span className="motion-line-mask">
                <span className="motion-line">Every interview,</span>
              </span>
              <br />
              <span className="motion-line-mask">
                <span className="motion-line">automatically</span>
              </span>
              <br />
              <span className="motion-line-mask">
                <span className="motion-line font-serif italic text-primary">understood.</span>
              </span>
            </h1>

            <p
              data-hero-step
              className="mt-8 max-w-xl text-base font-light leading-relaxed text-muted-foreground sm:text-xl"
            >
              Academy&apos;s AI sits in on your hiring calls, writes the notes, scores
              candidate fit, and syncs everything to Lever —{' '}
              <span className="font-normal text-foreground">
                so your team can focus on the conversation, not the keyboard.
              </span>
            </p>

            <div data-hero-step className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                data-magnetic
                data-cursor-label="Enter"
                onClick={() => signIn('google')}
                className="group inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/10 bg-primary px-8 text-base font-medium text-primary-foreground shadow-xl shadow-primary/20 transition-[box-shadow,background-color] duration-500 hover:shadow-2xl hover:shadow-primary/30"
              >
                Sign in with Google
                <ArrowRight className="h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1.5" />
              </button>
              <a
                href="#workflow"
                data-magnetic
                data-magnetic-strength="0.2"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-border/70 bg-card/30 px-7 text-base font-medium text-foreground/80 backdrop-blur-md transition-colors duration-500 hover:text-foreground"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Media column — floating product surfaces */}
          <div className="relative hidden aspect-square w-full max-w-[640px] lg:flex lg:items-center lg:justify-center">
            <div
              data-hero-media
              data-mouse-depth="0.018"
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-peach/25 via-primary/10 to-transparent opacity-60 blur-[100px]" />
              <Orb
                size="lg"
                colors={['#ebba99', '#8f917f']}
                agentState="listening"
                className="h-72 w-72 opacity-90 mix-blend-multiply contrast-125 saturate-150"
              />
            </div>

            {/* Transcript card */}
            <div
              data-hero-media
              data-mouse-depth="0.06"
              data-cursor-label="Live"
              className="absolute right-0 top-6 w-[300px] rounded-3xl border border-white/30 bg-card/70 p-5 shadow-2xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10">
                  <Waves className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Live transcript
                </span>
                <span className="ml-auto flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-success/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-foreground/10" />
                <div className="h-2 w-[85%] rounded-full bg-foreground/10" />
                <div className="h-2 w-[60%] rounded-full bg-primary/30" />
              </div>
            </div>

            {/* Match score card */}
            <div
              data-hero-media
              data-mouse-depth="0.09"
              className="absolute bottom-16 left-0 w-[260px] rounded-3xl border border-white/30 bg-card/70 p-5 shadow-2xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-white to-white/40 shadow-inner ring-1 ring-black/5">
                  <BarChart3 className="h-5 w-5 text-peach" />
                </span>
                <div>
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Match score
                  </p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold tracking-tighter text-foreground">98%</p>
                    <span className="text-sm font-medium text-muted-foreground">fit</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lever sync chip */}
            <div
              data-hero-media
              data-mouse-depth="0.12"
              className="absolute -bottom-2 right-12 inline-flex items-center gap-2.5 rounded-2xl border border-white/30 bg-card/80 px-4 py-3 shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-success/15">
                <Check className="h-3.5 w-3.5 text-success" />
              </span>
              <span className="text-sm font-medium text-foreground">Synced to Lever</span>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div
          data-scroll-cue
          className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-3"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
            Scroll
          </span>
          <span className="relative flex h-10 w-px overflow-hidden bg-border">
            <span className="absolute inset-x-0 top-0 h-1/2 w-px animate-[slide-down_1.6s_cubic-bezier(0.37,0,0.63,1)_infinite] bg-foreground/60" />
          </span>
        </div>
      </section>

      {/* ── Manifesto ─────────────────────────────────────────────────── */}
      <section className="relative bg-foreground py-32 text-background sm:py-44">
        <div className="cine-grain pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div className="relative mx-auto max-w-[1200px] px-5 sm:px-8">
          <span
            data-reveal="fade-up"
            className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-background/50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            The premise
          </span>
          <p
            data-motion-text="words"
            className="max-w-[20ch] text-3xl font-light leading-[1.18] tracking-tight text-background sm:text-5xl sm:leading-[1.15] md:max-w-[24ch]"
          >
            Hiring teams lose their sharpest signal in the gap between the conversation and
            the keyboard. We close it.
          </p>
        </div>
      </section>

      {/* ── Feature stories ───────────────────────────────────────────── */}
      <section className="relative py-28 sm:py-40">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-28 px-5 sm:gap-44 sm:px-8">
          <FeatureStory
            index="01"
            eyebrow="Capture"
            title="Notes that write themselves."
            body="The assistant joins the call, transcribes every word, and pulls the finished transcript straight from Google Drive — no recording links, no copy-paste, no scramble afterward."
            icon={<FileText className="h-5 w-5" />}
            align="left"
            media={<TranscribeMedia />}
          />
          <FeatureStory
            index="02"
            eyebrow="Reason"
            title="Fit, quantified."
            body="Every interview is scored against the role. Strengths, risks, and a clear match percentage surface in seconds — structured the same way every time, so comparisons are honest."
            icon={<BarChart3 className="h-5 w-5" />}
            align="right"
            media={<AnalyzeMedia />}
          />
          <FeatureStory
            index="03"
            eyebrow="Deliver"
            title="Lever, in lockstep."
            body="Polished feedback lands on the right candidate in Lever automatically. Your ATS stays the single source of truth — it just fills itself in now."
            icon={<RefreshCw className="h-5 w-5" />}
            align="left"
            media={<SyncMedia />}
          />
        </div>
      </section>

      {/* ── Workflow sticky stack ─────────────────────────────────────── */}
      <section id="workflow" className="relative bg-secondary/40 py-28 sm:py-36">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
          <div className="mb-16 max-w-2xl">
            <span
              data-reveal="fade-up"
              className="mb-5 inline-block text-xs uppercase tracking-[0.3em] text-primary/80"
            >
              The workflow
            </span>
            <h2
              data-reveal="blur-in"
              className="text-4xl font-medium tracking-tighter text-foreground sm:text-6xl"
            >
              Four steps. Zero busywork.
            </h2>
          </div>

          <div data-sticky-stack className="relative flex flex-col gap-6">
            {WORKFLOW.map((step) => (
              <article
                key={step.no}
                data-stack-card
                data-cursor-label={step.no}
                className="sticky top-[14vh] overflow-hidden rounded-[2rem] border border-white/40 bg-card/80 p-8 shadow-2xl shadow-black/5 ring-1 ring-black/5 backdrop-blur-xl sm:p-12"
              >
                <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-xl">
                    <span className="font-serif text-5xl italic text-primary/30 sm:text-6xl">
                      {step.no}
                    </span>
                    <h3 className="mt-4 text-2xl font-medium tracking-tight text-foreground sm:text-4xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-base font-light leading-relaxed text-muted-foreground sm:text-lg">
                      {step.body}
                    </p>
                  </div>
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-20 sm:w-20">
                    {step.icon}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section className="relative py-24 sm:py-32">
        <div
          data-reveal-group
          className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border/60 bg-border/60 px-0 sm:px-0 lg:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              data-reveal-item
              className="flex flex-col gap-2 bg-background p-8 sm:p-10"
            >
              <span className="text-4xl font-medium tracking-tighter text-foreground sm:text-5xl">
                {stat.value}
              </span>
              <span className="text-sm font-light leading-snug text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-foreground py-32 text-background sm:py-44">
        <div className="pointer-events-none absolute inset-0">
          <div className="cine-drift absolute -left-[5%] top-1/2 h-[60%] w-[40%] -translate-y-1/2 rounded-full bg-primary/25 blur-[140px]" />
          <div className="cine-drift-slow absolute -right-[5%] top-0 h-[60%] w-[40%] rounded-full bg-peach/20 blur-[140px]" />
          <div className="cine-grain absolute inset-0 opacity-[0.05]" />
        </div>
        <div className="relative mx-auto max-w-[1100px] px-5 text-center sm:px-8">
          <h2
            data-motion-text="words"
            className="mx-auto max-w-[16ch] text-4xl font-medium leading-[1.05] tracking-tighter text-background sm:text-7xl"
          >
            Ready when your next interview is.
          </h2>
          <p
            data-reveal="fade-up"
            data-reveal-delay="0.1"
            className="mx-auto mt-6 max-w-xl text-base font-light text-background/60 sm:text-lg"
          >
            Sign in with your Academy Google account to get started. It takes about ten
            seconds.
          </p>
          <div data-reveal="fade-up" data-reveal-delay="0.2" className="mt-10 flex justify-center">
            <button
              type="button"
              data-magnetic
              data-cursor-label="Enter"
              onClick={() => signIn('google')}
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-background px-9 text-base font-medium text-foreground shadow-2xl transition-transform duration-500 hover:scale-[1.02]"
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-background py-12">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-6 px-5 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/academy-logo-2024-v1.svg"
              width={100}
              height={24}
              alt="Academy"
              className="h-5 w-auto"
            />
            <span className="border-l border-border pl-3 text-xs tracking-wide text-muted-foreground">
              AI Assistant
            </span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Internal tool · © {new Date().getFullYear()} Academy. Built for the hiring team.
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────── */

function FeatureStory({
  index,
  eyebrow,
  title,
  body,
  icon,
  align,
  media,
}: {
  index: string
  eyebrow: string
  title: string
  body: string
  icon: React.ReactNode
  align: 'left' | 'right'
  media: React.ReactNode
}) {
  const mediaFirst = align === 'right'
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
      <div className={mediaFirst ? 'lg:order-2' : ''}>
        <span
          data-reveal="fade-up"
          className="mb-4 inline-flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-primary/80"
        >
          <span className="font-serif text-base italic text-primary/40">{index}</span>
          {eyebrow}
        </span>
        <h3
          data-reveal="blur-in"
          className="text-4xl font-medium tracking-tighter text-foreground sm:text-5xl"
        >
          {title}
        </h3>
        <p
          data-reveal="fade-up"
          data-reveal-delay="0.05"
          className="mt-5 max-w-md text-base font-light leading-relaxed text-muted-foreground sm:text-lg"
        >
          {body}
        </p>
        <span
          data-reveal="fade-up"
          data-reveal-delay="0.1"
          className="mt-7 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          {icon}
        </span>
      </div>

      <figure
        data-image-reveal
        className={`relative aspect-[4/3] w-full rounded-[2rem] border border-white/40 bg-gradient-to-br from-card to-secondary/60 p-6 shadow-2xl shadow-black/5 ring-1 ring-black/5 sm:p-8 ${
          mediaFirst ? 'lg:order-1' : ''
        }`}
      >
        <div data-image-inner className="flex h-full w-full flex-col">
          {media}
        </div>
      </figure>
    </div>
  )
}

function TranscribeMedia() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <Waves className="h-4 w-4 text-primary" />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
          Transcript · synced
        </span>
        <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold text-success">
          Drive
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 rounded-2xl bg-background/60 p-5">
        {['Interviewer', 'Candidate', 'Interviewer', 'Candidate'].map((who, i) => (
          <div key={i} className="flex gap-3">
            <span className="mt-0.5 w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {who}
            </span>
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-full rounded-full bg-foreground/10" />
              <div className={`h-2 rounded-full bg-foreground/10 ${i % 2 ? 'w-[55%]' : 'w-[80%]'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyzeMedia() {
  const bars = [
    { label: 'Craft', value: 94 },
    { label: 'Collaboration', value: 88 },
    { label: 'Communication', value: 91 },
    { label: 'Problem solving', value: 96 },
  ]
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            Match score
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tighter text-foreground">98%</span>
            <span className="text-sm font-medium text-muted-foreground">fit</span>
          </div>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-peach/20">
          <BarChart3 className="h-5 w-5 text-peach" />
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 rounded-2xl bg-background/60 p-5">
        {bars.map((b) => (
          <div key={b.label} className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>{b.label}</span>
              <span className="tabular-nums text-foreground/70">{b.value}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-peach"
                style={{ width: `${b.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SyncMedia() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <RefreshCw className="h-4 w-4 text-primary" />
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
          Lever · feedback pushed
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 rounded-2xl bg-background/60 p-5">
        {[
          'Summary generated',
          'Strengths & risks tagged',
          'Matched to candidate',
          'Posted to Lever',
        ].map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                i === 3 ? 'bg-success text-white' : 'bg-success/15 text-success'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-medium text-foreground/80">{step}</span>
            {i === 3 && (
              <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold text-success">
                Done
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const WORKFLOW = [
  {
    no: '01',
    title: 'It joins the call',
    body: 'Add the assistant to any interview on Google Meet. It listens quietly in the background — no extra software for your candidate.',
    icon: <Waves className="h-7 w-7" />,
  },
  {
    no: '02',
    title: 'It writes the transcript',
    body: 'When the call ends, the full transcript is pulled from Drive and cleaned up automatically. Nothing to download or paste.',
    icon: <FileText className="h-7 w-7" />,
  },
  {
    no: '03',
    title: 'It scores the fit',
    body: 'The AI evaluates the candidate against the role and drafts structured feedback — strengths, risks, and a match score.',
    icon: <BarChart3 className="h-7 w-7" />,
  },
  {
    no: '04',
    title: 'It syncs to Lever',
    body: 'Final feedback is posted to the right candidate in Lever, so your ATS is always current without anyone touching it.',
    icon: <RefreshCw className="h-7 w-7" />,
  },
]

const STATS = [
  { value: '0', label: 'manual notes to write' },
  { value: '1-click', label: 'sync straight to Lever' },
  { value: '<2 min', label: 'from call end to report' },
  { value: '100%', label: 'of interviews on record' },
]
