import { parseTranscriptMetadata } from '../lib/transcript-parser'

const sampleTranscript = `Transcript delivered by Tactiq.io - get it for your Google Meet today!

27 Jan 2026 | v0 IRL chat (Adam Perlis)
Attendees: Adam Perlis, Caroline Ciaramitaro

Transcript
00:00 Adam Perlis: Hey Caroline, how's the product launch going?
00:15 Caroline Ciaramitaro: It's going great! We're launching V0's new features this week.
00:30 Adam Perlis: That's awesome. I'm excited to see what you've built.
01:00 Caroline Ciaramitaro: Thanks! We've been working on Git integration and improved AI capabilities.
01:30 Adam Perlis: How's the community team doing with all the growth?
01:45 Caroline Ciaramitaro: It's hectic but good. Managing Discord, events, and product feedback keeps us busy.`

async function test() {
  console.log('Testing AI summary generation...\n')
  try {
    const result = await parseTranscriptMetadata(sampleTranscript, 'test.txt')
    console.log('\n✅ SUCCESS!')
    console.log('Candidate:', result.candidateName)
    console.log('Interviewer:', result.interviewer)
    console.log('Meeting Type:', result.meetingType)
    console.log('Position:', result.position)
    console.log('\nSummary:')
    console.log(result.summary)
  } catch (error) {
    console.error('\n❌ ERROR:', error)
  }
}

test()
