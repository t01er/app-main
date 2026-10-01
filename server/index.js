import "dotenv/config";
import cors from "cors";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const {
   AI_PROVIDER = "claude",
   ANTHROPIC_API_KEY,
   CLAUDE_MODEL = "claude-opus-5-5",
   CLAUDE_EFFORT = "low",
   GEMINI_API_KEY,
   GEMINI_MODEL = "gemini-3.8-flash",
   PORT = 3001,
} = process.env;

const provider = AI_PROVIDER.toLowerCase();
if (!["claude", "gemini"].includes(provider)) {
   console.error(`AI_PROVIDER inválido: "${AI_PROVIDER}". Usa "claude" o "gemini" en server/.env.`);
   process.exit(1);
}
if (provider === "claude" && !ANTHROPIC_API_KEY) {
   console.error("Falta ANTHROPIC_API_KEY. Configúrala en server/.env.");
   process.exit(1);
}
if (provider === "gemini" && !GEMINI_API_KEY) {
   console.error("Falta GEMINI_API_KEY. Configúrala en server/.env.");
   process.exit(1);
}

const providerName = provider === "claude" ? "Claude" : "Gemini";
const claude = provider === "claude" ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const gemini = provider === "gemini" ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const SYSTEM_PROMPT = `Eres el asistente de soporte tecnico de una tienda de reparacion. Tu tema se limita a diagnostico, reparacion y mantenimiento de computadoras, telefonos, impresoras, redes, componentes y software, incluyendo la interpretacion de fotos y capturas de errores. Si te preguntan algo fuera de esos temas (por ejemplo recetas, entretenimiento o consejos generales), no respondas la pregunta: explica amablemente que solo puedes ayudar con soporte tecnico de equipos y software, e invita a consultar sobre una reparacion. Analiza las imagenes con cuidado: describe primero lo que realmente se ve, transcribe los mensajes de error relevantes y separa hechos de hipotesis. Da pasos ordenados, seguros y faciles de comprobar; empieza por las pruebas menos riesgosas. Antes de recomendar abrir un equipo, desconectar componentes, borrar datos, actualizar firmware o trabajar con electricidad, advierte sobre riesgos, garantia, copias de seguridad y cuando debe hacerlo un tecnico. No inventes modelos, codigos ni causas. Si falta informacion, pregunta por marca/modelo, sistema operativo, sintomas y cambios recientes. No afirmes que el equipo esta reparado sin una prueba. Responde en espanol claro y conciso.`;

class ProviderError extends Error {
   constructor(message, httpStatus = 502) {
      super(message);
      this.httpStatus = httpStatus;
   }
}


async function askClaude(messages) {
   const firstUser = messages.findIndex((message) => message.role === "user");
   const history = firstUser === -1 ? [] : messages.slice(firstUser);
   if (history.length === 0) {
      throw new ProviderError("El historial debe incluir al menos un mensaje del usuario.", 400);
   }

   const response = await claude.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { effort: CLAUDE_EFFORT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: history.map((message) => ({
         role: message.role,
         content: [
            ...(message.image
               ? [{ type: "image", source: { type: "base64", media_type: message.image.mimeType, data: message.image.base64 } }]
               : []),
            ...(message.text.trim() ? [{ type: "text", text: message.text.trim() }] : []),
         ],
      })),
   });

   if (response.stop_reason === "refusal") {
      throw new ProviderError("Claude no puede responder esa consulta. Intenta reformularla.");
   }

   return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
}

function getClaudeErrorMessage(error) {
   if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return "Anthropic rechazó la API key. Revisa ANTHROPIC_API_KEY en server/.env y reinicia el servidor.";
   }
   if (error instanceof Anthropic.RateLimitError) {
      return "Se alcanzó el límite de uso de Claude. Revisa los límites de tu cuenta o inténtalo más tarde.";
   }
   if (error instanceof Anthropic.NotFoundError) {
      return "El modelo configurado no está disponible. Revisa CLAUDE_MODEL en server/.env.";
   }
   if (error instanceof Anthropic.BadRequestError) {
      return "Claude rechazó el formato de la solicitud o la imagen. Prueba con una imagen más pequeña o revisa los registros del servidor.";
   }
   if (error instanceof Anthropic.APIConnectionError) {
      return "No se pudo conectar con Claude. Revisa la conexión a internet del servidor.";
   }
   if (error instanceof Anthropic.APIError && (error.status === 529 || error.status >= 500)) {
      return "Claude está temporalmente saturado o no disponible. Espera unos segundos y vuelve a intentarlo.";
   }
   if (error instanceof Anthropic.APIError && error.status) {
      return `Claude devolvió el error ${error.status}. Revisa los registros del servidor para ver el detalle.`;
   }
   return "Claude no pudo responder en este momento. Intenta de nuevo.";
}


function getGeminiErrorInfo(error) {
   let payload;
   for (const value of [error?.details, error?.message, error?.error]) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
         payload = value;
         break;
      }
      if (typeof value === "string") {
         try {
            payload = JSON.parse(value);
            break;
         } catch {
            continue;
         }
      }
   }

   const providerError = payload?.error ?? payload ?? {};
   return {
      status: Number(error?.status ?? providerError.code ?? error?.code) || 0,
      reason: String(providerError.status ?? error?.reason ?? ""),
      message: String(providerError.message ?? error?.message ?? error),
   };
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function generateContentWithRetry(request) {
   for (let attempt = 0; ; attempt += 1) {
      try {
         return await gemini.models.generateContent(request);
      } catch (error) {
         const { status, reason } = getGeminiErrorInfo(error);
         const isTransient = [408, 500, 502, 503, 504].includes(status) ||
            ["UNAVAILABLE", "INTERNAL", "DEADLINE_EXCEEDED"].includes(reason);
         if (!isTransient || attempt >= 2) throw error;

         const delay = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
         console.warn(`Gemini devolvió ${status || reason}; reintentando en ${delay} ms (intento ${attempt + 2}/3).`);
         await wait(delay);
      }
   }
}

// Gemini tiende a extenderse, así que se le piden respuestas cortas para leer en el celular.
const GEMINI_STYLE = `Formato de respuesta: se breve y directo. Usa como maximo 3 a 5 frases o una lista corta de hasta 5 pasos de una linea cada uno. No repitas la pregunta, no hagas introducciones ni resumenes finales, y no uses titulos. Si el problema necesita mas pasos, da solo los primeros y ofrece continuar. Las advertencias de seguridad van en una sola frase.`;

async function askGemini(messages) {
   const result = await generateContentWithRetry({
      model: GEMINI_MODEL,
      contents: messages.map((message) => ({
         role: message.role === "assistant" ? "model" : "user",
         parts: [
            ...(message.text.trim() ? [{ text: message.text.trim() }] : []),
            ...(message.image
               ? [{ inlineData: { mimeType: message.image.mimeType, data: message.image.base64 } }]
               : []),
         ],
      })),
      config: { systemInstruction: `${SYSTEM_PROMPT}\n\n${GEMINI_STYLE}` },
   });
   return result.text?.trim();
}

function getGeminiErrorMessage(error) {
   const { status, reason, message: details } = getGeminiErrorInfo(error);
   if (status === 401 || status === 403 || reason === "API_KEY_INVALID" || /API_KEY_INVALID|api key not valid|invalid api key/i.test(details)) {
      return "Google rechazó la API key. Revisa GEMINI_API_KEY en server/.env y reinicia el servidor.";
   }
   if (status === 429 || reason === "RESOURCE_EXHAUSTED" || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(details)) {
      return "Se alcanzó el límite de uso de Gemini. Revisa la cuota del proyecto o inténtalo más tarde.";
   }
   if (status === 404 || reason === "NOT_FOUND" || /NOT_FOUND|model.*not found|not supported/i.test(details)) {
      return "El modelo configurado no está disponible. Revisa GEMINI_MODEL en server/.env.";
   }
   if (status === 400) {
      return "Gemini rechazó el formato de la solicitud o la imagen. Prueba con una imagen más pequeña o revisa los registros del servidor.";
   }
   if ([502, 503, 504].includes(status) || ["UNAVAILABLE", "DEADLINE_EXCEEDED"].includes(reason)) {
      return "Gemini está temporalmente saturado o no disponible. Espera unos segundos y vuelve a intentarlo.";
   }
   if (status) {
      return `Gemini devolvió el error ${status}. Revisa los registros del servidor para ver el detalle.`;
   }
   return "Gemini no pudo responder en este momento. Intenta de nuevo.";
}


app.post("/api/chat", async (req, res) => {
   const messages = req.body?.messages;
   if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 40 ||
      messages.some(
         (message) =>
            !["user", "assistant"].includes(message?.role) ||
            typeof message?.text !== "string" ||
            (!message.text.trim() && !message.image) ||
            (message.image &&
               (typeof message.image.base64 !== "string" ||
                  !["image/jpeg", "image/png", "image/webp"].includes(message.image.mimeType) ||
                  message.image.base64.length > 10_000_000)),
      )
   ) {
      return res.status(400).json({ error: "El historial de mensajes no es válido." });
   }

   try {
      const text = provider === "claude" ? await askClaude(messages) : await askGemini(messages);
      if (!text) {
         return res.status(502).json({ error: `${providerName} devolvió una respuesta vacía.` });
      }
      return res.json({ text });
   } catch (error) {
      if (error instanceof ProviderError) {
         return res.status(error.httpStatus).json({ error: error.message });
      }
      console.error(`Error al consultar ${providerName}:`, error?.status ?? "", error?.message ?? error);
      const message = provider === "claude" ? getClaudeErrorMessage(error) : getGeminiErrorMessage(error);
      return res.status(502).json({ error: message });
   }
});

app.listen(Number(PORT), "0.0.0.0", () => {
   console.log(`Servidor de IA (${providerName}) listo en el puerto ${PORT}`);
});
