(async () => {
  // Insert the chat container HTML
  const container = document.getElementById("chat-container");
  container.innerHTML = `
    <div id="chat">
      <div id="messages"></div>
      <div id="samples">
        Try:
        <button data-q="What were Prateesh’s project at Toyota?">Toyota project?</button>
        <button data-q="Which roles is Prateesh interested in?">Desired roles?</button>
        <button data-q="What is Prateesh’s work authorization?">Work auth?</button>
      </div>
      <input id="input" placeholder="Ask me about Prateesh…" />
      <button id="send">Send</button>
    </div>
  `;

  // Helper to append messages
  const append = (cls, text) => {
    const el = document.createElement("div");
    el.className = cls;
    el.textContent = text;
    document.getElementById("messages").append(el);
    document.getElementById("messages").scrollTop = 1e9;
  };

  // Send a user question to the Worker
  async function send(q) {
    append("user", q);
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: q }] })
    });
    const { content } = await res.json();
    append("bot", content);
  }

  // Wire up sample buttons
  document.querySelectorAll("#samples button")
    .forEach(btn => btn.onclick = () => send(btn.dataset.q));

  // Wire up send button & Enter key
  document.getElementById("send")
    .onclick = () => {
      const q = document.getElementById("input").value;
      if (q) send(q);
    };
  document.getElementById("input")
    .addEventListener("keypress", e => {
      if (e.key === "Enter") send(e.target.value);
    });
})();
