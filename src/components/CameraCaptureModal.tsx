// src/components/CameraCaptureModal.tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Modal, Pressable, Image, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Check, RotateCcw, Zap } from "lucide-react-native";
import colors from "@/constants/colors";

type Props = {
   visible: boolean;
   onClose: () => void;
   onCaptured: (image: { uri: string; base64: string; mimeType: string }) => void;
   title?: string;
};

export default function CameraCaptureModal({ visible, onClose, onCaptured, title = "Tomar foto" }: Props) {
   const insets = useSafeAreaInsets();
   const cameraRef = useRef<CameraView>(null);
   const [permission, requestPermission] = useCameraPermissions();
   const [previewUri, setPreviewUri] = useState<string | null>(null);
   const [previewBase64, setPreviewBase64] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [torch, setTorch] = useState(false);

   useEffect(() => {
      if (!visible) {
         setPreviewUri(null);
         setPreviewBase64(null);
         setTorch(false);
      }
   }, [visible]);

   useEffect(() => {
      if (visible && permission && !permission.granted && permission.canAskAgain) {
         requestPermission();
      }
   }, [visible, permission, requestPermission]);

   const handleShutter = async () => {
      if (!cameraRef.current || busy) return;
      setBusy(true);
      try {
         const photo = await cameraRef.current.takePictureAsync({
            quality: 0.8,
            base64: true,
            skipProcessing: false,
         });
         if (photo?.uri && photo.base64) {
            setPreviewUri(photo.uri);
            setPreviewBase64(photo.base64);
         }
      } catch (e) {
         console.warn("[camera] takePicture failed:", e);
      } finally {
         setBusy(false);
      }
   };

   const handleConfirm = () => {
      if (previewUri && previewBase64) {
         onCaptured({ uri: previewUri, base64: previewBase64, mimeType: "image/jpeg" });
         onClose();
      }
   };

   const renderBody = () => {
      if (!permission) {
         return (
            <View className="flex-1 items-center justify-center">
               <ActivityIndicator color={colors.white} />
            </View>
         );
      }

      if (!permission.granted) {
         return (
            <View className="flex-1 items-center justify-center px-8">
               <Text className="text-white text-base font-semibold text-center mb-2">Permiso de cámara requerido</Text>
               <Text className="text-white/70 text-sm text-center mb-6">
                  Necesitamos acceso a la cámara para tomar una foto.
               </Text>
               {permission.canAskAgain ? (
                  <Pressable
                     onPress={requestPermission}
                     className="px-6 py-3 rounded-xl"
                     style={{ backgroundColor: colors.primary500 }}
                  >
                     <Text className="text-white font-semibold">Otorgar permiso</Text>
                  </Pressable>
               ) : (
                  <Text className="text-white/70 text-xs text-center">Actívalo en los ajustes del sistema.</Text>
               )}
            </View>
         );
      }

      if (previewUri) {
         return <Image source={{ uri: previewUri }} style={{ flex: 1 }} resizeMode="contain" />;
      }

      return <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" enableTorch={torch} />;
   };

   const isPreview = !!previewUri;

   return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
         <View style={{ flex: 1, backgroundColor: "#000" }}>
            {renderBody()}

            {/* Header */}
            <View
               style={{ position: "absolute", top: insets.top + 12, left: 16, right: 16 }}
               className="flex-row items-center justify-between"
               pointerEvents="box-none"
            >
               <Pressable
                  onPress={onClose}
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                  hitSlop={8}
               >
                  <X size={20} color="#fff" />
               </Pressable>
               <Text className="text-white text-base font-semibold">{isPreview ? "Vista previa" : title}</Text>
               {!isPreview ? (
                  <Pressable
                     onPress={() => setTorch((t) => !t)}
                     className="w-10 h-10 rounded-full items-center justify-center"
                     style={{ backgroundColor: torch ? colors.primary500 : "rgba(0,0,0,0.5)" }}
                     hitSlop={8}
                  >
                     <Zap size={20} color="#fff" fill={torch ? "#fff" : "transparent"} />
                  </Pressable>
               ) : (
                  <View style={{ width: 40 }} />
               )}
            </View>

            {/* Bottom controls */}
            <View
               style={{ position: "absolute", bottom: insets.bottom + 32, left: 0, right: 0 }}
               className="flex-row items-center justify-center gap-8"
            >
               {isPreview ? (
                  <>
                     <Pressable
                        onPress={() => setPreviewUri(null)}
                        className="w-16 h-16 rounded-full items-center justify-center bg-white/15"
                     >
                        <RotateCcw size={24} color="#fff" />
                     </Pressable>
                     <Pressable
                        onPress={handleConfirm}
                        className="w-20 h-20 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.success }}
                     >
                        <Check size={32} color="#fff" strokeWidth={3} />
                     </Pressable>
                  </>
               ) : (
                  <Pressable
                     onPress={handleShutter}
                     disabled={busy}
                     className="w-20 h-20 rounded-full items-center justify-center"
                     style={{
                        backgroundColor: busy ? "rgba(255,255,255,0.3)" : "#fff",
                        borderWidth: 4,
                        borderColor: "rgba(255,255,255,0.4)",
                     }}
                  >
                     {busy ? <ActivityIndicator color={colors.gray600} /> : null}
                  </Pressable>
               )}
            </View>
         </View>
      </Modal>
   );
}
