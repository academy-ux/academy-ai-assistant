import { NextResponse } from 'next/server'

/**
 * Debug endpoint to see what Lever returns for candidate links
 * Visit: http://localhost:3000/api/lever/debug
 */
export async function GET() {
  const leverKey = process.env.LEVER_API_KEY

  if (!leverKey) {
    return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
  }

  try {
    const response = await fetch(
      'https://api.lever.co/v1/opportunities?limit=10&expand=contact',
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status}`)
    }

    const data = await response.json()
    const opportunities = data.data || []

    // Find Towsiful specifically to debug
    const towsiful = opportunities.find((opp: any) => 
      opp.name?.toLowerCase().includes('towsiful')
    )
    
    const debug = opportunities.map((opp: any) => {
      return {
        name: opp.name || 'Unknown',
        // CORRECT: Links are on opportunity object!
        links: opp.links || [],
        linksCount: (opp.links || []).length,
        // Resume info
        hasResume: !!opp.resume,
        resumeFile: opp.resume?.file || null,
        // Contact info
        emails: opp.emails || [],
        phones: opp.phones || [],
        location: opp.location || null,
        headline: opp.headline || null,
        // All fields in opportunity
        allOppFields: Object.keys(opp),
      }
    })
    
    // If we found Towsiful, show his FULL data
    const towsifulDebug = towsiful ? {
      name: towsiful.name,
      links: towsiful.links,
      resume: towsiful.resume,
      fullOpportunity: towsiful,
    } : null

    return NextResponse.json({
      success: true,
      total: opportunities.length,
      withLinks: debug.filter((d: any) => d.linksCount > 0).length,
      withResume: debug.filter((d: any) => d.hasResume).length,
      candidates: debug,
      towsifulDebug,
    }, { 
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      } 
    })

  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
