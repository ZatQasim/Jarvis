import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const STORAGE_KEY = "jarvis_conversations";

interface StoredConversation {
  id: string;
  preview: string;
  date: string;
  messages: { role: string; content: string }[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<StoredConversation[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const loadConversations = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setConversations(JSON.parse(raw));
    } catch {}
  };

  const deleteConversation = async (id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearAll = () => {
    if (Platform.OS === "web") {
      setConversations([]);
      AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    Alert.alert("Clear All History", "This will permanently delete all conversation records.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setConversations([]);
          await AsyncStorage.removeItem(STORAGE_KEY);
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: Colors.jarvis.bg }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather name="arrow-left" size={20} color={Colors.jarvis.blue} />
        </Pressable>
        <Text style={styles.headerTitle}>ARCHIVE</Text>
        {conversations.length > 0 ? (
          <Pressable
            onPress={clearAll}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={16} color={Colors.jarvis.danger} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="archive" size={48} color={Colors.jarvis.border} />
          <Text style={styles.emptyTitle}>No Records</Text>
          <Text style={styles.emptySubtitle}>Completed conversations will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.convCard}>
              <View style={styles.convLeft}>
                <View style={styles.convAccent} />
                <View style={styles.convInfo}>
                  <Text style={styles.convPreview} numberOfLines={2}>{item.preview}</Text>
                  <View style={styles.convMeta}>
                    <Text style={styles.convDate}>{formatDate(item.date)}</Text>
                    <Text style={styles.convCount}>
                      {item.messages.length} messages
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => deleteConversation(item.id)}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.5 }]}
              >
                <Feather name="x" size={14} color={Colors.jarvis.muted} />
              </Pressable>
            </View>
          )}
        />
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
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: Colors.jarvis.bgCard,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
  },
  headerTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 16,
    color: Colors.jarvis.blue,
    letterSpacing: 4,
  },
  clearBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.2)",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 14,
    color: Colors.jarvis.muted,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontFamily: "Exo2_400Regular",
    fontSize: 13,
    color: Colors.jarvis.border,
    textAlign: "center",
  },
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginVertical: 5,
    backgroundColor: Colors.jarvis.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.jarvis.border,
    padding: 14,
    gap: 10,
  },
  convLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  convAccent: {
    width: 2,
    alignSelf: "stretch",
    backgroundColor: Colors.jarvis.dim,
    borderRadius: 1,
    marginTop: 2,
  },
  convInfo: {
    flex: 1,
    gap: 6,
  },
  convPreview: {
    fontFamily: "Exo2_400Regular",
    fontSize: 14,
    color: Colors.jarvis.white,
    lineHeight: 20,
  },
  convMeta: {
    flexDirection: "row",
    gap: 12,
  },
  convDate: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 10,
    color: Colors.jarvis.muted,
    letterSpacing: 1,
  },
  convCount: {
    fontFamily: "ShareTechMono_400Regular",
    fontSize: 10,
    color: Colors.jarvis.dim,
    letterSpacing: 1,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
});
