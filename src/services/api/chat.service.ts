type ChatMessage = {
   role: "assistant" | "user";
   text: string;
   image?: { base64: string; mimeType: string };
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export async function sendChatMessage(messages: ChatMessage[]): Promise<string> {
   if (!apiUrl) {
      throw new Error("Configura EXPO_PUBLIC_API_URL en el archivo .env de la app.");
   }

   let response: Response;
   try {
      response = await fetch(`${apiUrl}/api/chat`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ messages }),
      });
   } catch {
      throw new Error("No se pudo conectar al servidor. Verifica que esté iniciado y que la URL use la IP de tu computadora.");
   }

   const result = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
   if (!response.ok) {
      throw new Error(result.error ?? "El servidor no pudo responder.");
   }
   if (!result.text) {
      throw new Error("La IA no devolvió una respuesta.");
   }

   return result.text;
}