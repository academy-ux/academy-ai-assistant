import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const leverKey = process.env.LEVER_API_KEY
        if (!leverKey) {
            return NextResponse.json({ error: 'Lever API key not configured' }, { status: 500 })
        }

        const id = params.id
        const res = await fetch(`https://api.lever.co/v1/opportunities/${id}/resumes`, {
            headers: {
                'Authorization': `Basic ${Buffer.from(leverKey + ':').toString('base64')}`,
            },
        })

        if (!res.ok) {
            return NextResponse.json({ years: null })
        }

        const data = await res.json()
        const latestResume = data.data?.[0]?.parsed

        if (!latestResume) {
            return NextResponse.json({ years: null })
        }

        // Logic to calculate experience from parsed positions or use a summary field if available
        // Some parses have a direct years field, others need calculation
        let totalYears = 0
        if (latestResume.positions && Array.isArray(latestResume.positions)) {
            // Very simple calculation: Sum up durations or look at earliest start
            let earliestDate = new Date()
            latestResume.positions.forEach((pos: any) => {
                if (pos.start && pos.start.year) {
                    const startDate = new Date(pos.start.year, (pos.start.month || 1) - 1)
                    if (startDate < earliestDate) earliestDate = startDate
                }
            })
            const now = new Date()
            totalYears = now.getFullYear() - earliestDate.getFullYear()
        }

        return NextResponse.json({
            years: totalYears > 0 ? `${totalYears}+` : null,
            parsed: latestResume
        })
    } catch (error) {
        console.error('Error fetching resume info:', error)
        return NextResponse.json({ years: null })
    }
}
