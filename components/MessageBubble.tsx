import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

function TypingDot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.typingDot, style]} />;
}

export function TypingIndicator() {
  return (
    <View style={styles.typingContainer}>
      <View style={styles.jarvisLabel}>
        <Text style={styles.jarvisLabelText}>J.A.R.V.I.S.</Text>
        <View style={styles.onlineDot} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDotsRow}>
          <TypingDot delay={0} />
          <TypingDot delay={150} />
          <TypingDot delay={300} />
        </View>
      </View>
    </View>
  );
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isUser = message.role === "user";

  return (
    <Animated.View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant, animStyle]}>
      {!isUser && (
        <View style={styles.jarvisLabel}>
          <Text style={styles.jarvisLabelText}>J.A.R.V.I.S.</Text>
          <View style={styles.onlineDot} />
        </View>
      )}
      {isUser && (
        <Text style={styles.userLabel}>YOU</Text>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && <View style={styles.assistantAccentBar} />}
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 6,
    paddingHorizontal: 16,
    maxWidth: "88%",
  },
  wrapperUser: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  wrapperAssistant: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  jarvisLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  jarvisLabelText: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 10,
    color: Colors.jarvis.blue,
    letterSpacing: 2,
  },
  onlineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.jarvis.cyan,
  },
  userLabel: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 10,
    color: Colors.jarvis.muted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
  },
  userBubble: {
    backgroundColor: Colors.jarvis.userBubble,
    borderWidth: 1,
    borderColor: Colors.jarvis.dimLight,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.jarvis.jarvusBubble,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    borderBottomLeftRadius: 4,
  },
  assistantAccentBar: {
    width: 2,
    borderRadius: 1,
    backgroundColor: Colors.jarvis.blue,
    opacity: 0.8,
    alignSelf: "stretch",
  },
  messageText: {
    flex: 1,
    lineHeight: 22,
    fontSize: 15,
  },
  userText: {
    fontFamily: "Exo2_400Regular",
    color: Colors.jarvis.white,
  },
  assistantText: {
    fontFamily: "Exo2_400Regular",
    color: "#B8E8F5",
  },
  typingContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
    alignSelf: "flex-start",
  },
  typingBubble: {
    backgroundColor: Colors.jarvis.jarvusBubble,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  typingDotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    height: 16,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.jarvis.blue,
  },
});
