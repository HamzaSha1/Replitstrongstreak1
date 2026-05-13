import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  TouchableWithoutFeedback, PanResponder,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

// ─── Public types ─────────────────────────────────────────────────────────────

export type GameType = "snake" | "breathing";

export interface RestNotification {
  emoji: string;
  title: string;
  message: string;
  color: string;
}

// ─── Ring constants ───────────────────────────────────────────────────────────

const RING_R = 92;
const RING_SW = 10;
const RING_SIZE = (RING_R + RING_SW) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ─── NotificationCard ─────────────────────────────────────────────────────────

function NotificationCard({ notification }: { notification: RestNotification }) {
  const colors = useColors();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.notifCard,
        {
          backgroundColor: notification.color + "18",
          borderColor: notification.color + "55",
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.notifEmoji}>{notification.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.notifTitle, { color: notification.color }]}>{notification.title}</Text>
        <Text style={[styles.notifMsg, { color: colors.mutedForeground }]}>{notification.message}</Text>
      </View>
    </Animated.View>
  );
}

// ─── SnakeGame ────────────────────────────────────────────────────────────────

const GRID = 14;
const CELL = 18;
const GAME_W = GRID * CELL; // 252

type Pt = { x: number; y: number };

function randFood(snake: Pt[]): Pt {
  let f: Pt;
  do {
    f = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === f.x && s.y === f.y));
  return f;
}

function SnakeGame({ active }: { active: boolean }) {
  const colors = useColors();
  const [, setTick] = useState(0);

  const snake = useRef<Pt[]>([{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }]);
  const food = useRef<Pt>({ x: 10, y: 4 });
  const dir = useRef<Pt>({ x: 1, y: 0 });
  const nextDir = useRef<Pt>({ x: 1, y: 0 });
  const alive = useRef(true);
  const score = useRef(0);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = () => {
    snake.current = [{ x: 7, y: 7 }, { x: 6, y: 7 }, { x: 5, y: 7 }];
    food.current = { x: 10, y: 4 };
    dir.current = { x: 1, y: 0 };
    nextDir.current = { x: 1, y: 0 };
    alive.current = true;
    score.current = 0;
  };

  useEffect(() => {
    if (!active) { loopRef.current && clearInterval(loopRef.current); return; }
    reset();
    setTick((t) => t + 1);

    loopRef.current = setInterval(() => {
      if (!alive.current) return;

      const nd = nextDir.current;
      const cd = dir.current;
      if (!(nd.x === -cd.x && nd.y === -cd.y)) dir.current = nd;

      const head = snake.current[0];
      const newHead: Pt = {
        x: (head.x + dir.current.x + GRID) % GRID,
        y: (head.y + dir.current.y + GRID) % GRID,
      };

      if (snake.current.some((s) => s.x === newHead.x && s.y === newHead.y)) {
        alive.current = false;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTick((t) => t + 1);
        return;
      }

      const ate = newHead.x === food.current.x && newHead.y === food.current.y;
      const newSnake = [newHead, ...snake.current];
      if (!ate) newSnake.pop();
      else {
        score.current++;
        food.current = randFood(newSnake);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      snake.current = newSnake;
      setTick((t) => t + 1);
    }, 130);

    return () => { loopRef.current && clearInterval(loopRef.current); };
  }, [active]);

  // Swipe pan responder
  const swipePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (!alive.current) { reset(); setTick((t) => t + 1); return; }
        const { dx, dy } = g;
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        if (Math.abs(dx) >= Math.abs(dy)) {
          nextDir.current = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        } else {
          nextDir.current = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
        }
      },
    })
  ).current;

  const snakePos = snake.current;
  const foodPos = food.current;
  const isAlive = alive.current;

  return (
    <View style={styles.gameWrap}>
      <Text style={[styles.gameScore, { color: colors.primary }]}>🐍  Score: {score.current}</Text>
      <View
        style={[styles.snakeGrid, { width: GAME_W, height: GAME_W, backgroundColor: colors.muted + "50" }]}
        {...swipePan.panHandlers}
      >
        <View
          style={{
            position: "absolute",
            left: foodPos.x * CELL + 2, top: foodPos.y * CELL + 2,
            width: CELL - 4, height: CELL - 4,
            borderRadius: (CELL - 4) / 2,
            backgroundColor: "#FF6B6B",
          }}
        />
        {snakePos.map((seg, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: seg.x * CELL + 1, top: seg.y * CELL + 1,
              width: CELL - 2, height: CELL - 2,
              borderRadius: i === 0 ? 5 : 3,
              backgroundColor: i === 0 ? colors.primary : colors.primary + "99",
            }}
          />
        ))}
        {!isAlive && (
          <View
            style={[StyleSheet.absoluteFillObject, styles.gameOver, { backgroundColor: "rgba(0,0,0,0.72)" }]}
            pointerEvents="none"
          >
            <Text style={styles.gameOverText}>💀 Game Over</Text>
            <Text style={styles.gameOverSub}>Score: {score.current}</Text>
            <Text style={styles.gameOverSub}>Tap to restart</Text>
          </View>
        )}
      </View>
      <Text style={[styles.gameHint, { color: colors.mutedForeground }]}>Swipe to steer 👆</Text>
    </View>
  );
}

// ─── BoxBreathingGame ─────────────────────────────────────────────────────────

const BREATH_PHASES = [
  { label: "Inhale", sub: "Breathe in slowly...", dur: 4000, toScale: 1.0 },
  { label: "Hold",   sub: "Hold your breath...",  dur: 4000, toScale: 1.0 },
  { label: "Exhale", sub: "Breathe out slowly...", dur: 4000, toScale: 0.35 },
  { label: "Hold",   sub: "Hold...",               dur: 4000, toScale: 0.35 },
] as const;

function BoxBreathingGame({ active }: { active: boolean }) {
  const colors = useColors();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [count, setCount] = useState(4);
  const scale = useRef(new Animated.Value(0.35)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPhase = (idx: number) => {
    const p = BREATH_PHASES[idx % BREATH_PHASES.length];
    setPhaseIdx(idx % BREATH_PHASES.length);
    setCount(p.dur / 1000);
    animRef.current = Animated.timing(scale, { toValue: p.toScale, duration: p.dur, useNativeDriver: true });
    animRef.current.start(({ finished }) => { if (finished) startPhase(idx + 1); });
    countRef.current && clearInterval(countRef.current);
    let rem = p.dur / 1000;
    countRef.current = setInterval(() => { rem--; if (rem > 0) setCount(rem); else clearInterval(countRef.current!); }, 1000);
  };

  useEffect(() => {
    if (!active) {
      animRef.current?.stop();
      countRef.current && clearInterval(countRef.current);
      scale.setValue(0.35);
      return;
    }
    startPhase(0);
    return () => { animRef.current?.stop(); countRef.current && clearInterval(countRef.current); };
  }, [active]);

  const p = BREATH_PHASES[phaseIdx];

  return (
    <View style={[styles.gameWrap, { alignItems: "center", paddingVertical: 20 }]}>
      <Text style={[styles.gameScore, { color: colors.primary, alignSelf: "center" }]}>🫁  Box Breathing</Text>
      <View style={{ width: 140, height: 140, alignItems: "center", justifyContent: "center", marginVertical: 12 }}>
        <Animated.View
          style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: colors.primary + "28",
            borderWidth: 2, borderColor: colors.primary,
            transform: [{ scale }],
          }}
        />
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
          <Text style={[styles.breathCount, { color: colors.primary }]}>{count}</Text>
        </View>
      </View>
      <Text style={[styles.breathLabel, { color: colors.foreground }]}>{p.label}</Text>
      <Text style={[styles.breathSub, { color: colors.mutedForeground }]}>{p.sub}</Text>
      <Text style={[styles.breathHint, { color: colors.mutedForeground }]}>4-4-4-4 box breathing</Text>
    </View>
  );
}

// ─── RestTimerModal ───────────────────────────────────────────────────────────
// Rendered as an absolute overlay (NOT a RN Modal) so it can be minimized
// while still allowing interaction with the workout screen underneath.

interface RestTimerModalProps {
  visible: boolean;
  seconds: number;
  onClose: () => void;
  notification?: RestNotification | null;
  currentGame?: GameType | null;
  onGameChange?: (game: GameType | null) => void;
}

const GAME_TABS: { id: GameType; emoji: string; label: string }[] = [
  { id: "snake",     emoji: "🐍", label: "Snake"  },
  { id: "breathing", emoji: "🫁", label: "Breathe" },
];

export default function RestTimerModal({
  visible, seconds, onClose, notification, currentGame, onGameChange,
}: RestTimerModalProps) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(seconds);
  const totalRef = useRef(seconds);
  const [showNotif, setShowNotif] = useState(false);
  const notifKey = useRef(0);
  const [minimized, setMinimized] = useState(false);

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setRemaining(seconds);
      totalRef.current = seconds;
      setMinimized(false);
      return;
    }
    totalRef.current = seconds;
    setRemaining(seconds);
    const iv = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(iv);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onClose();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [visible, seconds]);

  // ── Notification card ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || !notification) { setShowNotif(false); return; }
    notifKey.current += 1;
    setShowNotif(true);
    const t = setTimeout(() => setShowNotif(false), 5500);
    return () => clearTimeout(t);
  }, [visible, notification]);

  const adjustTime = (delta: number) => {
    setRemaining((r) => {
      const next = Math.max(1, r + delta);
      if (next > totalRef.current) totalRef.current = next;
      return next;
    });
  };

  const progress = totalRef.current > 0 ? remaining / totalRef.current : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const strokeOffset = CIRCUMFERENCE * (1 - progress);
  const activeGame = currentGame ?? null;
  const hasGame = !!activeGame;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  if (!visible) return null;

  return (
    // Outer container: covers the full screen.
    // When minimized → pointerEvents="box-none" so taps fall through to workout screen,
    // except on the pill itself (which is a child and still captures taps).
    <View
      style={[StyleSheet.absoluteFillObject, styles.outerWrap]}
      pointerEvents={minimized ? "box-none" : "auto"}
    >

      {/* ── Dark backdrop — only when NOT minimized ─────────────────────── */}
      {!minimized && (
        <TouchableWithoutFeedback onPress={() => setMinimized(true)}>
          <View style={[StyleSheet.absoluteFillObject, styles.backdrop]} />
        </TouchableWithoutFeedback>
      )}

      {/* ── Full timer box ──────────────────────────────────────────────────
          Hidden via display:'none' when minimized so components (games, timer)
          stay mounted and keep running. State & intervals are preserved. */}
      <View style={[styles.centered, { display: minimized ? "none" : "flex" }]}>
        <TouchableWithoutFeedback onPress={() => { /* absorb taps inside box */ }}>
          <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* Notification card */}
            {showNotif && notification && (
              <NotificationCard key={notifKey.current} notification={notification} />
            )}

            {hasGame ? (
              // Compact timer bar when a game is open
              <View style={[styles.compactBar, { borderBottomColor: colors.border }]}>
                <Text style={[styles.compactTime, { color: colors.foreground }]}>{timeStr}</Text>
                <TouchableOpacity style={[styles.compactAdj, { backgroundColor: colors.muted }]} onPress={() => adjustTime(-10)}>
                  <Text style={[styles.compactAdjText, { color: colors.foreground }]}>-10s</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.compactSkip, { backgroundColor: colors.muted }]} onPress={onClose}>
                  <Text style={[styles.compactSkipText, { color: colors.foreground }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.compactAdj, { backgroundColor: colors.muted }]} onPress={() => adjustTime(10)}>
                  <Text style={[styles.compactAdjText, { color: colors.foreground }]}>+10s</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Full circular ring
              <View style={styles.ringWrap}>
                <Text style={[styles.restLabel, { color: colors.mutedForeground }]}>REST</Text>
                <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
                  <Svg width={RING_SIZE} height={RING_SIZE}>
                    <Circle
                      cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                      stroke={colors.muted} strokeWidth={RING_SW} fill="none"
                    />
                    <Circle
                      cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                      stroke={colors.primary} strokeWidth={RING_SW} fill="none"
                      strokeDasharray={`${CIRCUMFERENCE}`}
                      strokeDashoffset={strokeOffset}
                      strokeLinecap="round"
                      transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
                    />
                  </Svg>
                  <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
                    <Text style={[styles.restTime, { color: colors.foreground }]}>{timeStr}</Text>
                  </View>
                </View>
                <View style={styles.adjRow}>
                  <TouchableOpacity style={[styles.adjBtn, { backgroundColor: colors.muted }]} onPress={() => adjustTime(-10)}>
                    <Text style={[styles.adjText, { color: colors.foreground }]}>-10s</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.skipBtn, { backgroundColor: colors.muted }]} onPress={onClose}>
                    <Text style={[styles.skipText, { color: colors.foreground }]}>Skip Rest</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.adjBtn, { backgroundColor: colors.muted }]} onPress={() => adjustTime(10)}>
                    <Text style={[styles.adjText, { color: colors.foreground }]}>+10s</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Games — always mounted when visible so state survives minimize */}
            {activeGame === "snake"     && <SnakeGame        active={activeGame === "snake"}     />}
            {activeGame === "breathing" && <BoxBreathingGame active={activeGame === "breathing"} />}

            {/* Game tabs */}
            <View style={[styles.gameTabs, { borderTopColor: colors.border }]}>
              {GAME_TABS.map(({ id, emoji, label }) => (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.gameTab,
                    {
                      borderColor: activeGame === id ? colors.primary : colors.border,
                      backgroundColor: activeGame === id ? colors.primary + "18" : "transparent",
                    },
                  ]}
                  onPress={() => onGameChange?.(activeGame === id ? null : id)}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  <Text style={[styles.gameTabLabel, { color: activeGame === id ? colors.primary : colors.mutedForeground }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        </TouchableWithoutFeedback>
      </View>

      {/* ── Floating pill — only when minimized ────────────────────────────
          pointerEvents="box-none" on pillWrap lets taps miss the empty
          area around the pill through to the workout screen. */}
      {minimized && (
        <View style={styles.pillWrap} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.primary + "70" }]}
            onPress={() => setMinimized(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="timer-outline" size={16} color={colors.primary} />
            <Text style={[styles.pillTime, { color: colors.primary }]}>{timeStr}</Text>
            <Text style={[styles.pillLabel, { color: colors.mutedForeground }]}>Tap to restore</Text>
            <Ionicons name="chevron-up" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrap: {
    zIndex: 999,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    borderRadius: 28,
    borderWidth: 1,
    width: 340,
    overflow: "hidden",
  },

  // Notification card
  notifCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 14, marginBottom: 6, borderRadius: 14, borderWidth: 1, padding: 12,
  },
  notifEmoji: { fontSize: 28 },
  notifTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  notifMsg: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Full ring
  ringWrap: { alignItems: "center", paddingTop: 24, paddingBottom: 20, gap: 16 },
  restLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 2 },
  restTime: { fontSize: 52, fontWeight: "700", fontFamily: "Inter_700Bold" },
  adjRow: { flexDirection: "row", gap: 10 },
  adjBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100 },
  adjText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  skipBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 100 },
  skipText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Compact bar (game open)
  compactBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactTime: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", minWidth: 60 },
  compactAdj: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 100 },
  compactAdjText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  compactSkip: { flex: 1, paddingVertical: 7, borderRadius: 100, alignItems: "center" },
  compactSkipText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Game wrapper
  gameWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 6, alignItems: "center" },
  gameScore: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", alignSelf: "flex-start" },
  gameHint: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Snake
  snakeGrid: { borderRadius: 10, overflow: "hidden" },
  gameOver: { alignItems: "center", justifyContent: "center", gap: 4 },
  gameOverText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  gameOverSub: { color: "#ffffffcc", fontSize: 12, fontFamily: "Inter_400Regular" },

  // Box breathing
  breathCount: { fontSize: 30, fontWeight: "700", fontFamily: "Inter_700Bold" },
  breathLabel: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  breathSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  breathHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },

  // Game tabs
  gameTabs: {
    flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  gameTab: { flex: 1, alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  gameTabLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Minimized pill
  pillWrap: {
    position: "absolute",
    bottom: 110,
    left: 0, right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  pillTime: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  pillLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
