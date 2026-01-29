import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Simple endpoint to check if user is authenticated.
 * Used by the Chrome extension to verify login status.
 */
export async function GET(req: NextRequest) {
  // Handle CORS for Chrome extension (content scripts run from meet.google.com)
  const origin = req.headers.get('origin') || ''
  const isExtension = origin.startsWith('chrome-extension://') || origin === 'https://meet.google.com'
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  
  if (isExtension) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  
  try {
    const session = await getServerSession(authOptions)
    
    if (session?.user) {
      return NextResponse.json({
        authenticated: true,
        user: {
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        }
      }, { headers })
    }
    
    return NextResponse.json({
      authenticated: false,
      user: null
    }, { headers })
  } catch (error) {
    console.error('[auth/check] Error:', error)
    return NextResponse.json({
      authenticated: false,
      user: null,
      error: 'Failed to check session'
    }, { headers, status: 500 })
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || ''
  const isExtension = origin.startsWith('chrome-extension://') || origin === 'https://meet.google.com'
  
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  
  if (isExtension) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  
  return new NextResponse(null, { status: 204, headers })
}
