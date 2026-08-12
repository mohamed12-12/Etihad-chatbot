const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const messages = document.querySelector("#messages");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearButton");
const userId = crypto.randomUUID();

function addMessage(text, type) {
  const node = document.createElement("article");
  node.className = `message message--${type}`;
  node.textContent = text;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
  return node;
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
}

async function sendMessage(message) {
  const pending = addMessage("...", "bot");
  sendButton.disabled = true;
  input.disabled = true;

  try {
    const response = await fetch("/test-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message }),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Request failed.");
    }

    pending.textContent = body.reply;
  } catch (error) {
    pending.textContent = "صار في مشكلة بالتجربة. تأكد من GEMINI_API_KEY وشغّل السيرفر من جديد.";
    pending.classList.add("message--error");
  } finally {
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  resizeInput();
  sendMessage(message);
});

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

clearButton.addEventListener("click", async () => {
  await fetch(`/test-chat/${userId}`, { method: "DELETE" }).catch(() => {});
  messages.replaceChildren();
  addMessage("أهلاً وسهلاً، أنا أمجد من مكتب الاتحاد. كيف أقدر أساعدك؟", "bot");
  input.focus();
});
