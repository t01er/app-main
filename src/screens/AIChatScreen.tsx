import { useEffect, useRef, useState } from "react";
import {
   ActivityIndicator,
   Image,
   KeyboardAvoidingView,
   Platform,
   Pressable,
   ScrollView,
   StatusBar,
   Text,
   TextInput,
   View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowUp, Camera, CircleHelp, ImagePlus, Plus, Sparkles, X } from "lucide-react-native";
import CameraCaptureModal from "@/components/CameraCaptureModal";
import { sendChatMessage } from "@/services/api/chat.service";

type Message = {
   id: number;
   role: "assistant" | "user";
   text: string;
   imageUri?: string;
   image?: { base64: string; mimeType: string };
};

type AttachedImage = { uri: string; base64: string; mimeType: string };

const suggestions = ["Mi computadora no enciende, ¿qué reviso?", "Ayúdame a interpretar un error", "¿Qué datos necesitas para diagnosticar mi equipo?"];

export default function AIChatScreen() {
   const insets = useSafeAreaInsets();
   const scrollRef = useRef<ScrollView>(null);
   const [draft, setDraft] = useState("");
   const [cameraVisible, setCameraVisible] = useState(false);
   const [pendingImage, setPendingImage] = useState<AttachedImage | null>(null);
   const [isSending, setIsSending] = useState(false);
   const [error, setError] = useState("");
   const [messages, setMessages] = useState<Message[]>([
      {
         id: 1,
         role: "assistant",
         text: "Hola. Soy tu asistente. Puedo ayudarte con ideas, preguntas o una imagen. ¿Por dónde empezamos?",
      },
   ]);

   useEffect(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
   }, [messages]);

   const sendMessage = async (value = draft) => {
      const text = value.trim() || (pendingImage ? "Analiza esta imagen y ayúdame a diagnosticar el problema." : "");
      if (!text || isSending) return;

      const userMessage: Message = {
         id: Date.now(),
         role: "user",
         text,
         imageUri: pendingImage?.uri,
         image: pendingImage ? { base64: pendingImage.base64, mimeType: pendingImage.mimeType } : undefined,
      };
      const conversation = [...messages, userMessage].slice(-12).map(({ role, text: messageText, image }) => ({
         role,
         text: messageText,
         image,
      }));
      setMessages((current) => [...current, userMessage]);
      setDraft("");
      setPendingImage(null);
      setError("");
      setIsSending(true);

      try {
         const reply = await sendChatMessage(conversation);
         setMessages((current) => [...current, { id: Date.now() + 1, role: "assistant", text: reply }]);
      } catch (sendError) {
         setError(sendError instanceof Error ? sendError.message : "No se pudo obtener una respuesta.");
      } finally {
         setIsSending(false);
      }
   };

   const handleCapture = (image: AttachedImage) => {
      setPendingImage(image);
      setError("");
   };

   const chooseImage = async () => {
      try {
         const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.75,
         });
         if (result.canceled) return;
         const asset = result.assets[0];
         if (!asset?.base64) {
            setError("No se pudo leer esa imagen. Prueba con otra foto o captura.");
            return;
         }
         setPendingImage({ uri: asset.uri, base64: asset.base64, mimeType: "image/jpeg" });
         setError("");
      } catch {
         setError("No se pudo abrir la galería de imágenes.");
      }
   };

   return (
      <View style={{ flex: 1, backgroundColor: "#F2F2F1" }}>
         <StatusBar barStyle="dark-content" backgroundColor="#F8F8F7" />
         <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <View style={styles.headerRow}>
               <View style={styles.brandMark}>
                  <Sparkles size={19} color="#292928" strokeWidth={2.4} />
               </View>
               <View style={{ flex: 1 }}>
                  <Text style={styles.brand}>LUMA</Text>
                  <Text style={styles.headerCaption}>DIAGNÓSTICO DE REPARACIONES</Text>
               </View>
               <Pressable accessibilityLabel="Ayuda" style={styles.headerAction}>
                  <CircleHelp size={20} color="#4A4A49" />
               </Pressable>
            </View>
           
         </View>

         <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
         >
            <ScrollView
               ref={scrollRef}
               contentContainerStyle={styles.conversation}
               keyboardShouldPersistTaps="handled"
               showsVerticalScrollIndicator={false}
            >
               <Text style={styles.dateLabel}>HOY</Text>
               {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                     <View key={message.id} style={[styles.messageRow, isUser && styles.userMessageRow]}>
                        {!isUser && (
                           <View style={styles.assistantMark}>
                              <Sparkles size={15} color="#3B3B3A" strokeWidth={2.3} />
                           </View>
                        )}
                        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                           {message.imageUri && <Image source={{ uri: message.imageUri }} style={styles.messageImage} />}
                           <Text style={[styles.messageText, isUser && styles.userMessageText]}>{message.text}</Text>
                        </View>
                     </View>
                  );
               })}

               {isSending && (
                  <View style={styles.messageRow}>
                     <View style={styles.assistantMark}>
                        <ActivityIndicator size="small" color="#3B3B3A" />
                     </View>
                     <View style={[styles.messageBubble, styles.assistantBubble]}>
                        <Text style={styles.messageText}>Pensando...</Text>
                     </View>
                  </View>
               )}
               {!!error && <Text style={styles.errorText}>{error}</Text>}

               {messages.length === 1 && (
                  <View style={styles.suggestionBlock}>
                     <Text style={styles.suggestionTitle}>PUEDES PREGUNTARME</Text>
                     <View style={styles.suggestions}>
                        {suggestions.map((suggestion) => (
                           <Pressable key={suggestion} onPress={() => void sendMessage(suggestion)} style={styles.suggestion}>
                              <Text style={styles.suggestionText}>{suggestion}</Text>
                              <Text style={styles.suggestionArrow}>↗</Text>
                           </Pressable>
                        ))}
                     </View>
                  </View>
               )}
            </ScrollView>

            <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
               {pendingImage && (
                  <View style={styles.attachmentPreview}>
                     <Image source={{ uri: pendingImage.uri }} style={styles.attachmentThumbnail} />
                     <Text style={styles.attachmentLabel}>Imagen lista. Escribe qué necesitas diagnosticar.</Text>
                     <Pressable onPress={() => setPendingImage(null)} accessibilityLabel="Quitar imagen" style={styles.removeAttachment}>
                        <X size={17} color="#455249" />
                     </Pressable>
                  </View>
               )}
               <View style={styles.composer}>
                  <Pressable
                     onPress={() => setCameraVisible(true)}
                     accessibilityLabel="Abrir camara"
                     disabled={isSending}
                     style={styles.cameraButton}
                  >
                     <Camera size={20} color="#555554" strokeWidth={2} />
                  </Pressable>
                  <Pressable
                     onPress={() => void chooseImage()}
                     accessibilityLabel="Elegir foto o captura"
                     disabled={isSending}
                     style={styles.galleryButton}
                  >
                     <ImagePlus size={20} color="#555554" strokeWidth={2} />
                  </Pressable>
                  <TextInput
                     value={draft}
                     onChangeText={setDraft}
                     onSubmitEditing={() => void sendMessage()}
                     placeholder="Describe el problema..."
                     placeholderTextColor="#89938B"
                     returnKeyType="send"
                     style={styles.input}
                  />
                  <Pressable
                     onPress={() => sendMessage()}
                     accessibilityLabel="Enviar mensaje"
                     disabled={(!draft.trim() && !pendingImage) || isSending}
                     style={[styles.sendButton, ((!draft.trim() && !pendingImage) || isSending) && styles.sendButtonDisabled]}
                  >
                     {draft.trim() || pendingImage ? <ArrowUp size={20} color="#FFFFFF" strokeWidth={2.5} /> : <Plus size={20} color="#FFFFFF" />}
                  </Pressable>
               </View>
            </View>
         </KeyboardAvoidingView>

         <CameraCaptureModal
            visible={cameraVisible}
            onClose={() => setCameraVisible(false)}
            onCaptured={handleCapture}
            title="Tomar una foto"
         />
      </View>
   );
}

const styles = {
   header: {
      backgroundColor: "#F8F8F7",
      paddingHorizontal: 22,
      paddingBottom: 17,
   },
   headerRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 12 },
   brandMark: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: "#E8E8E7",
      alignItems: "center" as const,
      justifyContent: "center" as const,
   },
   brand: { color: "#252524", fontSize: 15, fontWeight: "800" as const, letterSpacing: 1 },
   headerCaption: { color: "#777776", fontSize: 9, fontWeight: "700" as const, marginTop: 2 },
   headerAction: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: "#DEDEDD",
      alignItems: "center" as const,
      justifyContent: "center" as const,
   },
   headerDivider: { height: 1, backgroundColor: "#E3E3E2", marginTop: 17, marginBottom: 12 },
   statusRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7 },
   statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4B4B49" },
   statusText: { color: "#454544", fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.8 },
   demoLabel: { marginLeft: "auto" as const, color: "#858584", fontSize: 8, fontWeight: "700" as const, letterSpacing: 0.5 },
   conversation: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 18, flexGrow: 1 },
   dateLabel: { alignSelf: "center" as const, color: "#898988", fontSize: 9, fontWeight: "700" as const, letterSpacing: 1, marginBottom: 20 },
   messageRow: { flexDirection: "row" as const, alignItems: "flex-end" as const, gap: 8, marginBottom: 14 },
   userMessageRow: { justifyContent: "flex-end" as const },
   assistantMark: {
      width: 28,
      height: 28,
      borderRadius: 10,
      backgroundColor: "#E9E9E8",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      marginBottom: 2,
   },
   messageBubble: { maxWidth: "82%" as const, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18 },
   assistantBubble: { backgroundColor: "transparent", borderBottomLeftRadius: 5 },
   userBubble: { backgroundColor: "#E7E7E6", borderBottomRightRadius: 5 },
   messageText: { color: "#30302F", fontSize: 14, lineHeight: 21 },
   errorText: { color: "#A63D32", fontSize: 12, lineHeight: 18, marginLeft: 36, marginBottom: 14 },
   userMessageText: { color: "#272726" },
   messageImage: { width: 190, height: 170, borderRadius: 12, marginBottom: 9, backgroundColor: "#E5E5E4" },
   suggestionBlock: { marginTop: 15, marginLeft: 36 },
   suggestionTitle: { color: "#777776", fontSize: 9, fontWeight: "800" as const, letterSpacing: 1, marginBottom: 10 },
   suggestions: { gap: 8 },
   suggestion: {
      minHeight: 43,
      borderWidth: 1,
      borderColor: "#E1E1E0",
      borderRadius: 12,
      backgroundColor: "#FAFAF9",
      paddingHorizontal: 13,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
   },
   suggestionText: { color: "#414140", fontSize: 12, fontWeight: "600" as const },
   suggestionArrow: { color: "#656564", fontSize: 16 },
   composerArea: { backgroundColor: "#F2F2F1", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E2E2E1" },
   composer: {
      minHeight: 56,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 7,
      borderRadius: 17,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#DFDFDE",
   },
   cameraButton: { width: 40, height: 42, alignItems: "center" as const, justifyContent: "center" as const },
   galleryButton: { width: 36, height: 42, alignItems: "center" as const, justifyContent: "center" as const },
   attachmentPreview: {
      minHeight: 58,
      marginBottom: 8,
      padding: 7,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E0E0DF",
   },
   attachmentThumbnail: { width: 44, height: 44, borderRadius: 7, backgroundColor: "#E5E5E4" },
   attachmentLabel: { flex: 1, color: "#414140", fontSize: 11, lineHeight: 16 },
   removeAttachment: { width: 34, height: 34, alignItems: "center" as const, justifyContent: "center" as const },
   input: { flex: 1, minHeight: 46, color: "#292928", fontSize: 14, paddingHorizontal: 6, paddingVertical: 10 },
   sendButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor: "#333332",
      alignItems: "center" as const,
      justifyContent: "center" as const,
   },
   sendButtonDisabled: { backgroundColor: "#C9C9C8" },
   disclaimer: { color: "#858584", fontSize: 8, fontWeight: "700" as const, letterSpacing: 0.75, textAlign: "center" as const, marginTop: 9 },
};