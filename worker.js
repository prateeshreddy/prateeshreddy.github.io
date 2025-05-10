import parameters from "./parameters.json";

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
  const q = question.toLowerCase().trim();
  const map = {
    "what is prateesh currently working on at toyota?": `At Toyota, Prateesh is leading the development of predictive scheduling and production planning models using linear programming and machine learning to optimize monthly vehicle builds across 1200+ dealerships. He also developed a GenAI-powered assistant ('AskToyota') using LLaMA2 and LangChain to surface forecasting documentation and improve decision-making across business units.`,

    "which roles is prateesh interested in?": `Senior-level roles in Data Science, Machine Learning Engineering, Applied Science, or Solutions Engineering. Open to in-person or hybrid roles across the U.S., with a strong preference for positions that emphasize applied GenAI, LLM systems, or scalable ML infrastructure.`,

    "what is prateesh’s work authorization?": `Currently holds an H-1B visa and is open to H-1B transfer. Eligible for full-time employment in the U.S. without work restrictions.`,

    "does prateesh have experience with generative ai or llms?": `Yes. Prateesh built an internal Generative AI assistant at Toyota called 'AskToyota' using retrieval-augmented generation (RAG), FAISS vector stores, and self-hosted LLaMA2. He orchestrated the solution with LangChain and deployed it internally using Docker, FastAPI, and AWS infrastructure.`,

    "does he have experience in generative ai?": `Yes. Prateesh built an internal Generative AI assistant at Toyota called 'AskToyota' using retrieval-augmented generation (RAG), FAISS vector stores, and self-hosted LLaMA2. He orchestrated the solution with LangChain and deployed it internally using Docker, FastAPI, and AWS infrastructure.`,

    "has prateesh deployed ml models to production?": `Yes. He has built and deployed production-grade ML pipelines using SageMaker, Airflow, and CloudWatch. These pipelines support monthly forecasting and optimization runs at Toyota and are fully automated with monitoring, retraining, and data integrity checks.`,

    "what cloud and mlops tools has prateesh used?": `AWS (SageMaker, EC2, S3, CloudWatch), Azure, Docker, FastAPI, Airflow, GitHub Actions, Jenkins. Skilled in CI/CD pipelines, data validation, scalable deployments, and real-time monitoring.`,

    "does prateesh have experience with optimization algorithms?": `Yes. At Toyota, he implemented constrained linear programming using GurobiPy to solve supply chain and production allocation problems at scale, improving plant throughput and reducing inventory mismatches.`,

    "what types of problems is prateesh best suited to solve?": `Complex forecasting, production planning, demand modeling, Generative AI applications, optimization problems, and ML system deployment — especially those requiring cross-functional collaboration and scalability.`,
  };
  return map[q] || null;
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

      // Log out-of-scope questions to your Google Sheet
      if (content === oos_text) {
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
