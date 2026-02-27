import React, { useRef, useState } from "react";
import { View, TextInput, Pressable, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.inputWrapper}>
          <View style={styles.inputPrefix} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Issue a directive..."
            placeholderTextColor={Colors.jarvis.muted}
            multiline
            maxLength={2000}
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            canSend && styles.sendBtnActive,
            pressed && canSend && styles.sendBtnPressed,
          ]}
        >
          <Feather
            name={disabled ? "loader" : "send"}
            size={18}
            color={canSend ? Colors.jarvis.bg : Colors.jarvis.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.jarvis.border,
    backgroundColor: Colors.jarvis.bg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.jarvis.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    overflow: "hidden",
  },
  inputPrefix: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: Colors.jarvis.dim,
  },
  input: {
    flex: 1,
    fontFamily: "Exo2_400Regular",
    fontSize: 15,
    color: Colors.jarvis.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: Colors.jarvis.blue,
    borderColor: Colors.jarvis.blue,
  },
  sendBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
});
