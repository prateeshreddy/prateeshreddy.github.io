// worker.js
// Hybrid: direct answers for common questions + RAG fallback

const UNANSWERED_WEBHOOK = "https://script.google.com/macros/s/AKfycbzS0LIZAn5qXeskhEHzX--Ilj68lXRtioZ2qAeNHXjX8FP6UyD-ZtrBj-r1Mxd70cNyAA/exec";

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}

// 1) Direct‐mapping lookup for your eight questions
function directAnswer(question) {
  const q = question.toLowerCase().trim();
  const map = {
    "what is prateesh currently working on at toyota?":
      `At Toyota, Prateesh is leading the development of predictive scheduling and production planning models using linear programming and machine learning to optimize monthly vehicle builds across 1200+ dealerships. He also developed a GenAI-powered assistant ('AskToyota') using LLaMA2 and LangChain to surface forecasting documentation and improve decision-making across business units.`,

    "which roles is prateesh interested in?":
      `Senior-level roles in Data Science, Machine Learning Engineering, Applied Science, or Solutions Engineering. Open to in-person or hybrid roles across the U.S., with a strong preference for positions that emphasize applied GenAI, LLM systems, or scalable ML infrastructure.`,

    "what is prateesh’s work authorization?":
      `Currently holds an H-1B visa and is open to H-1B transfer. Eligible for full-time employment in the U.S. without work restrictions.`,

    "does prateesh have experience with generative ai or llms?":
      `Yes. Prateesh built an internal Generative AI assistant at Toyota called 'AskToyota' using retrieval-augmented generation (RAG), FAISS vector stores, and self-hosted LLaMA2. He orchestrated the solution with LangChain and deployed it internally using Docker, FastAPI, and AWS infrastructure.`,

    "has prateesh deployed ml models to production?":
      `Yes. He has built and deployed production-grade ML pipelines using SageMaker, Airflow, and CloudWatch. These pipelines support monthly forecasting and optimization runs at Toyota and are fully automated with monitoring, retraining, and data integrity checks.`,

    "what cloud and mlops tools has prateesh used?":
      `AWS (SageMaker, EC2, S3, CloudWatch), Azure, Docker, FastAPI, Airflow, GitHub Actions, Jenkins. Skilled in CI/CD pipelines, data validation, scalable deployments, and real-time monitoring.`,

    "does prateesh have experience with optimization algorithms?":
      `Yes. At Toyota, he implemented constrained linear programming using GurobiPy to solve supply chain and production allocation problems at scale, improving plant throughput and reducing inventory mismatches.`,

    "what types of problems is prateesh best suited to solve?":
      `Complex forecasting, production planning, demand modeling, Generative AI applications, optimization problems, and ML system deployment — especially those requiring cross-functional collaboration and scalability.`
  };
  return map[q] || null;
}

// 2) Cosine similarity & chunking for RAG fallback
function cosine(a, b) {
  let dot=0,nA=0,nB=0;
  for (let i=0;i<a.length;i++){ dot+=a[i]*b[i]; nA+=a[i]*a[i]; nB+=b[i]*b[i]; }
  return dot/(Math.sqrt(nA)*Math.sqrt(nB));
}
function chunkText(md) {
  const parts = md.split(/^### /m).slice(1);
  return parts.map(p => '### '+p.trim());
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"POST,OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type"
      }});
    }
    if (request.method !== "POST") {
      return new Response("Not found", { status:404 });
    }

    const { messages } = await request.json();
    const question = messages[messages.length-1].content;

    //––– 1) Try direct mapping
    const direct = directAnswer(question);
    if (direct) {
      return jsonResponse({ content: direct });
    }

    //––– 2) RAG fallback (unchanged embedding + chat logic)
    try {
      const RESUME_URL = "https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/main/resume.md";
      const md = await (await fetch(RESUME_URL)).text();
      const chunks = chunkText(md);

      // embed chunks
      let res = await fetch("https://api.openai.com/v1/embeddings", {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({ model:"text-embedding-ada-002", input:chunks })
      });
      let js = await res.json();
      if (!res.ok || !Array.isArray(js.data)) throw new Error(js.error?.message||"Chunk embed failed");
      const indexed = chunks.map((t,i)=>({ text:t, vec: js.data[i].embedding }));

      // embed query
      res = await fetch("https://api.openai.com/v1/embeddings", {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({ model:"text-embedding-ada-002", input:[question] })
      });
      js = await res.json();
      if (!res.ok || !Array.isArray(js.data)) throw new Error(js.error?.message||"Query embed failed");
      const qVec = js.data[0].embedding;

      // retrieve top 3
      const top = indexed
        .map(c=>({ ...c, score:cosine(qVec,c.vec) }))
        .sort((a,b)=>b.score-a.score)
        .slice(0,3)
        .map(c=>c.text)
        .join("\n\n");

      // chat completion
      const system = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use ONLY the following context from his résumé:
${top}

If asked anything outside this context, reply:
"Sorry, I only answer questions about Prateesh's work. Please download resume from the homepage."
`.trim();

      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method:"POST",
        headers:{
          "Authorization":`Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages:[
            { role:"system", content:system },
            { role:"user", content:question }
          ],
          temperature:0.0
        })
      });
      js = await res.json();
      const content = js.choices?.[0]?.message?.content || "Sorry, I couldn’t generate a response.";

      // Log out-of-scope questions to your Google Sheet
      const OOS_TEXT = "Sorry, I only answer questions about Prateesh's work. Please download resume from the homepage.";
      if (content === OOS_TEXT) {
        fetch(UNANSWERED_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question })
        }).catch(err => console.error("Logging to sheet failed:", err));
      }

      return jsonResponse({ content });

    } catch (err) {
      console.error("RAG error:", err);
      return jsonResponse({ content: "Sorry, something went wrong." }, 500);
    }
  }
};
