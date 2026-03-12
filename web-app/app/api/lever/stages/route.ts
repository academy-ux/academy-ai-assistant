import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/validation'
import { fetchStages } from '@/lib/lever'

export async function GET() {
  try {
    const stages = await fetchStages()
    return NextResponse.json({ success: true, stages })
  } catch (error) {
    return errorResponse(error, 'Lever stages error')
  }
}
