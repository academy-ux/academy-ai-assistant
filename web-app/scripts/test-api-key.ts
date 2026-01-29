/**
 * Test Gemini API Key
 */
import { GoogleGenerativeAI } from '@google/generative-ai'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const apiKey = process.env.GEMINI_API_KEY

console.log('🔑 Testing Gemini API Key...')
console.log('Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND')

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in .env.local')
  process.exit(1)
}

const genAI = new GoogleGenerativeAI(apiKey)

async function testKey() {
  try {
    // Test text generation
    console.log('\n📝 Testing text generation...')
    const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const textResult = await textModel.generateContent('Say "API key works!"')
    console.log('✅ Text generation:', textResult.response.text())
    
    // Test embeddings
    console.log('\n🔢 Testing embeddings...')
    const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const embedResult = await embedModel.embedContent({
      content: { parts: [{ text: 'test embedding' }], role: 'user' }
    })
    console.log('✅ Embedding dimensions:', embedResult.embedding.values.length)
    
    console.log('\n✨ All tests passed! Your API key is valid.')
  } catch (error: any) {
    console.error('\n❌ API Key Test Failed:')
    console.error(error.message)
    console.log('\n📋 To fix:')
    console.log('1. Go to: https://aistudio.google.com/app/apikey')
    console.log('2. Create a new API key')
    console.log('3. Update GEMINI_API_KEY in .env.local')
    process.exit(1)
  }
}

testKey()
