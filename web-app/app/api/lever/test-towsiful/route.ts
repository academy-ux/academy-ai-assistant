import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to directly query Towsiful by his known opportunity ID
 * This will tell us if we can access him at all via the API
 */
export async function GET(request: NextRequest) {
  const leverKey = process.env.LEVER_API_KEY

  if (!leverKey) {
    return NextResponse.json({ error: 'No Lever API key' }, { status: 500 })
  }

  try {
    // Towsiful's exact opportunity ID from the URL you provided
    const towsifulId = '2aed970f-0643-4e08-89d7-a58944d43c92'
    
    console.log('[Test] Attempting to fetch Towsiful directly by ID:', towsifulId)
    
    // Try to get him directly
    const response = await fetch(
      `https://api.lever.co/v1/opportunities/${towsifulId}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('[Test] Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Test] API error:', errorText)
      return NextResponse.json({
        success: false,
        status: response.status,
        error: errorText,
        message: response.status === 403 
          ? 'API key lacks permission to access this candidate (likely confidential)'
          : response.status === 404
          ? 'Candidate not found via API (might be deleted or inaccessible)'
          : 'Unknown error'
      })
    }

    const data = await response.json()
    console.log('[Test] Successfully retrieved Towsiful:', data.data?.name)
    
    return NextResponse.json({
      success: true,
      candidate: data.data,
      message: 'Found Towsiful!'
    })

  } catch (error: any) {
    console.error('[Test] Error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}
