import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
  StatusBar,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { router } from "expo-router";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
} from "expo-audio";
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

type VoiceState = "idle" | "listening" | "processing" | "speaking";
type AppMode = "voice" | "text";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConvTurn {
  id: string;
  user: string;
  jarvis: string;
}

let msgCounter = 0;
function genId(): string {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}`;
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
    <Animated.View style={[StyleSheet.absoluteFill, styles.scanLineWrapper]}>
      <Animated.View style={[styles.scanLine, style]} />
    </Animated.View>
  );
}

function AnimatedBar({ index }: { index: number }) {
  const scaleY = useSharedValue(0.2);

  useEffect(() => {
    const timer = setTimeout(() => {
      scaleY.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 + index * 40, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 300 + index * 40, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, index * 80);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scaleY.value }] }));
  return <Animated.View style={[styles.waveBar, style]} />;
}

function SpeakingWave() {
  return (
    <View style={styles.waveContainer}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <AnimatedBar key={i} index={i} />
      ))}
    </View>
  );
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

function MicButton({
  voiceState,
  onPress,
}: {
  voiceState: VoiceState;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (voiceState === "listening") {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 400 }),
          withTiming(0.15, { duration: 400 })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [voiceState]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const color = {
    idle: Colors.jarvis.blue,
    listening: "#FF4444",
    processing: Colors.jarvis.muted,
    speaking: Colors.jarvis.cyan,
  }[voiceState];

  const iconName = {
    idle: "mic",
    listening: "square",
    processing: "loader",
    speaking: "volume-2",
  }[voiceState] as any;

  const isDisabled = voiceState === "processing" || voiceState === "speaking";

  return (
    <Pressable onPress={onPress} disabled={isDisabled} testID="mic-button">
      <Animated.View style={animStyle}>
        <Animated.View
          style={[
            styles.micGlow,
            { backgroundColor: color },
            glowStyle,
          ]}
        />
        <View
          style={[
            styles.micButton,
            {
              borderColor: color,
              backgroundColor: `${color}18`,
              opacity: isDisabled ? 0.5 : 1,
            },
          ]}
        >
          <Feather name={iconName} size={34} color={color} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

function TranscriptPanel({
  visible,
  turns,
  onClose,
  bottomPad,
}: {
  visible: boolean;
  turns: ConvTurn[];
  onClose: () => void;
  bottomPad: number;
}) {
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "box-none" }]}>
      <Pressable style={styles.transcriptBackdrop} onPress={onClose} />
      <View style={[styles.transcriptSheet, { paddingBottom: bottomPad + 8 }]}>
        <View style={styles.transcriptHandle} />
        <View style={styles.transcriptHeader}>
          <Text style={styles.transcriptTitle}>TRANSCRIPT</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.transcriptClose, pressed && { opacity: 0.6 }]}
          >
            <Feather name="x" size={20} color={Colors.jarvis.muted} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.transcriptScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
        >
          {turns.length === 0 ? (
            <Text style={styles.transcriptEmpty}>No conversation yet.</Text>
          ) : (
            turns.map((turn) => (
              <View key={turn.id} style={styles.transcriptTurn}>
                <View style={styles.transcriptUserRow}>
                  <Text style={styles.transcriptLabel}>YOU</Text>
                  <Text style={styles.transcriptUserText}>{turn.user}</Text>
                </View>
                <View style={styles.transcriptJarvisRow}>
                  <Text style={[styles.transcriptLabel, { color: Colors.jarvis.blue }]}>JARVIS</Text>
                  <Text style={styles.transcriptJarvisText}>{turn.jarvis}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

export default function JarvisScreen() {
  const insets = useSafeAreaInsets();
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<AppMode>(Platform.OS === "web" ? "text" : "voice");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [showTranscript, setShowTranscript] = useState(false);
  const [convTurns, setConvTurns] = useState<ConvTurn[]>([]);
  const [textMessages, setTextMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const convHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const audioFileRef = useRef<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    AudioModule.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
    });
  }, []);

  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setVoiceState("idle");
    }
  }, [playerStatus.didJustFinish]);

  const stopAudio = useCallback(() => {
    try {
      player.pause();
    } catch {}
    setVoiceState("idle");
  }, [player]);

  const playAudioBase64 = useCallback(
    async (audioBase64: string) => {
      if (Platform.OS === "web") {
        setVoiceState("idle");
        return;
      }
      try {
        const fileUri = `${FileSystem.cacheDirectory}jarvis_resp_${Date.now()}.mp3`;
        
        // UPDATE: Using new SDK 54 File API
        const file = new FileSystem.File(fileUri);
        await file.write(audioBase64, { encoding: 'base64' });

        audioFileRef.current = fileUri;
        await AudioModule.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          shouldDuckAndroid: false,
        });
        player.replace({ uri: fileUri });
        player.play();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setVoiceState("speaking");
      } catch (e) {
        console.error("Audio playback error:", e);
        setVoiceState("idle");
      }
    },
    [player]
  );

  const saveConversation = useCallback(async (turns: ConvTurn[]) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const preview = turns[0]?.user?.slice(0, 60) || "Voice conversation";
      const msgs = turns.flatMap((t) => [
        { id: genId(), role: "user" as const, content: t.user },
        { id: genId(), role: "assistant" as const, content: t.jarvis },
      ]);
      const newConv = {
        id: Date.now().toString(),
        preview,
        date: new Date().toISOString(),
        messages: msgs,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([newConv, ...existing].slice(0, 50)));
    } catch {}
  }, []);

  const handleVoiceResponse = useCallback(
    async (userTranscript: string, jarvisText: string, audioBase64: string) => {
      const turn: ConvTurn = { id: genId(), user: userTranscript, jarvis: jarvisText };
      const newTurns = [...convTurns, turn];
      setConvTurns(newTurns);

      convHistoryRef.current = [
        ...convHistoryRef.current,
        { role: "user", content: userTranscript },
        { role: "assistant", content: jarvisText },
      ];

      if (mode === "text") {
        setShowTyping(false);
        setTextMessages((prev) => [
          ...prev,
          { id: genId(), role: "user", content: userTranscript },
          { id: genId(), role: "assistant", content: jarvisText },
        ]);
      }

      await saveConversation(newTurns);

      if (audioBase64) {
        await playAudioBase64(audioBase64);
      } else {
        setVoiceState("idle");
      }
    },
    [convTurns, mode, saveConversation, playAudioBase64]
  );

  const sendVoiceRequest = useCallback(
    async (audioBase64?: string, text?: string) => {
      try {
        const baseUrl = getApiUrl();
        const body: any = { history: convHistoryRef.current };
        if (audioBase64) body.audio = audioBase64;
        if (text) body.text = text;

        const response = await fetch(`${baseUrl}api/voice-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error("Request failed");

        const data = await response.json();
        await handleVoiceResponse(data.userTranscript || text || "", data.jarvisText || "", data.audio || "");
      } catch {
        setVoiceState("idle");
        setIsProcessing(false);
        setShowTyping(false);
        if (mode === "text") {
          setTextMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: "assistant",
              content: "I'm experiencing a temporary disruption. Please try again, sir.",
            },
          ]);
        }
      }
    },
    [handleVoiceResponse, mode]
  );

  const handleMicPress = useCallback(async () => {
    if (voiceState === "listening") {
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) { setVoiceState("idle"); return; }

        setVoiceState("processing");
        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        // UPDATE: Using new SDK 54 File API for reading
        const file = new FileSystem.File(uri);
        const audioBase64 = await file.read({ encoding: 'base64' });
        
        await sendVoiceRequest(audioBase64);
      } catch {
        setVoiceState("idle");
      }
    } else if (voiceState === "idle") {
      try {
        const { granted } = await AudioModule.requestRecordingPermissionsAsync();
        if (!granted) return;

        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        await AudioModule.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setVoiceState("listening");
      } catch {
        setVoiceState("idle");
      }
    }
  }, [voiceState, recorder, sendVoiceRequest]);

  const handleTextSend = useCallback(
    async (text: string) => {
      if (isProcessing) return;
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      stopAudio();
      setIsProcessing(true);
      setShowTyping(true);

      const userMsg: Message = { id: genId(), role: "user", content: text };
      setTextMessages((prev) => [...prev, userMsg]);

      await sendVoiceRequest(undefined, text);
      setIsProcessing(false);
    },
    [isProcessing, stopAudio, sendVoiceRequest]
  );

  const clearConversation = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopAudio();
    setConvTurns([]);
    setTextMessages([]);
    convHistoryRef.current = [];
    setShowTranscript(false);
  }, [stopAudio]);

  const stateLabel = {
    idle: "TAP TO SPEAK",
    listening: "LISTENING...",
    processing: "PROCESSING...",
    speaking: "SPEAKING",
  }[voiceState];

  const isSpeaking = voiceState === "speaking";
  const hasConversation = convTurns.length > 0;
  const reversedMessages = [...textMessages].reverse();

  return (
    <View style={[styles.root, { backgroundColor: Colors.jarvis.bg }]}>
      <StatusBar barStyle="light-content" />

      {booting ? (
        <BootScreen onComplete={() => setBooting(false)} />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { paddingTop: topPad + 8 }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusDot, isSpeaking && styles.statusDotSpeaking]} />
              <Text style={styles.headerTitle}>J.A.R.V.I.S.</Text>
              {isSpeaking && <SpeakingWave />}
            </View>
            <View style={styles.headerRight}>
              {isSpeaking && (
                <Pressable
                  onPress={stopAudio}
                  style={({ pressed }) => [styles.headerBtn, styles.muteBtn, pressed && { opacity: 0.6 }]}
                  testID="mute-button"
                >
                  <Feather name="volume-x" size={16} color={Colors.jarvis.cyan} />
                </Pressable>
              )}
              <Pressable
                onPress={() => setShowTranscript((v) => !v)}
                style={({ pressed }) => [
                  styles.headerBtn,
                  showTranscript && styles.headerBtnActive,
                  pressed && { opacity: 0.6 },
                ]}
                testID="transcript-button"
              >
                <Feather name="file-text" size={17} color={showTranscript ? Colors.jarvis.cyan : Colors.jarvis.muted} />
              </Pressable>
              {Platform.OS !== "web" && (
                <Pressable
                  onPress={() => setMode((m) => (m === "voice" ? "text" : "voice"))}
                  style={({ pressed }) => [
                    styles.headerBtn,
                    mode === "text" && styles.headerBtnActive,
                    pressed && { opacity: 0.6 },
                  ]}
                  testID="mode-toggle"
                >
                  <Feather
                    name={mode === "voice" ? "message-square" : "mic"}
                    size={17}
                    color={mode === "text" ? Colors.jarvis.cyan : Colors.jarvis.muted}
                  />
                </Pressable>
              )}
              <Pressable
                onPress={() => router.push("/history")}
                style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
                testID="history-button"
              >
                <Feather name="clock" size={17} color={Colors.jarvis.blue} />
              </Pressable>
              {hasConversation && (
                <Pressable
                  onPress={clearConversation}
                  style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
                >
                  <Feather name="refresh-cw" size={17} color={Colors.jarvis.muted} />
                </Pressable>
              )}
            </View>
          </View>

          {mode === "voice" ? (
            <View style={styles.voiceContainer}>
              <ScanLine />
              <View style={styles.voiceCenter}>
                <JarvisRings
                  isThinking={voiceState === "processing"}
                  size={voiceState === "listening" ? 230 : voiceState === "speaking" ? 210 : 200}
                />
                <Text
                  style={[
                    styles.stateLabel,
                    voiceState === "listening" && styles.stateLabelListening,
                    voiceState === "speaking" && styles.stateLabelSpeaking,
                  ]}
                >
                  {stateLabel}
                </Text>
                {voiceState === "idle" && !hasConversation && (
                  <Text style={styles.idleHint}>How may I assist you, sir?</Text>
                )}
              </View>

              <View style={[styles.voiceBottom, { paddingBottom: bottomPad + 16 }]}>
                <MicButton voiceState={voiceState} onPress={handleMicPress} />
                <View style={styles.quickChipsRow}>
                  {["What's the time?", "Tell me something fascinating", "Run diagnostics"].map((chip) => (
                    <Pressable
                      key={chip}
                      onPress={() => {
                        if (voiceState !== "idle") return;
                        setVoiceState("processing");
                        sendVoiceRequest(undefined, chip);
                      }}
                      style={({ pressed }) => [
                        styles.quickChip,
                        pressed && { opacity: 0.6 },
                        voiceState !== "idle" && { opacity: 0.3 },
                      ]}
                    >
                      <Text style={styles.quickChipText}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior="padding"
              keyboardVerticalOffset={0}
            >
              {textMessages.length === 0 ? (
                <View style={styles.textIdleContainer}>
                  <ScanLine />
                  <JarvisRings isThinking={isProcessing} size={180} />
                  <View style={styles.textIdleText}>
                    <Text style={styles.idleTitle}>SYSTEMS ONLINE</Text>
                    <Text style={styles.idleSubtitle}>How may I assist you, sir?</Text>
                    <View style={styles.idleHints}>
                      {["Analyse a topic in depth", "Help me write or review code", "Answer a complex question"].map((hint) => (
                        <Pressable
                          key={hint}
                          onPress={() => handleTextSend(hint)}
                          style={({ pressed }) => [styles.hintChip, pressed && { opacity: 0.6 }]}
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
                  inverted
                  ListHeaderComponent={showTyping ? <TypingIndicator /> : null}
                  keyboardDismissMode="interactive"
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={!!reversedMessages.length}
                />
              )}
              <View style={{ paddingBottom: bottomPad }}>
                <ChatInput onSend={handleTextSend} disabled={isProcessing} />
              </View>
            </KeyboardAvoidingView>
          )}

          <TranscriptPanel
            visible={showTranscript}
            turns={convTurns}
            onClose={() => setShowTranscript(false)}
            bottomPad={bottomPad}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.jarvis.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.jarvis.cyan,
  },
  statusDotSpeaking: { backgroundColor: Colors.jarvis.blue },
  headerTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 18,
    color: Colors.jarvis.blue,
    letterSpacing: 4,
  },
  headerRight: { flexDirection: "row", gap: 6 },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnActive: {
    borderColor: Colors.jarvis.dimLight,
    backgroundColor: "rgba(0, 212, 255, 0.08)",
  },
  muteBtn: {
    borderColor: Colors.jarvis.dimLight,
    backgroundColor: "rgba(0, 255, 239, 0.08)",
  },
  voiceContainer: {
    flex: 1,
    overflow: "hidden",
  },
  voiceCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  stateLabel: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 12,
    color: Colors.jarvis.muted,
    letterSpacing: 3,
    marginTop: 8,
  },
  stateLabelListening: { color: "#FF4444" },
  stateLabelSpeaking: { color: Colors.jarvis.cyan },
  idleHint: {
    fontFamily: "Exo2_300Light",
    fontSize: 15,
    color: Colors.jarvis.dimLight,
    letterSpacing: 1,
    marginTop: 4,
  },
  voiceBottom: {
    alignItems: "center",
    gap: 20,
    paddingTop: 12,
  },
  micGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 60,
    zIndex: 0,
  },
  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  quickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  quickChip: {
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  quickChipText: {
    fontFamily: "Exo2_400Regular",
    fontSize: 12,
    color: Colors.jarvis.muted,
  },
  textIdleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  textIdleText: { alignItems: "center", marginTop: 28, gap: 8 },
  idleTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 13,
    color: Colors.jarvis.blue,
    letterSpacing: 4,
  },
  idleSubtitle: {
    fontFamily: "Exo2_300Light",
    fontSize: 15,
    color: Colors.jarvis.muted,
    letterSpacing: 1,
  },
  idleHints: { marginTop: 20, gap: 8, alignItems: "center" },
  hintChip: {
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hintText: {
    fontFamily: "Exo2_400Regular",
    fontSize: 13,
    color: Colors.jarvis.muted,
  },
  listContent: { paddingVertical: 12 },
  scanLineWrapper: { overflow: "hidden", pointerEvents: "none" },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Colors.jarvis.blue,
    opacity: 0.3,
  },
  waveContainer: { flexDirection: "row", alignItems: "center", gap: 2, height: 16 },
  waveBar: { width: 2.5, height: 14, borderRadius: 2, backgroundColor: Colors.jarvis.cyan },
  bootContainer: { backgroundColor: Colors.jarvis.bg, alignItems: "center", justifyContent: "center" },
  bootText: { alignItems: "center", gap: 8, marginTop: 32 },
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
  bootStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  bootStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.jarvis.cyan },
  bootStatus: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 11,
    color: Colors.jarvis.cyan,
    letterSpacing: 2,
  },
  transcriptBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  transcriptSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "65%",
    backgroundColor: "#020C14",
    borderTopWidth: 1,
    borderTopColor: Colors.jarvis.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  transcriptHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.jarvis.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.jarvis.border,
  },
  transcriptTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 13,
    color: Colors.jarvis.blue,
    letterSpacing: 4,
  },
  transcriptClose: { padding: 4 },
  transcriptScroll: { paddingHorizontal: 20, paddingTop: 12 },
  transcriptEmpty: {
    fontFamily: "Exo2_300Light",
    fontSize: 14,
    color: Colors.jarvis.dimLight,
    textAlign: "center",
    marginTop: 20,
  },
  transcriptTurn: {
    marginBottom: 18,
    borderLeftWidth: 1,
    borderLeftColor: Colors.jarvis.border,
    paddingLeft: 12,
    gap: 8,
  },
  transcriptUserRow: { gap: 3 },
  transcriptJarvisRow: { gap: 3 },
  transcriptLabel: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 9,
    color: Colors.jarvis.muted,
    letterSpacing: 3,
  },
  transcriptUserText: {
    fontFamily: "Exo2_400Regular",
    fontSize: 14,
    color: "#b0c4d8",
    lineHeight: 20,
  },
  transcriptJarvisText: {
    fontFamily: "Exo2_300Light",
    fontSize: 14,
    color: "#d8eaf5",
    lineHeight: 20,
  },
});
