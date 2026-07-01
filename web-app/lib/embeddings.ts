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

/**
 * Fail-open embedding for INGESTION paths.
 *
 * Returns `null` instead of throwing when the embedding API is unavailable
 * (invalid/expired key, quota, outage). Callers that ingest transcripts should
 * use this so a degraded embedding service never blocks a transcript from being
 * saved — the row is stored with a null embedding and can be backfilled later
 * (`where embedding is null`). Query paths that genuinely need an embedding to
 * function (e.g. semantic search over a question) should keep using
 * `generateEmbedding` so the failure surfaces to the user instead.
 *
 * Detectable as a distinct failure via the returned `reason` on the error log,
 * and reported to callers as a `null` return.
 */
export async function generateEmbeddingSafe(text: string): Promise<number[] | null> {
  try {
    return await generateEmbedding(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Embeddings] generateEmbedding failed — importing without embedding:', message)
    return null
  }
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
