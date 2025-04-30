export default {
  async fetch(request, env) {
    // Handle CORS preflight
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS, POST",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Parse the incoming user messages
    const { messages } = await request.json();

    // 2. Fetch the latest resume.md from your repo
    const resumeUrl =
      "https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/feature/chatbot/resume.md";
    const resumeResponse = await fetch(resumeUrl);
    const resumeText = await resumeResponse.text();

    // 3. Build the system prompt
    const systemPrompt = `
You are an assistant that ONLY answers questions about Prateesh Reddy Patlolla.
Use this résumé for context and facts:
${resumeText}

If the user asks anything outside Prateesh’s background, reply:
"Sorry, I only answer questions about Prateesh."
    `.trim();

    // 4. Call the OpenAI Chat Completion API
    const payload = {
      model: "gpt-3.5-turbo",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ]
    };
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    const apiJson = await apiRes.json();
    const reply = apiJson.choices?.[0]?.message?.content || 
                  "Sorry, I couldn’t generate a response. Please download Prateesh's resume in homepage for more information";

    // 5. Return the assistant’s reply, with CORS headers
    return new Response(
      JSON.stringify({ content: reply }), 
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};
