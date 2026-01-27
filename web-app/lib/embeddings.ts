import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  // Truncate text if too long (Gemini has token limits)
  // text-embedding-004 has a 2048 token limit (approx 6-8k chars). 
  // However, for retrieval tasks, we might want to chunk. 
  // For simplicity in this v1, we'll truncate to ensure it doesn't error, 
  // but ideally we'd chunk large transcripts.
  // Let's use a safe char limit.
  const truncatedText = text.slice(0, 8000)

  const result = await model.embedContent(truncatedText)
  return result.embedding.values
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  const results = await Promise.all(
    texts.map(async (text) => {
      const truncatedText = text.slice(0, 8000)
      const result = await model.embedContent(truncatedText)
      return result.embedding.values
    })
  )

  return results
}
