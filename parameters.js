// parameters.js

export default {
  // ——————————————————————————————————————————————
  // URLs & webhooks
  // ——————————————————————————————————————————————

  /** Raw markdown of the live résumé we’ll RAG against. */
  resume_url:
    'https://raw.githubusercontent.com/prateeshreddy/prateeshreddy.github.io/main/resume.md',

  /** Where out-of-scope questions get POSTed for later review. */
  unanswered_webhook:
    'https://script.google.com/macros/s/AKfycbzS0LIZAn5qXeskhEHzX--Ilj68lXRtioZ2qAeNHXjX8FP6UyD-ZtrBj-r1Mxd70cNyAA/exec',


  // ——————————————————————————————————————————————
  // RAG (retrieval-augmented generation) behavior
  // ——————————————————————————————————————————————

  /** “full” => send entire résumé; “hybrid” => send top_k chunks */
  rag_strategy: 'hybrid',

  /** How many highest-scoring chunks to include when hybrid RAG is enabled */
  top_k: 5,

  /**
   * If the best chunk’s similarity score < this threshold,
   * fall back to full-context mode instead.
   */
  similarity_threshold: 0.3,


  // ——————————————————————————————————————————————
  // OpenAI & generation settings
  // ——————————————————————————————————————————————

  /** embedding model for chunking & retrieval */
  embedding_model: 'text-embedding-ada-002',

  /** chat/completion model */
  chat_model: 'gpt-3.5-turbo',

  /** sampling temperature; 0.0 for deterministic answers */
  temperature: 0.0,


  // ——————————————————————————————————————————————
  // Out-of-scope: what the bot says when it doesn’t know
  // ——————————————————————————————————————————————

  oos_text:
    `Yikes 😅 I’m still in training on that one! I only know about Prateesh and his work stuff, \
but I’ll bug him for you and learn it next time. For now, grab his resume from the homepage!`,


  // ——————————————————————————————————————————————
  // “Direct map” FAQs: questions we always answer without hitting OpenAI
  // ——————————————————————————————————————————————

  direct_answers: {
    /** Toyota production planning & GenAI assistant work */
    'what is prateesh currently working on at toyota?':
      `At Toyota, Prateesh is leading the development of predictive scheduling \
and production planning models using linear programming and machine learning \
to optimize monthly vehicle builds across 1200+ dealerships. He also developed \
a GenAI-powered assistant ('AskToyota') using LLaMA2 and LangChain to surface \
forecasting documentation and improve decision-making across business units.`,

    /** Target roles & locations */
    'which roles is prateesh interested in?':
      `Senior-level roles in Data Science, Machine Learning Engineering, Applied Science, \
or Solutions Engineering. Open to in-person or hybrid roles across the U.S., with a \
strong preference for positions that emphasize applied GenAI, LLM systems, or \
scalable ML infrastructure.`,

    /** H-1B work authorization */
    'what is prateesh’s work authorization?':
      `Currently holds an H-1B visa and is open to H-1B transfer. Eligible for full-time \
employment in the U.S. without work restrictions.`,

    /** GenAI & LLM experience */
    'does prateesh have experience with generative ai or llms?':
      `Yes. Prateesh built an internal Generative AI assistant at Toyota called 'AskToyota' \
using retrieval-augmented generation (RAG), FAISS vector stores, and self-hosted LLaMA2. \
He orchestrated the solution with LangChain and deployed it internally using Docker, \
FastAPI, and AWS infrastructure.`,

    /** Production ML pipelines */
    'has prateesh deployed ml models to production?':
      `Yes. He has built and deployed production-grade ML pipelines using SageMaker, \
Airflow, and CloudWatch. These pipelines support monthly forecasting and optimization \
runs at Toyota and are fully automated with monitoring, retraining, and data integrity checks.`,

    /** Cloud & MLOps tools */
    'what cloud and mlops tools has prateesh used?':
      `AWS (SageMaker, EC2, S3, CloudWatch), Azure, Docker, FastAPI, Airflow, \
GitHub Actions, Jenkins. Skilled in CI/CD pipelines, data validation, scalable \
deployments, and real-time monitoring.`,

    /** Optimization algorithms */
    'does prateesh have experience with optimization algorithms?':
      `Yes. At Toyota, he implemented constrained linear programming using GurobiPy \
to solve supply chain and production allocation problems at scale, improving plant \
throughput and reducing inventory mismatches.`,

    /** Problem-types best solved */
    'what types of problems is prateesh best suited to solve?':
      `Complex forecasting, production planning, demand modeling, Generative AI \
applications, optimization problems, and ML system deployment — especially those \
requiring cross-functional collaboration and scalability.`,
  },
};