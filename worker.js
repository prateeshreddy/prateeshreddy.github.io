// worker.js
// RAG-powered resume chatbot with proper error handling

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

    try {
      // Parse user query
      const { messages } = await request.json();
      const query = messages[messages.length - 1].content;

      // Fetch and chunk the resume
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

      // Embed the user query
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

      // Score and pick top 3 chunks
      const topChunks = indexed
        .map(c => ({ ...c, score: cosine(queryVec, c.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => c.text)
        .join("\n\n");

      // Build system prompt
      const systemPrompt = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé to answer truthfully:
${topChunks}

If asked anything outside this context, reply:
"Sorry, I only answer questions about Prateesh."
`.trim();

      // Call chat completion
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
      const chatJson = await chatRes.json();

      // Safely extract answer
      let answer = "Sorry, I couldn’t generate a response.";
      if (chatJson.choices && chatJson.choices[0]?.message?.content) {
        answer = chatJson.choices[0].message.content;
      }

      return new Response(JSON.stringify({ content: answer }), {
        headers: { "Content-Type": "application/json", ...cors }
      });

    } catch (err) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({
        content: "Sorry, something went wrong on my end. Check logs."
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }
  }
};
