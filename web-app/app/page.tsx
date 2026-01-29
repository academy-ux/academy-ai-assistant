'use client'

import { useSession, signIn } from 'next-auth/react'
import { redirect, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, FileText, BarChart3 } from 'lucide-react'
import { Orb } from '@/components/ui/orb'
import { Spinner } from '@/components/ui/spinner'

function HomeContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()

  if (session) {
    // If coming from Chrome plugin (with meeting parameters), go to feedback
    const meetingTitle = searchParams.get('title')
    const meetingCode = searchParams.get('meeting')
    
    if (meetingTitle || meetingCode) {
      const params = new URLSearchParams()
      if (meetingTitle) params.set('title', meetingTitle)
      if (meetingCode) params.set('meeting', meetingCode)
      redirect(`/feedback?${params.toString()}`)
    }
    
    // Otherwise, go to history
    redirect('/history')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-background overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-peach/10 blur-[120px]" />
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center relative z-10">
        <div className="space-y-10 flex flex-col items-start text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md animate-fade-in-down" style={{ animationDelay: '100ms' }}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <span className="text-sm font-medium tracking-wide text-primary/80">Internal Tool v1.0</span>
          </div>
          
          {/* Headline */}
          <div className="space-y-6 max-w-2xl">
            <h1 className="font-sans text-5xl md:text-7xl lg:text-8xl font-medium tracking-tighter leading-[0.95] text-foreground animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              Meeting <br/>
              <span className="text-primary italic font-serif">Intelligence</span>
            </h1>
            <p className="text-lg md:text-2xl text-muted-foreground font-light leading-relaxed animate-fade-in-up max-w-lg" style={{ animationDelay: '300ms' }}>
              Automate your notes. Analyze candidate fit. Sync with Lever. <span className="text-foreground font-normal">Seamlessly.</span>
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <Button 
              size="lg" 
              className="h-14 px-8 text-base rounded-full gap-3 shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-primary text-primary-foreground border border-white/10"
              onClick={() => signIn('google')}
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Visual / Orb */}
        <div className="relative hidden lg:flex items-center justify-center animate-fade-in" style={{ animationDelay: '500ms' }}>
          <div className="relative w-full aspect-square max-w-[600px] flex items-center justify-center">
            {/* Main Orb Container */}
            <div className="absolute inset-0 flex items-center justify-center animate-float">
              <div className="absolute inset-0 bg-gradient-to-tr from-peach/20 via-primary/10 to-transparent rounded-full blur-[100px] opacity-60" />
              <Orb 
                size="lg" 
                colors={["#ebba99", "#8f917f"]} 
                agentState="listening"
                className="h-80 w-80 opacity-90 mix-blend-multiply filter contrast-125 saturate-150"
              />
            </div>
            
            {/* Floating Card 1: Status */}
            <div className="absolute top-10 right-0 p-6 bg-card/60 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl shadow-black/5 animate-fade-in-left hover:-translate-y-1 transition-transform duration-500 cursor-default ring-1 ring-black/5" style={{ animationDelay: '700ms' }}>
              <div className="flex items-center gap-5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-white to-white/50 shadow-inner flex items-center justify-center border border-white/40">
                   <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/80 mb-1">STATUS</p>
                  <p className="text-lg font-semibold text-foreground tracking-tight">Transcript Synced</p>
                </div>
              </div>
            </div>
            
            {/* Floating Card 2: Match Score */}
            <div className="absolute bottom-20 left-10 p-6 bg-card/60 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl shadow-black/5 animate-fade-in-right hover:-translate-y-1 transition-transform duration-500 cursor-default ring-1 ring-black/5" style={{ animationDelay: '900ms' }}>
              <div className="flex items-center gap-5">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-white to-white/50 shadow-inner flex items-center justify-center border border-white/40">
                   <BarChart3 className="h-6 w-6 text-peach" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/80 mb-1">MATCH SCORE</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold text-foreground tracking-tighter">98%</p>
                    <span className="text-sm font-medium text-muted-foreground">Fit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size={32} className="text-primary" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
