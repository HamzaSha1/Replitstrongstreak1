import React, { useEffect, useRef } from "react";
import { View, Text, Modal, StyleSheet, Animated, TouchableOpacity } from "react-native";

const MILESTONES = [7, 14, 21, 30, 60, 90, 100, 180, 365];

export function isMilestoneStreak(streak: number): boolean {
  return MILESTONES.includes(streak);
}

interface Props {
  visible: boolean;
  streak: number;
  onClose: () => void;
}

export function StreakMilestone({ visible, streak, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const getMessage = () => {
    if (streak >= 365) return "ONE FULL YEAR! 🏆";
    if (streak >= 180) return "Half a year! 💎";
    if (streak >= 100) return "100 days! 🌟";
    if (streak >= 90) return "3 months strong! 🔥";
    if (streak >= 60) return "2 months in! ⚡";
    if (streak >= 30) return "1 month done! 💪";
    if (streak >= 21) return "21 days — a habit! 🧠";
    if (streak >= 14) return "2 weeks straight! 🎯";
    return "One week done! 🎉";
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={styles.emoji}>🔥</Text>
          <Text style={styles.streak}>{streak}</Text>
          <Text style={styles.label}>Day Streak</Text>
          <Text style={styles.message}>{getMessage()}</Text>
          <Text style={styles.sub}>Keep showing up. Consistency is everything.</Text>
          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Let's go!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  card: { backgroundColor: "#1a1a1a", borderRadius: 24, padding: 32, alignItems: "center", width: "80%", borderWidth: 2, borderColor: "#FF4500" },
  emoji: { fontSize: 56, marginBottom: 8 },
  streak: { fontSize: 72, fontWeight: "900", color: "#FF4500", lineHeight: 80 },
  label: { fontSize: 18, color: "#fff", fontWeight: "600", marginBottom: 16 },
  message: { fontSize: 20, color: "#fff", fontWeight: "800", textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 13, color: "#888", textAlign: "center", marginBottom: 24 },
  btn: { backgroundColor: "#FF4500", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
