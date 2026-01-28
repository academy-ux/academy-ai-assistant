import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    // Allow the request to proceed if authenticated
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow auth routes without authentication
        if (req.nextUrl.pathname.startsWith('/api/auth')) {
          return true
        }
        // Require authentication for all other protected routes
        return !!token
      },
    },
    pages: {
      signIn: '/',
    },
  }
)

export const config = {
  matcher: [
    // Protect all API routes except auth
    '/api/:path*',
    // Protect application pages
    '/history/:path*',
    '/feedback/:path*',
  ],
}
