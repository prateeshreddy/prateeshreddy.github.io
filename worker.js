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
      const { messages } = await request.json();
      const query = messages[messages.length - 1].content;

      // (your existing RAG code: fetch resume, chunk, embed, chat, etc.)
      // ... chunkText, embedding calls, similarity, chat completion ...

      // Suppose `answer` is the final string you got:
      return new Response(JSON.stringify({ content: answer }), {
        headers: { "Content-Type": "application/json", ...cors }
      });

    } catch (err) {
      // Log the real error to Wrangler logs
      console.error("Worker error:", err);

      // Return a JSON error message
      return new Response(JSON.stringify({
        content: "Sorry, something went wrong on my end. Check logs."
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors }
      });
    }
  }
};
