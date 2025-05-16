// parameters.js
export default {
  // URLs & webhooks
  resume_url: 'https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/main/resume.md',
  unanswered_webhook: 'https://script.google.com/macros/s/AKfycbzS0LIZAn5qXeskhEHzX--Ilj68lXRtioZ2qAeNHXjX8FP6UyD-ZtrBj-r1Mxd70cNyAA/exec',

  // RAG behavior: "full" or "hybrid" context window
  rag_strategy: 'full',

  // How many top chunks to include for Hybrid strategy
  top_k: 5,

  // Used for hybrid RAG strategy = best-chunk score < below defined threshold → fallback to full context
  similarity_threshold: 0.3,

  // OpenAI models & generation params
  embedding_model: 'text-embedding-ada-002',
  chat_model: 'gpt-3.5-turbo',
  temperature: 0.0,

  // Out-of-scope reply when the bot doesn’t know the answer yet
  oos_text: `Yikes 😅 I’m still in training on that one! I only know about Prateesh and his work stuff, but I’ll bug him for you and learn it next time. For now, grab his resume from the homepage!`
}