'use client'

import { useSession, signIn } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  const { data: session } = useSession()

  if (session) {
    redirect('/feedback')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-6 bg-background">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div className="space-y-10">
          <Badge variant="outline" className="rounded-none px-3 py-1 border-foreground/20 text-foreground font-mono uppercase tracking-widest text-xs bg-transparent">
            Internal Tool v1.0
          </Badge>
          <h1 className="font-display text-7xl md:text-9xl font-medium tracking-tighter leading-[0.85] text-foreground -ml-1">
            Interview <br/>
            <span className="text-primary">Intelligence</span> <br/>
            Studio
          </h1>
          <p className="text-xl font-grotesk text-foreground/80 max-w-md leading-relaxed">
            Automate your notes. Analyze candidate fit.<br/> 
            Sync with Lever. <span className="text-primary">Seamlessly.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <Button 
              size="lg" 
              className="rounded-none px-8 text-lg h-14 bg-foreground text-background hover:bg-foreground/90 font-grotesk transition-all hover:pl-10"
              onClick={() => signIn('google')}
            >
              Sign in with Google →
            </Button>
          </div>
        </div>

        <div className="relative hidden md:block">
           {/* Minimalist Grid Graphic */}
          <div className="border border-foreground/10 p-8 relative bg-background/50 backdrop-blur-sm">
             <div className="absolute top-0 right-0 p-2">
                <div className="h-2 w-2 bg-primary rounded-full"></div>
             </div>
             
             <div className="space-y-6">
                <div className="border-b border-foreground/10 pb-4">
                   <h3 className="font-display text-3xl">Candidate Analysis</h3>
                </div>
                <div className="space-y-4 font-mono text-sm text-muted-foreground">
                   <div className="flex justify-between">
                      <span>Transcript_Sync</span>
                      <span className="text-primary">Active</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Semantic_Match</span>
                      <span className="text-primary">98%</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Lever_Export</span>
                      <span className="text-primary">Ready</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
