# Luma Reparaciones

App móvil con un **asistente de IA para diagnosticar reparaciones** de computadoras, teléfonos, impresoras, redes y software.
El usuario describe el problema (o manda una foto del equipo o de un error) y la IA le responde con pasos ordenados y seguros.

---

## ¿Qué tiene la app?

- **Chat con IA**: escribes tu problema y la IA responde en español.
- **Fotos con la cámara**: tomas una foto desde el chat (con linterna, vista previa y opción de repetir).
- **Fotos de la galería**: puedes adjuntar una captura o imagen que ya tengas.
- **Sugerencias rápidas**: al abrir el chat aparecen preguntas de ejemplo que se envían con un toque.
- **IA enfocada en reparaciones**: si le preguntas algo que no es soporte técnico (recetas, etc.), te dice amablemente que solo ayuda con equipos y software.
- **Dos proveedores de IA**: el servidor puede usar **Claude** (Anthropic) o **Gemini** (Google). Se elige con una variable de entorno.
- **Mensajes de error claros**: si falla la conexión, la API key o el modelo, la app muestra qué revisar.

---

## ¿Cómo está hecho?

El proyecto tiene **dos partes**:

```
  App (Expo / React Native)  ──POST /api/chat──▶  🖥️ Servidor (Node + Express)  ──▶  🤖 Claude o Gemini
```

1. **La app** muestra el chat, toma fotos y manda la conversación al servidor.
2. **El servidor** recibe los mensajes, los valida, le agrega las instrucciones del asistente y se los pasa a la IA.

¿Por qué un servidor en medio? Para que las **API keys nunca estén dentro de la app**. Si estuvieran en el celular, cualquiera podría sacarlas.

### Tecnologías

| Parte    | Qué se usa |
|----------|------------|
| App      | Expo, React Native, TypeScript, NativeWind (Tailwind), lucide (íconos), expo-camera, expo-image-picker |
| Servidor | Node.js 20+, Express, SDK de Anthropic, SDK de Google GenAI |

---

## Estructura de carpetas

```
├── App.tsx                         # Punto de entrada: carga la pantalla del chat
├── index.ts                        # Registra la app en Expo
├── app.json                        # Configuración de Expo (nombre, ícono, permisos de cámara)
├── eas.json                        # Configuración para compilar con EAS Build
├── tailwind.config.js              # Colores y configuración de Tailwind/NativeWind
├── .env                            # URL del servidor (EXPO_PUBLIC_API_URL)
│
├── src/
│   ├── screens/
│   │   └── AIChatScreen.tsx        # Pantalla principal: chat, mensajes, botones de foto
│   ├── components/
│   │   └── CameraCaptureModal.tsx  # Modal de la cámara (tomar foto, linterna, confirmar)
│   ├── services/api/
│   │   └── chat.service.ts         # Hace la petición al servidor (fetch a /api/chat)
│   ├── constants/
│   │   └── colors.js               # Paleta de colores de la app
│   └── types/                      # Tipos extra para TypeScript
│
├── server/
│   ├── index.js                    # Servidor Express con la ruta POST /api/chat
│   └── .env                        # API keys y elección de IA (no se sube a git)
│
└── assets/                         # Íconos y splash de la app
```

### Cómo viaja un mensaje

1. En `AIChatScreen.tsx` escribes un texto y/o adjuntas una foto.
2. Se toman los **últimos 12 mensajes** de la conversación (las fotos van en base64).
3. `chat.service.ts` los manda a `EXPO_PUBLIC_API_URL/api/chat`.
4. `server/index.js` revisa que los datos sean válidos (máx. 40 mensajes, imágenes JPG/PNG/WEBP).
5. El servidor llama a Claude o Gemini con el *prompt* del asistente de reparaciones.
6. La respuesta vuelve como `{ "text": "..." }` y aparece en el chat.

---

## Cómo correr el proyecto

### 1. Servidor

```bash
cd server
npm install
```

Crea `server/.env`:

```env
# "claude" o "gemini"
AI_PROVIDER=claude

# Si usas Claude
ANTHROPIC_API_KEY=tu_api_key
CLAUDE_MODEL=claude-opus-5-5
CLAUDE_EFFORT=low

# Si usas Gemini
GEMINI_API_KEY=tu_api_key
GEMINI_MODEL=gemini-3.8-flash

PORT=3001
```

Inícialo:

```bash
npm run dev     # se reinicia solo al guardar cambios
# o
npm start
```

### 2. App

En la carpeta raíz:

```bash
npm install
```

Crea `.env` con la **IP de tu computadora** (no `localhost`, porque el celular no la reconoce):

```env
EXPO_PUBLIC_API_URL=http://192.168.X.X:3001
```

Inicia la app:

```bash
npm start          # abre Expo; escanea el QR con Expo Go
npm run android    # compila y abre en Android
npm run ios        # compila y abre en iOS
npm run web        # versión web
```

> El celular y la computadora deben estar en la **misma red Wi-Fi**.

### Revisar tipos

```bash
npm run type-check
```

---

## Problemas comunes

| Mensaje | Qué hacer |
|---------|-----------|
| "Configura EXPO_PUBLIC_API_URL..." | Falta el `.env` de la app. Créalo y reinicia Expo. |
| "No se pudo conectar al servidor..." | El servidor no está corriendo, o la URL usa `localhost` en vez de tu IP. |
| "...rechazó la API key" | Revisa la key en `server/.env` y reinicia el servidor. |
| "El modelo configurado no está disponible" | Revisa `CLAUDE_MODEL` o `GEMINI_MODEL`. |
| "Se alcanzó el límite de uso" | Se acabó la cuota de tu cuenta de IA; espera o revisa tu plan. |
