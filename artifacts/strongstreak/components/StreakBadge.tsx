import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface StreakBadgeProps {
  streak: number;
  size?: "sm" | "md" | "lg";
}

export default function StreakBadge({ streak, size = "md" }: StreakBadgeProps) {
  const colors = useColors();

  const config = {
    sm: { iconSize: 14, fontSize: 13, padding: 4, gap: 3 },
    md: { iconSize: 18, fontSize: 16, padding: 6, gap: 4 },
    lg: { iconSize: 28, fontSize: 28, padding: 10, gap: 6 },
  }[size];

  return (
    <View style={[styles.container, { padding: config.padding, gap: config.gap, backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ionicons name="flame" size={config.iconSize} color="#F97316" />
      <Text style={[styles.count, { fontSize: config.fontSize, color: colors.foreground }]}>
        {streak}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 100,
    borderWidth: 1,
  },
  count: {
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
