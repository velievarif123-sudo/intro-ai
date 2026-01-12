// server.js
// Сервер-прокси: принимает вопрос от фронтенда -> отправляет в Ollama -> возвращает ответ.
// + история чата по sessionId (в памяти)
// + базовая обработка ошибок

import express from "express";

const app = express();
const PORT = 3000;

// Ollama API (локально)
const OLLAMA_URL = "http://localhost:11434/api/chat";
const DEFAULT_MODEL = "llama3.1";

// Хранилище чатов в памяти: { sessionId: [ {role, content}, ... ] }
const chats = new Map();

app.use(express.json());
app.use(express.static("public"));

function getOrCreateChat(sessionId) {
  if (!chats.has(sessionId)) chats.set(sessionId, []);
  return chats.get(sessionId);
}

app.post("/api/ask", async (req, res) => {
  try {
    const {
      question,
      sessionId,
      model = DEFAULT_MODEL,
      temperature = 0.7,
      maxTokens = 512,
      keepHistory = true,
    } = req.body ?? {};

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Поле question обязательно (строка)." });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Поле sessionId обязательно (строка)." });
    }

    const history = keepHistory ? getOrCreateChat(sessionId) : [];

    // Добавляем вопрос пользователя в историю (если история включена)
    if (keepHistory) {
      history.push({ role: "user", content: question });
    }

    // Формируем запрос в Ollama
    const payload = {
      model,
      messages: keepHistory
        ? history
        : [{ role: "user", content: question }],
      stream: false,
      options: {
        temperature: Number(temperature),
        num_predict: Number(maxTokens), // максимальная длина ответа (в токенах/предиктах)
      },
    };

    // Запрос к Ollama
    const resp = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return res.status(502).json({
        error: "Ollama API вернул ошибку.",
        details: `HTTP ${resp.status}: ${text}`.slice(0, 800),
      });
    }

    const data = await resp.json();

    const answer = data?.message?.content ?? "";
    if (!answer) {
      return res.status(502).json({
        error: "Пустой ответ от модели.",
        details: JSON.stringify(data).slice(0, 800),
      });
    }

    // Добавляем ответ ассистента в историю
    if (keepHistory) {
      history.push({ role: "assistant", content: answer });
    }

    res.json({
      answer,
      usedModel: model,
      temperature: Number(temperature),
      maxTokens: Number(maxTokens),
      historySize: keepHistory ? history.length : 0,
    });
  } catch (e) {
    // Типовая ошибка: Ollama не запущена / порт недоступен / CORS не при чем, мы в бэкенде
    res.status(500).json({
      error: "Ошибка на сервере.",
      details: String(e?.message ?? e),
      hint:
        "Проверь, что Ollama запущена и доступна на http://localhost:11434 (и модель скачана).",
    });
  }
});

app.post("/api/reset", (req, res) => {
  const { sessionId } = req.body ?? {};
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({ error: "Поле sessionId обязательно (строка)." });
  }
  chats.delete(sessionId);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server started: http://localhost:${PORT}`);
});
