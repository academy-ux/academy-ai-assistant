'use client'

import { useSession, signIn } from 'next-auth/react'
import { redirect, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Sparkles, FileText, BarChart3, Link2 } from 'lucide-react'
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6 bg-background overflow-hidden relative">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-peach/5 blur-[120px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-20 items-center relative z-10">
        <div className="space-y-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/60 bg-card/30 backdrop-blur-sm animate-fade-in-down" style={{ animationDelay: '100ms' }}>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Internal Tool v1.0</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="font-sans text-6xl md:text-7xl lg:text-8xl font-normal tracking-tight leading-[0.95] text-foreground animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              Meeting <br/>
              <span className="text-primary font-serif">Intelligence</span>
            </h1>
            <p className="text-xl text-muted-foreground font-light max-w-lg leading-relaxed animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              Automate your notes. Analyze candidate fit. Sync with Lever. Seamlessly.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <Button 
              size="lg" 
              className="h-14 px-8 text-base rounded-full gap-3 group transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-95"
              onClick={() => signIn('google')}
            >
              Sign in with Google
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>

        <div className="relative hidden lg:flex items-center justify-center animate-fade-in" style={{ animationDelay: '500ms' }}>
          <div className="relative w-full aspect-square max-w-[500px]">
            {/* Main Orb Container */}
            <div className="absolute inset-0 flex items-center justify-center animate-float">
              <div className="absolute inset-0 bg-gradient-to-tr from-peach/20 via-primary/10 to-transparent rounded-full blur-3xl opacity-50" />
              <Orb 
                size="lg" 
                colors={["#ebba99", "#8f917f"]} 
                agentState="listening"
                className="h-64 w-64 opacity-90 mix-blend-multiply"
              />
            </div>
            
            {/* Floating cards - Swiss Style */}
            <div className="absolute -top-4 -right-4 p-5 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm animate-fade-in-left hover:-translate-y-1 transition-transform duration-500 cursor-default" style={{ animationDelay: '700ms' }}>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-background/50 flex items-center justify-center border border-border/20">
                   <FileText className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1">STATUS</p>
                  <p className="text-base font-medium text-foreground">Transcript Synced</p>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-12 -left-8 p-5 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl shadow-sm animate-fade-in-right hover:-translate-y-1 transition-transform duration-500 cursor-default" style={{ animationDelay: '900ms' }}>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-background/50 flex items-center justify-center border border-border/20">
                   <BarChart3 className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1">MATCH SCORE</p>
                  <p className="text-base font-medium text-foreground">98% Fit</p>
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
