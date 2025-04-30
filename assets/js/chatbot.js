// assets/js/chatbot.js
(async () => {
  const QUESTIONS = [
    "What is Prateesh currently working on at Toyota?",
    "Which roles is Prateesh interested in?",
    "What is Prateesh’s work authorization?"
  ];

  // 1. Inject the container
  const container = document.getElementById("chat-container");
  container.innerHTML = `
    <div id="chat">
      <div id="chat-header">🤖 Ask About Prateesh</div>
      <div id="messages"></div>
      <div id="input-area">
        <input id="input" placeholder="Type a question…" />
        <button id="send">Send</button>
      </div>
    </div>`;

  const messagesEl = document.getElementById("messages");

  // 2. Render intro + buttons
  function showIntro() {
    messagesEl.innerHTML = "";

    // Intro bubble
    const introWrap = document.createElement("div");
    introWrap.className = "bot message-wrapper";
    const introMsg = document.createElement("div");
    introMsg.className = "message";
    introMsg.innerHTML = `
      👋 Hi, I'm an intelligent AI Chatbot created by Prateesh.<br>
      You can ask me anything about Prateesh.<br>
      I'm kidding lol!<br>
      I was told by Prateesh not to reveal his secrets but I can share about his work.<br><br>
      Below are some questions you can ask me
    `;
    introWrap.appendChild(introMsg);
    messagesEl.appendChild(introWrap);

    // Button row (transparent style)
    const btnRow = document.createElement("div");
    btnRow.className = "bot message-wrapper button-row";
    QUESTIONS.forEach(q => {
      const btn = document.createElement("button");
      btn.className = "sample-button";
      btn.textContent = q;
      btn.onclick = () => {
        send(q);
        btn.remove();
      };
      btnRow.appendChild(btn);
    });
    messagesEl.appendChild(btnRow);

    messagesEl.scrollTop = 1e9;
  }

  // 3. Handle sending (buttons or input)
  async function send(question) {
    // 3a. Show user bubble
    const uWrap = document.createElement("div");
    uWrap.className = "user message-wrapper";
    const uMsg = document.createElement("div");
    uMsg.className = "message";
    uMsg.textContent = question;
    uWrap.appendChild(uMsg);
    messagesEl.appendChild(uWrap);

    // 3b. Call Worker
    const res = await fetch("https://prateesh-chatbot-production.prateeshreddy99.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: question }] })
    });
    const { content } = await res.json();

    // 3c. Show bot bubble
    const bWrap = document.createElement("div");
    bWrap.className = "bot message-wrapper";
    const bMsg = document.createElement("div");
    bMsg.className = "message";
    bMsg.textContent = content;
    bWrap.appendChild(bMsg);
    messagesEl.appendChild(bWrap);

    messagesEl.scrollTop = 1e9;
  }

  // 4. Wire up the “Send” button + Enter key
  document.getElementById("send").onclick = () => {
    const q = document.getElementById("input").value.trim();
    if (q) {
      send(q);
      document.getElementById("input").value = "";
    }
  };
  document.getElementById("input").addEventListener("keypress", e => {
    if (e.key === "Enter") {
      document.getElementById("send").click();
    }
  });

  // 5. Show intro on load
  showIntro();
})();
