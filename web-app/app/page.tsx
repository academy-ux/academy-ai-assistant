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
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <Badge variant="outline" className="rounded-full px-4 py-1 border-primary/40 text-primary bg-primary/5">
            Internal Tool v1.0
          </Badge>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
            Intelligent <br/>
            <span className="text-primary italic">Recruiting</span> <br/>
            Feedback
          </h1>
          <p className="text-xl text-muted-foreground max-w-md leading-relaxed">
            Automate your interview notes, analyze candidate fit, and sync directly with Lever ATS.
          </p>
          <div className="flex gap-4 pt-4">
            <Button 
              size="lg" 
              className="rounded-full px-8 text-lg h-12 bg-foreground text-background hover:bg-foreground/90"
              onClick={() => signIn('google')}
            >
              Sign in with Google
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full px-8 text-lg h-12 border-foreground/20"
            >
              Learn More
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-orange-400 rounded-2xl blur opacity-20"></div>
          <Card className="relative border-none shadow-xl bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Streamlined Evaluation</CardTitle>
              <CardDescription>Connects your workflow seamlessly</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  G
                </div>
                <div>
                  <p className="font-medium">Google Drive</p>
                  <p className="text-sm text-muted-foreground">Auto-fetches transcripts</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  AI
                </div>
                <div>
                  <p className="font-medium">Claude AI</p>
                  <p className="text-sm text-muted-foreground">Analyzes fit & skills</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  L
                </div>
                <div>
                  <p className="font-medium">Lever ATS</p>
                  <p className="text-sm text-muted-foreground">Submits feedback instantly</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
