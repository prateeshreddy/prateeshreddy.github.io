# Prateesh’s GenAI Resume Assistant

_A Cloudflare-Workers–powered Retrieval-Augmented Generation (RAG) chatbot that answers questions about Prateesh Reddy Patlolla’s work and projects._

### Find it here : https://prateeshreddy.github.io

<img width="495" alt="image" src="https://github.com/user-attachments/assets/39473ea3-2494-4a15-82a9-e6137a50299c" />


---

## 📂 Repo Structure

- **worker.js** — main Cloudflare Worker script (fetch & RAG logic)
- **parameters.js** — all tunable parameters (URLs, model names, thresholds, direct-answer map, etc.)
- **assets/** — front-end widget, CSS, and sample HTML (if any)
- **parameters.js** — configuration for RAG, direct answers, models, thresholds
- **README.md** — you are here

---

## 🚀 Branching & Workflow

- **`main`**

  - Always deployable, backed by CI, serves production Worker

- **`feature/<name>`**

  - New features, experiments, parameter changes

- **`bugfix/<name>`**

  - Urgent fixes to either `main` or `staging` logic

**Typical Flow**

1. `git checkout -b feature/awesome-thing`
2. Code changes
3. Push → open PR against `main`
4. Review & merge

---

## 🔧 Local Testing & Staging

1. **Deploy to Staging**

   ```bash
   git checkout feature/your-branch
   wrangler deploy --env staging
   ```

2. **Smoke-test via `curl`**

   ```bash
   curl -X POST https://prateesh-chatbot-staging.prateeshreddy99.workers.dev/ \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Is Prateesh single?"}]}'
   ```

3. **Inspect logs**

   ```bash
   wrangler tail --env staging
   ```

---

## 🚢 Production Deployment & Testing

1. **Merge & Checkout**

   ```bash
   git checkout main
   git merge --no-ff feature/your-branch
   ```

2. **Deploy**

   ```bash
   wrangler deploy --env production
   ```

3. **Verify**

   ```bash
   curl -X POST https://prateesh-chatbot-production.prateeshreddy99.workers.dev/ \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"What roles is Prateesh interested in?"}]}'
   ```

---

## 🛠 Code Style & Formatting

- **Prettier** for all files

  ```bash
  npx prettier --write .
  ```

---

## 📝 Useful Tips

- **Changing behavior** → edit `parameters.js` (RAG strategy, `top_k`, thresholds, models, `oos_text`, direct-answers map).
- **Adding FAQs** → update `resume.md` or FAQ section in your knowledge file; no code changes needed for RAG fallback.
- **Monitoring cost** → check Cloudflare Workers usage & OpenAI billing dashboard.
- **Out-of-Scope Logging** → Worker POSTs unknown questions to your Google Sheets webhook for iterative improvement.
