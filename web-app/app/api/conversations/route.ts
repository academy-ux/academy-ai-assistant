import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sources?: { id: string; candidateName: string }[]
}

interface Conversation {
  id: string
  user_email: string
  user_name: string | null
  interview_id: string | null
  title: string
  messages: ConversationMessage[]
  message_count: number
  created_at: string
  updated_at: string
  last_message_at: string
}

// GET: List conversations for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const interviewId = searchParams.get('interview_id')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_email', session.user.email)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by interview if specified
    if (interviewId) {
      query = query.eq('interview_id', interviewId)
    } else if (interviewId === 'null') {
      // Global conversations only
      query = query.is('interview_id', null)
    }

    // Search in title and messages
    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search}%,messages.cs."${search}"`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ conversations: data || [] })
  } catch (error) {
    console.error('[conversations] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

// POST: Create or update a conversation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { id, interview_id, title, messages } = body

    if (!title || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Missing required fields: title, messages' },
        { status: 400 }
      )
    }

    // If ID provided, update existing conversation
    if (id) {
      const { data, error } = await supabase
        .from('ai_conversations')
        .update({
          title,
          messages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_email', session.user.email) // Ensure user owns it
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ conversation: data })
    }

    // Create new conversation
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_email: session.user.email,
        user_name: session.user.name,
        interview_id: interview_id || null,
        title,
        messages,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ conversation: data })
  } catch (error) {
    console.error('[conversations] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save conversation' },
      { status: 500 }
    )
  }
}

// DELETE: Delete a conversation
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing conversation ID' }, { status: 400 })
    }

    const { error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('user_email', session.user.email) // Ensure user owns it

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[conversations] DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
