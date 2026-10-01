import { SafeAreaProvider } from "react-native-safe-area-context";
import AIChatScreen from "@/screens/AIChatScreen";
import "./global.css";

export default function App() {
   return (
      <SafeAreaProvider>
         <AIChatScreen />
      </SafeAreaProvider>
   );
}
