// assets/js/chatbot.js

const WORKER_URL =
  'https://prateesh-chatbot-production.prateeshreddy99.workers.dev';

(async () => {
  const QUESTIONS = [
    'Has Prateesh deployed ML models to production?',
    'What is Prateesh currently working on at Toyota?',
    'What is Prateesh’s work authorization?',
    'Which roles is Prateesh interested in?',
    'Does Prateesh have experience with Generative AI or LLMs?',
    'What cloud and MLOps tools has Prateesh used?',
    'What types of problems is Prateesh best suited to solve?',
  ];

  // Inject the widget
  const container = document.getElementById('chat-container');
  container.innerHTML = `
    <div id="chat">
      <div id="chat-header">🤖 Ask About Prateesh</div>
      <div class="content">
        <div id="messages"></div>
        <div id="input-area">
          <input id="input" placeholder="Type a question…" />
          <button id="send">Send</button>
        </div>
      </div>
    </div>`;

  const chat = document.getElementById('chat');
  const header = document.getElementById('chat-header');
  const messagesEl = document.getElementById('messages');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');

  // Render the intro + buttons
  function showIntro() {
    messagesEl.innerHTML = '';
    const introWrap = document.createElement('div');
    introWrap.className = 'bot message-wrapper';
    const introMsg = document.createElement('div');
    introMsg.className = 'message';
    introMsg.innerHTML = `
      👋 Hi, I'm an intelligent AI Chatbot created by Prateesh.<br>
      You can ask me anything about Prateesh.<br>
      <br>
      🤫 I'm kidding, I’ve been sworn to secrecy on some of his deep secrets—so stick to questions about his work and projects.<br><br>
      💡 Here are some ideas to get you started:
    `;
    introWrap.append(introMsg);
    messagesEl.append(introWrap);

    const btnRow = document.createElement('div');
    btnRow.className = 'bot message-wrapper button-row';
    QUESTIONS.forEach((q) => {
      const btn = document.createElement('button');
      btn.className = 'sample-button';
      btn.textContent = q;
      btn.onclick = () => {
        send(q);
        btn.remove();
      };
      btnRow.append(btn);
    });
    messagesEl.append(btnRow);
    messagesEl.scrollTop = 0; // start at the top so intro is visible
  }

  // Send user question → Worker → display bot answer
  async function send(question) {
    // user bubble
    const uWrap = document.createElement('div');
    uWrap.className = 'user message-wrapper';
    uWrap.innerHTML = `<div class="message">${question}</div>`;
    messagesEl.append(uWrap);

    // call the chat API
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: question }] }),
    });
    const { content } = await res.json();

    // bot bubble
    const bWrap = document.createElement('div');
    bWrap.className = 'bot message-wrapper';
    bWrap.innerHTML = `<div class="message">${content}</div>`;
    messagesEl.append(bWrap);

    messagesEl.scrollTop = 1e9;
  }

  // Wire up Send button & Enter key
  sendBtn.onclick = () => {
    const q = input.value.trim();
    if (!q) return;
    send(q);
    input.value = '';
  };
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });

  // Toggle open/close
  header.onclick = () => {
    if (!chat.classList.contains('open')) {
      chat.classList.add('open');
      showIntro();
    } else {
      chat.classList.remove('open');
    }
  };

  // Start closed
})();
