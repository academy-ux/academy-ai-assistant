'use client'

import { useSession } from 'next-auth/react'
import { redirect, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { CinematicLanding } from '@/components/landing/cinematic-landing'
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

  return <CinematicLanding />
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
