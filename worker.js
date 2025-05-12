import parameters from "./parameters.js";

const {
  resume_url,
  unanswered_webhook,
  rag_strategy,
  top_k,
  similarity_threshold,
  embedding_model,
  chat_model,
  temperature,
  oos_text,
  direct_answers
} = parameters;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// 1) Direct‐mapping lookup for your eight questions
function directAnswer(question) {
  const key = q
  .toLowerCase()
  .replace(/[^\w ]+/g, "")   // strip punctuation
  .replace(/\s+/g, " ")      // collapse spaces
  .trim();
  return direct_answers[q] || null;
}

function cosine(a, b) {
  let dot = 0,
    nA = 0,
    nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB));
}

function chunkText(md) {
  return md
    .split(/^### /m)
    .slice(1)
    .map((p) => "### " + p.trim());
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    if (request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const { messages } = await request.json();
    const question = messages[messages.length - 1].content;

    // 1) direct‐map
    const direct = directAnswer(question);
    if (direct) return jsonResponse({ content: direct });

    // 2) RAG fallback
    try {
      const md = await (await fetch(resume_url)).text();
      const chunks = chunkText(md);

      // embed chunks
      const emBody = JSON.stringify({ model: embedding_model, input: chunks });
      let res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: emBody,
      });
      let js = await res.json();
      if (!res.ok || !Array.isArray(js.data))
        throw new Error("Chunk embed failed");
      const indexed = chunks.map((t, i) => ({
        text: t,
        vec: js.data[i].embedding,
      }));

      // embed the query
      res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: embedding_model, input: [question] }),
      });
      js = await res.json();
      if (!res.ok || !Array.isArray(js.data))
        throw new Error("Query embed failed");
      const qVec = js.data[0].embedding;

      // pick top‐K
      const scored = indexed
        .map((c) => ({ ...c, score: cosine(qVec, c.vec) }))
        .sort((a, b) => b.score - a.score);

      let context = "";
      if (
        rag_strategy === "full" ||
        (rag_strategy === "hybrid" && scored[0].score < similarity_threshold)
      ) {
        // full: include entire md
        context = md;
      } else {
        // hybrid/search_only
        context = scored
          .slice(0, top_k)
          .map((c) => c.text)
          .join("\n\n");
      }

      // build system prompt including both resume and FAQ context
      const system = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé and Frequently Asked Questions (FAQs):
${context}

If asked anything outside this context, reply exactly:
"${oos_text}"
`.trim();

      // chat completion
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: chat_model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: question },
          ],
          temperature: temperature,
        }),
      });
      js = await res.json();
      const content = js.choices?.[0]?.message?.content ?? oos_text;

      const normalized = txt =>
        txt
          .trim()
          .replace(/\s+/g, " ");            // collapse all whitespace

      // Log out-of-scope questions to your Google Sheet
      if (normalized(content) === normalized(oos_text)) {
        fetch(unanswered_webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        }).catch((e) => console.error("Logging failed:", e));
      }

      return jsonResponse({ content });
    } catch (err) {
      console.error("RAG error:", err);
      return jsonResponse({ content: "Sorry, something went wrong." }, 500);
    }
  },
};
