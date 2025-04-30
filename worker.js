// worker.js
import { serve } from 'std/server'

// Utility: simple cosine similarity
function cosine(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai*ai, 0))
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi*bi, 0))
  return dot / (normA * normB)
}

// Split resume into chunks on each "### " heading
function chunkText(markdown) {
  // Drop front matter before first experience header
  const parts = markdown.split(/^### /m).slice(1)
  return parts.map(p => '### ' + p.trim())
}

// Fetch & embed all chunks each request (small resume, acceptable)
async function getChunksAndEmbeddings(openaiKey, resumeUrl) {
  const md = await fetch(resumeUrl).then(r => r.text())
  const chunks = chunkText(md)
  // embed_many endpoint
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: chunks
    })
  })
  const { data } = await resp.json()
  // data[i].embedding corresponds to chunks[i]
  return chunks.map((text, i) => ({ text, vector: data[i].embedding }))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    })
  }
  if (req.method !== 'POST') {
    return new Response("Not found", { status: 404 })
  }

  const { messages } = await req.json()
  const query = messages[messages.length-1].content

  const OPENAI_KEY = OPENAI_API_KEY // set via Wrangler secret
  const RESUME_URL = "https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/feature/chatbot/resume.md"

  // 1. Build our in-memory vector index
  const indexed = await getChunksAndEmbeddings(OPENAI_KEY, RESUME_URL)

  // 2. Embed the user query
  const qEmbResp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: [ query ]
    })
  })
  const qEmb = (await qEmbResp.json()).data[0].embedding

  // 3. Score & pick top-3 most similar chunks
  const top = indexed
    .map(c => ({ ...c, score: cosine(qEmb, c.vector) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.text)
    .join("\n\n")

  // 4. Call ChatCompletion with just the relevant context
  const systemPrompt = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé to answer truthfully:
${top}

If asked anything outside this context, reply:
"Sorry, I only answer questions about Prateesh."
`.trim()

  const chatResp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: query }
      ],
      temperature: 0.0
    })
  })
  const { choices } = await chatResp.json()
  const answer = choices[0].message.content

  return new Response(JSON.stringify({ content: answer }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    }
  })
})
