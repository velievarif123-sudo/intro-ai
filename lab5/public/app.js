// public/app.js
// - отправка вопроса на сервер
// - отображение ответа
// - базовая обработка ошибок
// - sessionId хранится в localStorage (чтобы история жила при перезагрузке)

const chatEl = document.getElementById("chat");
const form = document.getElementById("form");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");

const modelEl = document.getElementById("model");
const temperatureEl = document.getElementById("temperature");
const maxTokensEl = document.getElementById("maxTokens");
const keepHistoryEl = document.getElementById("keepHistory");
const resetBtn = document.getElementById("resetBtn");
const sendBtn = document.getElementById("sendBtn");

function getSessionId() {
  let id = localStorage.getItem("sessionId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sessionId", id);
  }
  return id;
}
const sessionId = getSessionId();

function addMessage(role, text) {
  const item = document.createElement("div");
  item.className = `msg ${role}`;
  item.textContent = text;
  chatEl.appendChild(item);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setStatus(text) {
  statusEl.textContent = text || "";
}

async function ask(question) {
  setStatus("");
  sendBtn.disabled = true;

  addMessage("user", question);

  try {
    const resp = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        sessionId,
        model: modelEl.value.trim() || "llama3.1",
        temperature: Number(temperatureEl.value),
        maxTokens: Number(maxTokensEl.value),
        keepHistory: keepHistoryEl.checked,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.error ? `${data.error}` : "Неизвестная ошибка.";
      const details = data?.details ? `\n${data.details}` : "";
      addMessage("error", msg + details);
      setStatus("Ошибка: проверь, запущена ли Ollama и правильна ли модель.");
      return;
    }

    addMessage("assistant", data.answer);
  } catch (e) {
    addMessage("error", `Сеть/сервер недоступен: ${String(e?.message ?? e)}`);
    setStatus("Не удалось связаться с сервером. Проверь, что node-сервер запущен.");
  } finally {
    sendBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = questionEl.value.trim();
  if (!q) return;
  questionEl.value = "";
  ask(q);
});

resetBtn.addEventListener("click", async () => {
  setStatus("");
  chatEl.innerHTML = "";
  try {
    const resp = await fetch("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!resp.ok) throw new Error("reset failed");
    setStatus("История сброшена.");
  } catch {
    setStatus("Не удалось сбросить историю.");
  }
});
