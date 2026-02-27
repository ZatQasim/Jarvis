import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { JarvisRings } from "@/components/JarvisRings";
import { MessageBubble, TypingIndicator } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let msgCounter = 0;
function genId(): string {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

const STORAGE_KEY = "jarvis_conversations";

function ScanLine() {
  const translateY = useSharedValue(-10);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(600, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 500 }),
        withTiming(0.1, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.scanLineWrapper]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.scanLine, style]} />
    </Animated.View>
  );
}

function SpeakingWave() {
  const bars = [0, 1, 2, 3, 4, 5, 6];

  return (
    <View style={styles.waveContainer}>
      {bars.map((i) => (
        <AnimatedBar key={i} index={i} />
      ))}
    </View>
  );
}

function AnimatedBar({ index }: { index: number }) {
  const scaleY = useSharedValue(0.2);

  useEffect(() => {
    const delay = index * 80;
    const timer = setTimeout(() => {
      scaleY.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 + index * 40, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 300 + index * 40, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return <Animated.View style={[styles.waveBar, style]} />;
}

function BootScreen({ onComplete }: { onComplete: () => void }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  const [status, setStatus] = useState("INITIALIZING SYSTEMS...");

  const statusMessages = [
    "INITIALIZING SYSTEMS...",
    "LOADING NEURAL NETWORK...",
    "ESTABLISHING SECURE LINK...",
    "CALIBRATING VOICE MATRIX...",
    "JARVIS ONLINE.",
  ];

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600 });
    scale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) });

    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      if (idx < statusMessages.length) {
        setStatus(statusMessages[idx]);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (idx >= statusMessages.length - 1) {
        clearInterval(interval);
        setTimeout(() => {
          textOpacity.value = withTiming(0, { duration: 400 });
          opacity.value = withTiming(0, { duration: 600 });
          scale.value = withTiming(1.1, { duration: 600 });
          setTimeout(onComplete, 700);
        }, 600);
      }
    }, 550);

    return () => clearInterval(interval);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value === 0 ? opacity.value : textOpacity.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.bootContainer, containerStyle]}>
      <JarvisRings isThinking size={180} />
      <Animated.View style={[styles.bootText, textStyle]}>
        <Text style={styles.bootTitle}>J.A.R.V.I.S.</Text>
        <Text style={styles.bootSubtitle}>Just A Rather Very Intelligent System</Text>
        <View style={styles.bootStatusRow}>
          <View style={styles.bootStatusDot} />
          <Text style={styles.bootStatus}>{status}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function JarvisScreen() {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const stopCurrentAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setIsSpeaking(false);
  };

  const playJarvisVoice = useCallback(async (text: string) => {
    if (Platform.OS === "web") return;

    try {
      await stopCurrentAudio();

      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) return;

      const data = await response.json();
      if (!data.audio) return;

      const fileUri = FileSystem.cacheDirectory + "jarvis_voice.mp3";
      await FileSystem.writeAsStringAsync(fileUri, data.audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setIsSpeaking(true);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true, volume: 1.0 }
      );

      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e) {
      console.error("Voice playback error:", e);
      setIsSpeaking(false);
    }
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (isStreaming) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await stopCurrentAudio();

    const currentMessages = [...messages];
    const userMsg: Message = { id: genId(), role: "user", content: text };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setShowTyping(true);

    let fullContent = "";

    try {
      const baseUrl = getApiUrl();
      const chatHistory = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      const response = await fetch(`${baseUrl}api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No body");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              if (!assistantAdded) {
                setShowTyping(false);
                setMessages((prev) => [
                  ...prev,
                  { id: genId(), role: "assistant", content: fullContent },
                ]);
                assistantAdded = true;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullContent,
                  };
                  return updated;
                });
              }
            }
          } catch {}
        }
      }

      await saveConversation([...currentMessages, userMsg, { id: genId(), role: "assistant", content: fullContent }]);

      if (fullContent) {
        playJarvisVoice(fullContent);
      }
    } catch {
      setShowTyping(false);
      const errMsg = "I'm experiencing a temporary system disruption. Please try again, sir.";
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "assistant", content: errMsg },
      ]);
    } finally {
      setIsStreaming(false);
      setShowTyping(false);
    }
  }, [messages, isStreaming, playJarvisVoice]);

  const saveConversation = async (msgs: Message[]) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const preview = msgs.find((m) => m.role === "user")?.content || "Conversation";
      const newConv = {
        id: Date.now().toString(),
        preview: preview.slice(0, 60),
        date: new Date().toISOString(),
        messages: msgs,
      };
      const updated = [newConv, ...existing].slice(0, 50);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const clearChat = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopCurrentAudio();
    setMessages([]);
  };

  const reversedMessages = [...messages].reverse();
  const hasMessages = messages.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: Colors.jarvis.bg }]}>
      <StatusBar barStyle="light-content" />
      {booting ? (
        <BootScreen onComplete={() => setBooting(false)} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <View style={[styles.header, { paddingTop: topPad + 8 }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusDotLive, isSpeaking && styles.statusDotSpeaking]} />
              <Text style={styles.headerTitle}>J.A.R.V.I.S.</Text>
              {isSpeaking && <SpeakingWave />}
            </View>
            <View style={styles.headerRight}>
              {isSpeaking && (
                <Pressable
                  onPress={stopCurrentAudio}
                  style={({ pressed }) => [styles.headerBtn, styles.muteBtn, pressed && styles.headerBtnPressed]}
                >
                  <Feather name="volume-x" size={16} color={Colors.jarvis.cyan} />
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push("/history")}
                style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
              >
                <Feather name="clock" size={18} color={Colors.jarvis.blue} />
              </Pressable>
              {hasMessages && (
                <Pressable
                  onPress={clearChat}
                  style={({ pressed }) => [styles.headerBtn, pressed && styles.headerBtnPressed]}
                >
                  <Feather name="refresh-cw" size={18} color={Colors.jarvis.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {!hasMessages ? (
            <View style={styles.idleContainer}>
              <ScanLine />
              <JarvisRings isThinking={isStreaming} size={200} />
              <View style={styles.idleText}>
                <Text style={styles.idleTitle}>SYSTEMS ONLINE</Text>
                <Text style={styles.idleSubtitle}>How may I assist you, sir?</Text>
                <View style={styles.idleHints}>
                  {["Analyse a topic in depth", "Help me write or review code", "Answer a complex question"].map((hint) => (
                    <Pressable
                      key={hint}
                      onPress={() => handleSend(hint)}
                      style={({ pressed }) => [styles.hintChip, pressed && styles.hintChipPressed]}
                    >
                      <Text style={styles.hintText}>{hint}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <FlatList
              data={reversedMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              inverted={hasMessages}
              ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!!reversedMessages.length}
            />
          )}

          <View style={{ paddingBottom: bottomPad }}>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.jarvis.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.jarvis.cyan,
  },
  statusDotSpeaking: {
    backgroundColor: Colors.jarvis.blue,
  },
  headerTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 18,
    color: Colors.jarvis.blue,
    letterSpacing: 4,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    alignItems: "center",
    justifyContent: "center",
  },
  muteBtn: {
    borderColor: Colors.jarvis.dimLight,
    backgroundColor: "rgba(0, 212, 255, 0.08)",
  },
  headerBtnPressed: {
    opacity: 0.6,
  },
  idleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scanLineWrapper: {
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Colors.jarvis.blue,
    opacity: 0.3,
  },
  idleText: {
    alignItems: "center",
    marginTop: 32,
    gap: 8,
  },
  idleTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 14,
    color: Colors.jarvis.blue,
    letterSpacing: 4,
  },
  idleSubtitle: {
    fontFamily: "Exo2_300Light",
    fontSize: 16,
    color: Colors.jarvis.muted,
    letterSpacing: 1,
    marginTop: 4,
  },
  idleHints: {
    marginTop: 24,
    gap: 8,
    alignItems: "center",
  },
  hintChip: {
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hintChipPressed: {
    borderColor: Colors.jarvis.dimLight,
    backgroundColor: Colors.jarvis.bgSecondary,
  },
  hintText: {
    fontFamily: "Exo2_400Regular",
    fontSize: 13,
    color: Colors.jarvis.muted,
  },
  listContent: {
    paddingVertical: 12,
  },
  bootContainer: {
    backgroundColor: Colors.jarvis.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  bootText: {
    alignItems: "center",
    gap: 8,
    marginTop: 32,
  },
  bootTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 28,
    color: Colors.jarvis.blue,
    letterSpacing: 8,
  },
  bootSubtitle: {
    fontFamily: "Exo2_300Light",
    fontSize: 12,
    color: Colors.jarvis.dimLight,
    letterSpacing: 2,
  },
  bootStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  bootStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.jarvis.cyan,
  },
  bootStatus: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 11,
    color: Colors.jarvis.cyan,
    letterSpacing: 2,
  },
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 16,
  },
  waveBar: {
    width: 2.5,
    height: 14,
    borderRadius: 2,
    backgroundColor: Colors.jarvis.cyan,
  },
});
