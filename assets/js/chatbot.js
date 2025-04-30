// worker.js
// RAG‐powered resume chatbot (using text-embedding-ada-002)

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
    if (request.method === "OPTIONS")
      return new Response(null, { headers: CORS });
    if (request.method !== "POST")
      return new Response("Not found", { status: 404, headers: CORS });

    try {
      const { messages } = await request.json();
      const query = messages.at(-1).content;

      // 1) Fetch & chunk resume
      const RESUME_URL = "https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/feature/chatbot/resume.md";
      const resumeText = await (await fetch(RESUME_URL)).text();
      const chunks = chunkText(resumeText);

      // 2) Embed chunks (correct model)
      let res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: chunks
        })
      });
      let json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) {
        console.error("Chunk embedding failed:", res.status, json);
        throw new Error(json.error?.message || "Chunk embed error");
      }
      const indexed = chunks.map((text, i) => ({
        text,
        vector: json.data[i].embedding
      }));

      // 3) Embed query
      res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "text-embedding-ada-002",
          input: [query]
        })
      });
      json = await res.json();
      if (!res.ok || !Array.isArray(json.data)) {
        console.error("Query embedding failed:", res.status, json);
        throw new Error(json.error?.message || "Query embed error");
      }
      const queryVec = json.data[0].embedding;

      // 4) Retrieve top-3
      const top = indexed
        .map(c => ({ ...c, score: cosine(queryVec, c.vector) }))
        .sort((a,b) => b.score - a.score)
        .slice(0,3)
        .map(c => c.text)
        .join("\n\n");

      // 5) Chat completion
      const prompt = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé to answer truthfully:
${top}

If asked anything outside this context, reply:
"Sorry, I only answer questions about Prateesh."
`.trim();

      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: prompt },
            { role: "user",   content: query }
          ],
          temperature: 0.0
        })
      });
      json = await res.json();

      let answer = "Sorry, I couldn’t generate a response.";
      if (json.choices?.[0]?.message?.content) {
        answer = json.choices[0].message.content;
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
