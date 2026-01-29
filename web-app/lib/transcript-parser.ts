import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface TranscriptMetadata {
  candidateName: string
  interviewer: string
  participants: string[]
  meetingType: string
  meetingCategory: 'Interview' | 'Client Debrief' | 'Sales Meeting' | 'Status Update' | 'Planning Meeting' | 'Team Sync' | 'Client Call' | '1-on-1' | 'All Hands' | 'Standup' | 'Retrospective' | 'Demo' | 'Other'
  summary: string
  position?: string
}

export async function parseTranscriptMetadata(transcript: string, fileName: string): Promise<TranscriptMetadata> {
  // Clean up the transcript - remove Tactiq boilerplate
  let cleanTranscript = transcript
    .replace(/Transcript delivered by Tactiq\.io.*?View the full transcript.*?\n/gs, '')
    .replace(/get it for your Google Meet today!/g, '')
    .trim()
  
  // Extract participants from speaker labels for fallback
  let participants: string[] = []
  const speakerRegex = /\* \d+:\d+ [✓✅] : \((.*?)\)/g
  const speakers = new Set<string>()
  let speakerMatch
  while ((speakerMatch = speakerRegex.exec(cleanTranscript)) !== null) {
    const name = speakerMatch[1].trim()
    if (name && name.length > 2 && !name.includes('View the full transcript')) {
      speakers.add(name)
    }
  }
  participants = Array.from(speakers)

  // Use AI to extract metadata and generate summary
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    // Use a good sample of the transcript for context
    const transcriptSample = cleanTranscript.slice(0, 12000)
    
    const prompt = `You are analyzing a meeting transcript. Read it carefully and extract key information.

TRANSCRIPT:
${transcriptSample}

TASK: Analyze this meeting and provide structured information.

IMPORTANT INSTRUCTIONS:
1. Identify the PRIMARY SUBJECT (person being discussed, interviewed, or presenting) - this is usually NOT Adam Perlis
2. Identify the PRIMARY FACILITATOR/HOST - often Adam Perlis or company staff
3. CATEGORIZE the meeting type based on its purpose and content:
   - "Interview" = Direct hiring interview with a candidate, portfolio review, screening call
   - "Client Debrief" = Meeting WITH a client to discuss/review candidates, talent presentation, candidate feedback session (Academy staff presenting candidates to clients)
   - "Sales Meeting" = Sales pitch, demo, client prospecting, deal discussion
   - "Status Update" = Project status, progress report, milestone review
   - "Planning Meeting" = Strategy session, roadmap planning, goal setting
   - "Team Sync" = Team meeting, collaboration session, group discussion
   - "Client Call" = Client support, customer success, account management
   - "1-on-1" = One-on-one check-in, manager/employee meeting, coaching
   - "All Hands" = Company-wide meeting, announcements
   - "Standup" = Daily standup, quick team sync
   - "Retrospective" = Sprint retro, lessons learned, post-mortem
   - "Demo" = Product demo, feature showcase, training
   - "Other" = Anything else
4. Extract specific job role if this is an interview/hiring meeting
5. Write a professional 3-4 sentence summary appropriate to the meeting type

DISTINGUISHING KEY MEETING TYPES:
- "Interview" = Academy staff speaking WITH a candidate (candidate is in the meeting)
- "Client Debrief" = Academy staff speaking WITH a client ABOUT candidates (candidates not present, discussing who to hire)

Return your analysis as a JSON object with this exact structure:
{
  "candidateName": "Primary subject/participant name (or 'Team' for group meetings, or 'Multiple Candidates' if discussing several)",
  "interviewer": "Host/facilitator name",
  "meetingType": "Descriptive subtitle like 'Technical Interview' or 'Candidate Review'",
  "meetingCategory": "ONE of: Interview, Client Debrief, Sales Meeting, Status Update, Planning Meeting, Team Sync, Client Call, 1-on-1, All Hands, Standup, Retrospective, Demo, Other",
  "position": "Job role if interview, otherwise null",
  "summary": "3-4 sentence professional summary"
}

Return ONLY valid JSON, no other text.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    
    console.log(`🤖 AI Response (first 200 chars): ${text.substring(0, 200)}`)
    
    // Try to parse JSON from response, handling markdown code blocks
    let jsonText = text
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1]
      console.log('📦 Extracted from code block')
    } else {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
        console.log('📦 Extracted from text')
      }
    }
    
    const parsed = JSON.parse(jsonText)
    console.log(`📋 Parsed JSON: candidate=${parsed.candidateName}, interviewer=${parsed.interviewer}, category=${parsed.meetingCategory}`)
    
    // Validate the parsed data - be more lenient
    if (parsed.candidateName && 
        parsed.candidateName !== 'Unknown Candidate' && 
        !parsed.candidateName.includes('View the full transcript') &&
        parsed.summary &&
        parsed.meetingCategory) {
      
      console.log(`✅ AI parsed: ${parsed.candidateName} | Category: ${parsed.meetingCategory} | Summary length: ${parsed.summary.length}`)
      
      return {
        candidateName: parsed.candidateName,
        interviewer: parsed.interviewer || 'Unknown',
        participants: participants.length > 0 ? participants : [parsed.candidateName, parsed.interviewer].filter(Boolean),
        meetingType: parsed.meetingType || parsed.meetingCategory,
        meetingCategory: parsed.meetingCategory || 'Other',
        summary: parsed.summary,
        position: parsed.position || undefined
      }
    } else {
      console.log('⚠️ AI parsing validation failed:', { 
        hasCandidateName: !!parsed.candidateName,
        candidateName: parsed.candidateName,
        hasSummary: !!parsed.summary,
        summaryLength: parsed.summary?.length,
        hasCategory: !!parsed.meetingCategory
      })
    }
  } catch (error) {
    console.error('Error parsing transcript with AI:', error)
  }

  // Fallback if AI parsing fails
  const fallbackCandidate = participants.find(p => 
    !p.toLowerCase().includes('adam perlis') && 
    !p.toLowerCase().includes('perlis')
  ) || 'Unknown Candidate'
  
  const fallbackInterviewer = participants.find(p => 
    p.toLowerCase().includes('adam perlis') || 
    p.toLowerCase().includes('perlis')
  ) || 'Unknown'

  return {
    candidateName: fallbackCandidate,
    interviewer: fallbackInterviewer,
    participants: participants,
    meetingType: 'Interview',
    meetingCategory: 'Interview',
    summary: `Interview conversation between ${fallbackInterviewer} and ${fallbackCandidate}. Full transcript available for review.`,
    position: undefined
  }
}
