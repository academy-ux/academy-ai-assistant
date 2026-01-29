import { z } from 'zod'
import { NextResponse } from 'next/server'

// ============================================
// Common Validation Schemas
// ============================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const uuidSchema = z.string().uuid('Invalid ID format')

export const searchQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  searchType: z.enum(['semantic', 'hybrid', 'keyword']).default('hybrid'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const askQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required').max(2000, 'Question too long'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).default([]),
  interviewId: z.string().uuid().optional(),
})

export const analyzeSchema = z.object({
  transcript: z.string().min(10, 'Transcript is required').max(500000, 'Transcript too long'),
  meetingTitle: z.string().max(200).optional(),
  meetingDate: z.string().optional(),
  template: z.object({
    fields: z.array(z.object({
      question: z.string(),
      description: z.string().optional(),
    })),
  }).optional(),
})

export const leverSubmitSchema = z.object({
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
  templateId: z.string().min(1, 'Template ID is required'),
  fieldValues: z.array(z.object({
    id: z.string().min(1),
    value: z.unknown(),
  })).min(1, 'At least one field value is required'),
  feedback: z.object({
    rating: z.string(),
    strengths: z.string().max(10000).optional(),
    concerns: z.string().max(10000).optional(),
    technicalSkills: z.string().max(10000).optional(),
    culturalFit: z.string().max(10000).optional(),
    recommendation: z.string().max(10000).optional(),
  }),
  transcript: z.string().max(500000).optional(),
  meetingTitle: z.string().max(200).optional(),
  meetingCode: z.string().max(50).optional(),
  candidateName: z.string().max(200).optional(),
  position: z.string().max(200).optional(),
})

// Google Drive folder search - strict validation to prevent query injection
export const driveQuerySchema = z.object({
  q: z.string()
    .max(100, 'Search query too long')
    .regex(/^[a-zA-Z0-9\s\-_.]*$/, 'Search query contains invalid characters')
    .default(''),
})

export const folderIdSchema = z.string()
  .min(1, 'Folder ID is required')
  .max(100, 'Folder ID too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid folder ID format')

// File upload validation
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
export const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
]

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Sanitize error messages for production
 * Returns user-friendly messages and hides internal details
 */
export function sanitizeError(error: unknown): { message: string; status: number } {
  // In development, show full error
  if (process.env.NODE_ENV === 'development') {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { message, status: 500 }
  }

  // In production, return generic messages
  if (error instanceof z.ZodError) {
    const firstError = error.issues[0]
    return { 
      message: firstError?.message || 'Invalid request data', 
      status: 400 
    }
  }

  if (error instanceof Error) {
    // Check for common error types and provide user-friendly messages
    if (error.message.includes('PGRST116')) {
      return { message: 'Resource not found', status: 404 }
    }
    if (error.message.includes('invalid_grant') || error.message.includes('401')) {
      return { message: 'Authentication expired. Please sign in again.', status: 401 }
    }
    if (error.message.includes('403')) {
      return { message: 'Access denied', status: 403 }
    }
    if (error.message.includes('rate limit')) {
      return { message: 'Too many requests. Please try again later.', status: 429 }
    }
  }

  // Default generic error
  return { message: 'An unexpected error occurred', status: 500 }
}

/**
 * Create a standardized error response
 */
export function errorResponse(error: unknown, logContext?: string): NextResponse {
  const { message, status } = sanitizeError(error)
  
  // Always log the full error server-side
  if (logContext) {
    console.error(`[${logContext}]`, error)
  } else {
    console.error(error)
  }

  return NextResponse.json({ error: message }, { status })
}

/**
 * Validate request body with a Zod schema
 */
export async function validateBody<T extends z.ZodSchema>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: NextResponse }> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { data, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: NextResponse.json(
          { error: error.issues[0]?.message || 'Invalid request data' },
          { status: 400 }
        ),
      }
    }
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    }
  }
}

/**
 * Validate URL search params with a Zod schema
 */
export function validateSearchParams<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): { data: z.infer<T>; error: null } | { data: null; error: NextResponse } {
  try {
    const params = Object.fromEntries(searchParams.entries())
    const data = schema.parse(params)
    return { data, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: NextResponse.json(
          { error: error.issues[0]?.message || 'Invalid request parameters' },
          { status: 400 }
        ),
      }
    }
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid parameters' }, { status: 400 }),
    }
  }
}
