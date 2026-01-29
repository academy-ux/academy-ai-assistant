import NextAuth, { type NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

let didLogProfileOnce = false
let didLogSessionOnce = false

async function refreshAccessToken(token: any) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
      // Keep the refresh token if a new one wasn't provided
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      // Initial sign in - persist OAuth tokens
      if (account) {
        if (!didLogProfileOnce) {
          didLogProfileOnce = true
          console.log('[nextauth] sign-in profile picture:', (profile as any)?.picture)
          console.log('[nextauth] sign-in user image:', (user as any)?.image)
        }
        return {
          ...token,
          // Persist basic user fields (NextAuth doesn't do this automatically once we override callbacks)
          name: (token.name as string) ?? (user as any)?.name ?? (profile as any)?.name,
          email: (token.email as string) ?? (user as any)?.email ?? (profile as any)?.email,
          picture:
            (token as any).picture ??
            (user as any)?.image ??
            (profile as any)?.picture ??
            (profile as any)?.image,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        }
      }

      // Return token if not expired (with 5 minute buffer)
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000 - 5 * 60 * 1000) {
        return token
      }

      // Token expired, try to refresh
      if (token.refreshToken) {
        return await refreshAccessToken(token)
      }

      return token
    },
    async session({ session, token }) {
      // Only send safe user info to client - DO NOT expose accessToken
      // Since we override this callback, we must explicitly map basic user fields.
      if (session.user) {
        session.user.name = (token.name as string) ?? session.user.name
        session.user.email = (token.email as string) ?? session.user.email
        const picture = (token as any).picture ?? (token as any).image
        session.user.image = (picture as string) ?? session.user.image
      }
      if (!didLogSessionOnce) {
        didLogSessionOnce = true
        console.log('[nextauth] session user image:', session.user?.image)
        console.log('[nextauth] token picture:', (token as any)?.picture)
      }
      if (token.error) {
        // Signal to client that re-authentication is needed
        session.error = token.error as string
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
