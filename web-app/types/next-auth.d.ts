import 'next-auth'

declare module 'next-auth' {
  interface Session {
    // Note: accessToken is intentionally NOT exposed to client for security
    error?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: string
  }
}
