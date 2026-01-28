import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  // Use gemini-embedding-001 (3072 dimensions, free)
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

  // Truncate text if too long
  const truncatedText = text.slice(0, 8000)

  const result = await model.embedContent({
    content: { parts: [{ text: truncatedText }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })
  
  return result.embedding.values
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

  const results = await Promise.all(
    texts.map(async (text) => {
      const truncatedText = text.slice(0, 8000)
      const result = await model.embedContent({
        content: { parts: [{ text: truncatedText }], role: 'user' },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      })
      return result.embedding.values
    })
  )

  return results
}
