import OpenAI from 'openai'

// Lazy-initialize OpenAI client
let openai: OpenAI | null = null

function getOpenAI() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey || apiKey === 'your-openai-key-here') {
      throw new Error('OPENAI_API_KEY not configured in .env file')
    }

    openai = new OpenAI({
      apiKey,
    })
  }

  return openai
}

/**
 * Generate embedding for a text query
 * Uses text-embedding-3-small (1536 dimensions)
 * Same model used to create document embeddings in database
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const client = getOpenAI()

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than individual calls
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<number[][]> {
  try {
    const client = getOpenAI()

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    })

    return response.data.map((item) => item.embedding)
  } catch (error) {
    console.error('Error generating embeddings batch:', error)
    throw new Error('Failed to generate embeddings batch')
  }
}
