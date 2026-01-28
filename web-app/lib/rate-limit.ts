import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ============================================
// Rate Limiter Configuration
// ============================================

// In-memory store for development/fallback
const inMemoryStore = new Map<string, { count: number; resetTime: number }>()

// Rate limit configurations for different route types
export const RATE_LIMITS = {
  // Standard API calls
  standard: { requests: 60, window: 60 }, // 60 requests per minute
  
  // AI-powered endpoints (expensive operations)
  ai: { requests: 10, window: 60 }, // 10 requests per minute
  
  // Search endpoints
  search: { requests: 30, window: 60 }, // 30 requests per minute
  
  // File uploads
  upload: { requests: 5, window: 60 }, // 5 uploads per minute
  
  // Import operations (very expensive)
  import: { requests: 3, window: 300 }, // 3 imports per 5 minutes
}

type RateLimitType = keyof typeof RATE_LIMITS

// ============================================
// Upstash Rate Limiter (Production)
// ============================================

let upstashRatelimiter: Ratelimit | null = null

function getUpstashRatelimiter(): Ratelimit | null {
  if (upstashRatelimiter) return upstashRatelimiter
  
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (upstashUrl && upstashToken) {
    const redis = new Redis({
      url: upstashUrl,
      token: upstashToken,
    })
    
    upstashRatelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'academy_ratelimit',
    })
    
    return upstashRatelimiter
  }
  
  return null
}

// ============================================
// In-Memory Rate Limiter (Development/Fallback)
// ============================================

function inMemoryRateLimit(
  identifier: string, 
  limit: number, 
  windowSeconds: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const key = identifier
  const record = inMemoryStore.get(key)
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    Array.from(inMemoryStore.entries()).forEach(([k, v]) => {
      if (v.resetTime < now) {
        inMemoryStore.delete(k)
      }
    })
  }
  
  if (!record || record.resetTime < now) {
    // Create new window
    inMemoryStore.set(key, {
      count: 1,
      resetTime: now + windowSeconds * 1000,
    })
    return { success: true, remaining: limit - 1, reset: now + windowSeconds * 1000 }
  }
  
  if (record.count >= limit) {
    return { success: false, remaining: 0, reset: record.resetTime }
  }
  
  record.count++
  return { success: true, remaining: limit - record.count, reset: record.resetTime }
}

// ============================================
// Rate Limit Check Function
// ============================================

export async function checkRateLimit(
  request: NextRequest,
  type: RateLimitType = 'standard'
): Promise<{ success: boolean; response?: NextResponse }> {
  const config = RATE_LIMITS[type]
  
  // Get identifier (IP address or user email from token)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'anonymous'
  const identifier = `${type}:${ip}`
  
  // Try Upstash first (production)
  const upstash = getUpstashRatelimiter()
  
  if (upstash) {
    try {
      const { success, remaining, reset } = await upstash.limit(identifier)
      
      if (!success) {
        return {
          success: false,
          response: NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { 
              status: 429,
              headers: {
                'X-RateLimit-Limit': String(config.requests),
                'X-RateLimit-Remaining': String(remaining),
                'X-RateLimit-Reset': String(reset),
                'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
              }
            }
          )
        }
      }
      
      return { success: true }
    } catch (error) {
      console.error('Upstash rate limit error:', error)
      // Fall through to in-memory limiter
    }
  }
  
  // Fallback to in-memory rate limiter
  const { success, remaining, reset } = inMemoryRateLimit(
    identifier, 
    config.requests, 
    config.window
  )
  
  if (!success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(config.requests),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          }
        }
      )
    }
  }
  
  return { success: true }
}

// ============================================
// Helper to apply rate limiting in API routes
// ============================================

export async function withRateLimit<T>(
  request: NextRequest,
  type: RateLimitType,
  handler: () => Promise<T>
): Promise<T | NextResponse> {
  const { success, response } = await checkRateLimit(request, type)
  
  if (!success && response) {
    return response
  }
  
  return handler()
}
