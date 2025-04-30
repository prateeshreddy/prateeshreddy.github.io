// worker.js
// RAG-powered resume chatbot, with embedding error checks

// Cosine similarity helper
function cosine(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i]*a[i];
    normB += b[i]*b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chunkText(markdown) {
  const parts = markdown.split(/^### /m).slice(1);
  return parts.map(p => '### ' + p.trim());
}

export default {
  async fetch(request, env) {
    const CORS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "POST") return new Response("Not found", { status: 404, headers: CORS });

    try {
      const { messages } = await request.json();
      const query = messages.at(-1).content;

      // 1. Fetch & chunk resume
      const RESUME_URL = 
        "https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/feature/chatbot/resume.md";
      const resumeText = await (await fetch(RESUME_URL)).text();
      const chunks = chunkText(resumeText);

      // 2. Embed chunks
      const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: chunks })
      });
      const embedText = await embedRes.text();
      let embedData;
      try {
        embedData = JSON.parse(embedText);
      } catch {
        console.error("Embedding chunks non-JSON response:", embedText);
        throw new Error("Embedding chunks returned invalid JSON");
      }
      if (!embedRes.ok || !Array.isArray(embedData.data)) {
        console.error("Embedding chunks error:", embedRes.status, embedText);
        throw new Error(`Embedding chunks failed: ${embedData.error?.message||embedRes.status}`);
      }
      const indexed = chunks.map((text, i) => ({
        text,
        vector: embedData.data[i].embedding
      }));

      // 3. Embed query
      const queryRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model: "text-embedding-3-small", input: [query] })
      });
      const queryText = await queryRes.text();
      let queryData;
      try {
        queryData = JSON.parse(queryText);
      } catch {
        console.error("Embedding query non-JSON response:", queryText);
        throw new Error("Embedding query returned invalid JSON");
      }
      if (!queryRes.ok || !Array.isArray(queryData.data)) {
        console.error("Embedding query error:", queryRes.status, queryText);
        throw new Error(`Embedding query failed: ${queryData.error?.message||queryRes.status}`);
      }
      const queryVec = queryData.data[0].embedding;

      // 4. Retrieve top 3 chunks
      const topChunks = indexed
        .map(c => ({ ...c, score: cosine(queryVec, c.vector) }))
        .sort((a,b) => b.score - a.score)
        .slice(0,3)
        .map(c => c.text)
        .join("\n\n");

      // 5. Chat completion
      const systemPrompt = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé to answer truthfully:
${topChunks}

If asked anything outside this context, reply:
"Sorry, I only answer questions about Prateesh."
`.trim();

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
      let answer = "Sorry, I couldn’t generate a response.";
      if (chatJson.choices?.[0]?.message?.content) {
        answer = chatJson.choices[0].message.content;
      }

      return new Response(JSON.stringify({ content: answer }), {
        headers: { "Content-Type": "application/json", ...CORS }
      });

    } catch (err) {
      console.error("Worker error:", err);
      return new Response(JSON.stringify({
        content: "Sorry, something went wrong on my end. Check logs."
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS }
      });
    }
  }
};
