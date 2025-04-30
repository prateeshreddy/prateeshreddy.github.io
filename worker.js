// worker.js
// RAG-powered resume chatbot

// Cosine similarity helper
function cosine(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Split resume into chunks on each "### " heading
function chunkText(markdown) {
  const parts = markdown.split(/^### /m).slice(1);
  return parts.map(p => '### ' + p.trim());
}

export default {
  async fetch(request, env) {
    // CORS preflight
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "POST") {
      return new Response("Not found", { status: 404, headers: cors });
    }

    // Parse user query
    const { messages } = await request.json();
    const query = messages[messages.length - 1].content;

    // Fetch resume and chunk it
    const RESUME_URL = "https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/feature/chatbot/resume.md";
    const resumeText = await (await fetch(RESUME_URL)).text();
    const chunks = chunkText(resumeText);

    // Embed chunks
    const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: chunks
      })
    });
    const embedData = await embedRes.json();
    const indexed = chunks.map((text, i) => ({
      text,
      vector: embedData.data[i].embedding
    }));

    // Embed user query
    const queryRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: [query]
      })
    });
    const queryVec = (await queryRes.json()).data[0].embedding;

    // Score + pick top 3 chunks
    const topChunks = indexed
      .map(c => ({ ...c, score: cosine(queryVec, c.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.text)
      .join("\n\n");

    // System prompt with only the top chunks
    const systemPrompt = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé to answer truthfully:
${topChunks}

If asked anything outside this context, reply:
"Sorry, I only answer questions about Prateesh."
`.trim();

    // Call chat.completions
    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
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
    });
    const { choices } = await chatRes.json();
    const answer = choices?.[0]?.message?.content || 
                   "Sorry, I couldn’t generate a response.";

    return new Response(JSON.stringify({ content: answer }), {
      headers: { "Content-Type": "application/json", ...cors }
    });
  }
};
