import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
  TouchableWithoutFeedback,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

// ─── Public types ─────────────────────────────────────────────────────────────

export type GameType = "snake" | "flappy" | "breathing";

export interface RestNotification {
  emoji: string;
  title: string;
  message: string;
  color: string;
}

// ─── Ring constants ───────────────────────────────────────────────────────────

const RING_R = 68;
const RING_SW = 8;
const RING_SIZE = (RING_R + RING_SW) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_R;

// ─── NotificationCard ─────────────────────────────────────────────────────────

function NotificationCard({ notification }: { notification: RestNotification }) {
  const colors = useColors();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 60, friction: 10,
      }),
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
        <Text style={[styles.notifTitle, { color: notification.color }]}>
          {notification.title}
        </Text>
        <Text style={[styles.notifMsg, { color: colors.mutedForeground }]}>
          {notification.message}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── SnakeGame ────────────────────────────────────────────────────────────────

const GRID = 14;
const CELL = 16;
const GAME_W = GRID * CELL; // 224

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
    if (!active) {
      loopRef.current && clearInterval(loopRef.current);
      return;
    }
    reset();
    setTick((t) => t + 1);

    loopRef.current = setInterval(() => {
      if (!alive.current) return;

      // Apply queued direction (prevent 180° reversal)
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

  const setDir = (dx: number, dy: number) => { nextDir.current = { x: dx, y: dy }; };

  const snakePos = snake.current;
  const foodPos = food.current;
  const isAlive = alive.current;

  return (
    <View style={styles.gameWrap}>
      <Text style={[styles.gameScore, { color: colors.primary }]}>🐍  Score: {score.current}</Text>

      {/* Grid */}
      <View style={[styles.snakeGrid, { width: GAME_W, height: GAME_W, backgroundColor: colors.muted + "50" }]}>
        {/* Food */}
        <View
          style={{
            position: "absolute",
            left: foodPos.x * CELL + 2,
            top: foodPos.y * CELL + 2,
            width: CELL - 4, height: CELL - 4,
            borderRadius: (CELL - 4) / 2,
            backgroundColor: "#FF6B6B",
          }}
        />
        {/* Snake */}
        {snakePos.map((seg, i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: seg.x * CELL + 1,
              top: seg.y * CELL + 1,
              width: CELL - 2, height: CELL - 2,
              borderRadius: i === 0 ? 5 : 3,
              backgroundColor: i === 0 ? colors.primary : colors.primary + "99",
            }}
          />
        ))}
        {/* Game over overlay */}
        {!isAlive && (
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, styles.gameOver, { backgroundColor: "rgba(0,0,0,0.72)" }]}
            onPress={() => { reset(); setTick((t) => t + 1); }}
          >
            <Text style={styles.gameOverText}>💀 Game Over</Text>
            <Text style={styles.gameOverSub}>Score: {score.current}</Text>
            <Text style={styles.gameOverSub}>Tap to restart</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* D-pad */}
      <View style={styles.dpad}>
        <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir(0, -1)}>
          <Ionicons name="chevron-up" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.dpadRow}>
          <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir(-1, 0)}>
            <Ionicons name="chevron-back" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.dpadCenter, { backgroundColor: colors.muted }]} />
          <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir(1, 0)}>
            <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.dpadBtn} onPress={() => setDir(0, 1)}>
          <Ionicons name="chevron-down" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── FlappyBirdGame ───────────────────────────────────────────────────────────

const FB_W = GAME_W;
const FB_H = 156;
const BIRD_SZ = 22;
const PIPE_W = 38;
const PIPE_GAP = 66;
const GRAVITY = 0.5;
const FLAP_VEL = -9;
const PIPE_SPEED = 2.5;
const BIRD_X = 60;

type Pipe = { x: number; gapY: number };

function FlappyBirdGame({ active }: { active: boolean }) {
  const colors = useColors();
  const [, setTick] = useState(0);

  const birdY = useRef(FB_H / 2 - BIRD_SZ / 2);
  const birdVY = useRef(0);
  const pipes = useRef<Pipe[]>([]);
  const score = useRef(0);
  const alive = useRef(true);
  const started = useRef(false);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = () => {
    birdY.current = FB_H / 2 - BIRD_SZ / 2;
    birdVY.current = 0;
    pipes.current = [{ x: FB_W + 30, gapY: 50 + Math.random() * (FB_H - PIPE_GAP - 80) }];
    score.current = 0;
    alive.current = true;
    started.current = false;
  };

  useEffect(() => {
    if (!active) {
      loopRef.current && clearInterval(loopRef.current);
      return;
    }
    reset();
    setTick((t) => t + 1);

    loopRef.current = setInterval(() => {
      if (!alive.current || !started.current) { setTick((t) => t + 1); return; }

      // Physics
      birdVY.current += GRAVITY;
      birdY.current += birdVY.current;

      // Floor / ceiling
      if (birdY.current < 0 || birdY.current + BIRD_SZ > FB_H) {
        alive.current = false;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTick((t) => t + 1);
        return;
      }

      // Move + cull pipes
      pipes.current = pipes.current
        .map((p) => ({ ...p, x: p.x - PIPE_SPEED }))
        .filter((p) => p.x + PIPE_W > 0);

      // Spawn
      if (!pipes.current.length || pipes.current[pipes.current.length - 1].x < FB_W - 150) {
        pipes.current.push({
          x: FB_W + 10,
          gapY: 40 + Math.random() * (FB_H - PIPE_GAP - 70),
        });
      }

      // Score
      pipes.current.forEach((p) => {
        if (p.x + PIPE_W < BIRD_X && p.x + PIPE_W >= BIRD_X - PIPE_SPEED) {
          score.current++;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      });

      // Collision
      for (const p of pipes.current) {
        if (BIRD_X + BIRD_SZ > p.x && BIRD_X < p.x + PIPE_W) {
          if (birdY.current < p.gapY || birdY.current + BIRD_SZ > p.gapY + PIPE_GAP) {
            alive.current = false;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          }
        }
      }

      setTick((t) => t + 1);
    }, 28);

    return () => { loopRef.current && clearInterval(loopRef.current); };
  }, [active]);

  const handleFlap = () => {
    if (!alive.current) { reset(); setTick((t) => t + 1); return; }
    started.current = true;
    birdVY.current = FLAP_VEL;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.gameWrap}>
      <Text style={[styles.gameScore, { color: colors.primary }]}>🐦  Score: {score.current}</Text>
      <TouchableWithoutFeedback onPress={handleFlap}>
        <View
          style={[
            styles.flappyCanvas,
            { width: FB_W, height: FB_H, backgroundColor: colors.muted + "50", overflow: "hidden" },
          ]}
        >
          {/* Pipes */}
          {pipes.current.map((pipe, i) => (
            <React.Fragment key={i}>
              <View
                style={{
                  position: "absolute",
                  left: pipe.x, top: 0,
                  width: PIPE_W, height: pipe.gapY,
                  backgroundColor: colors.primary + "cc",
                  borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: pipe.x, top: pipe.gapY + PIPE_GAP,
                  width: PIPE_W, height: FB_H - pipe.gapY - PIPE_GAP,
                  backgroundColor: colors.primary + "cc",
                  borderTopLeftRadius: 6, borderTopRightRadius: 6,
                }}
              />
            </React.Fragment>
          ))}
          {/* Bird */}
          <View
            style={{
              position: "absolute",
              left: BIRD_X - BIRD_SZ / 2,
              top: birdY.current,
              width: BIRD_SZ, height: BIRD_SZ,
              borderRadius: BIRD_SZ / 2,
              backgroundColor: "#FFD700",
              borderWidth: 2, borderColor: "#FF9F00",
            }}
          />
          {/* Overlay */}
          {(!alive.current || !started.current) && (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                styles.gameOver,
                { backgroundColor: "rgba(0,0,0,0.65)" },
              ]}
            >
              <Text style={styles.gameOverText}>
                {!alive.current ? "💀 Game Over" : "Tap to Start"}
              </Text>
              {!alive.current && <Text style={styles.gameOverSub}>Score: {score.current}</Text>}
              <Text style={styles.gameOverSub}>
                {!alive.current ? "Tap to restart" : "Tap anywhere"}
              </Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
      <Text style={[styles.gameHint, { color: colors.mutedForeground }]}>Tap to flap 🐦</Text>
    </View>
  );
}

// ─── BoxBreathingGame ─────────────────────────────────────────────────────────

const BREATH_PHASES = [
  { label: "Inhale", sub: "Breathe in slowly...", dur: 4000, toScale: 1.0 },
  { label: "Hold", sub: "Hold your breath...", dur: 4000, toScale: 1.0 },
  { label: "Exhale", sub: "Breathe out slowly...", dur: 4000, toScale: 0.35 },
  { label: "Hold", sub: "Hold...", dur: 4000, toScale: 0.35 },
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

    animRef.current = Animated.timing(scale, {
      toValue: p.toScale, duration: p.dur, useNativeDriver: true,
    });
    animRef.current.start(({ finished }) => { if (finished) startPhase(idx + 1); });

    countRef.current && clearInterval(countRef.current);
    let rem = p.dur / 1000;
    countRef.current = setInterval(() => {
      rem--;
      if (rem > 0) setCount(rem);
      else clearInterval(countRef.current!);
    }, 1000);
  };

  useEffect(() => {
    if (!active) {
      animRef.current?.stop();
      countRef.current && clearInterval(countRef.current);
      scale.setValue(0.35);
      return;
    }
    startPhase(0);
    return () => {
      animRef.current?.stop();
      countRef.current && clearInterval(countRef.current);
    };
  }, [active]);

  const p = BREATH_PHASES[phaseIdx];

  return (
    <View style={[styles.gameWrap, { alignItems: "center", paddingVertical: 20 }]}>
      <Text style={[styles.gameScore, { color: colors.primary, alignSelf: "center" }]}>🫁  Box Breathing</Text>

      {/* Animated ring */}
      <View style={{ width: 130, height: 130, alignItems: "center", justifyContent: "center", marginVertical: 12 }}>
        <Animated.View
          style={{
            width: 110, height: 110,
            borderRadius: 55,
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

interface RestTimerModalProps {
  visible: boolean;
  seconds: number;
  onClose: () => void;
  notification?: RestNotification | null;
  currentGame?: GameType | null;
  onGameChange?: (game: GameType | null) => void;
}

const GAME_TABS: { id: GameType; emoji: string; label: string }[] = [
  { id: "snake", emoji: "🐍", label: "Snake" },
  { id: "flappy", emoji: "🐦", label: "Flappy" },
  { id: "breathing", emoji: "🫁", label: "Breathe" },
];

export default function RestTimerModal({
  visible,
  seconds,
  onClose,
  notification,
  currentGame,
  onGameChange,
}: RestTimerModalProps) {
  const colors = useColors();
  const [remaining, setRemaining] = useState(seconds);
  const totalRef = useRef(seconds);
  const [showNotif, setShowNotif] = useState(false);
  const notifKey = useRef(0);

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setRemaining(seconds);
      totalRef.current = seconds;
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

  // ── Notification card lifecycle ────────────────────────────────────────────
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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            { backgroundColor: colors.card, borderColor: colors.border },
            hasGame && { width: GAME_W + 32 },
          ]}
        >
          {/* Notification card — slides in from above */}
          {showNotif && notification && (
            <NotificationCard key={notifKey.current} notification={notification} />
          )}

          {hasGame ? (
            // ── Compact timer bar when a game is open ─────────────────────
            <View style={[styles.compactBar, { borderBottomColor: colors.border }]}>
              <Text style={[styles.compactTime, { color: colors.foreground }]}>
                {mins}:{secs.toString().padStart(2, "0")}
              </Text>
              <TouchableOpacity
                style={[styles.compactAdj, { backgroundColor: colors.muted }]}
                onPress={() => adjustTime(-10)}
              >
                <Text style={[styles.compactAdjText, { color: colors.foreground }]}>-10s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.compactSkip, { backgroundColor: colors.muted }]}
                onPress={onClose}
              >
                <Text style={[styles.compactSkipText, { color: colors.foreground }]}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.compactAdj, { backgroundColor: colors.muted }]}
                onPress={() => adjustTime(10)}
              >
                <Text style={[styles.compactAdjText, { color: colors.foreground }]}>+10s</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── Full circular ring when no game is open ────────────────────
            <View style={styles.ringWrap}>
              <Text style={[styles.restLabel, { color: colors.mutedForeground }]}>REST</Text>
              <View
                style={{
                  width: RING_SIZE, height: RING_SIZE,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  {/* Background track */}
                  <Circle
                    cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                    stroke={colors.muted} strokeWidth={RING_SW} fill="none"
                  />
                  {/* Progress arc */}
                  <Circle
                    cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                    stroke={colors.primary} strokeWidth={RING_SW} fill="none"
                    strokeDasharray={`${CIRCUMFERENCE}`}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    transform={`rotate(-90, ${RING_SIZE / 2}, ${RING_SIZE / 2})`}
                  />
                </Svg>
                <View
                  style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
                  pointerEvents="none"
                >
                  <Text style={[styles.restTime, { color: colors.foreground }]}>
                    {mins}:{secs.toString().padStart(2, "0")}
                  </Text>
                </View>
              </View>

              {/* ±10s and skip */}
              <View style={styles.adjRow}>
                <TouchableOpacity
                  style={[styles.adjBtn, { backgroundColor: colors.muted }]}
                  onPress={() => adjustTime(-10)}
                >
                  <Text style={[styles.adjText, { color: colors.foreground }]}>-10s</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.skipBtn, { backgroundColor: colors.muted }]}
                  onPress={onClose}
                >
                  <Text style={[styles.skipText, { color: colors.foreground }]}>Skip Rest</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adjBtn, { backgroundColor: colors.muted }]}
                  onPress={() => adjustTime(10)}
                >
                  <Text style={[styles.adjText, { color: colors.foreground }]}>+10s</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Game content */}
          {activeGame === "snake" && <SnakeGame active={visible && activeGame === "snake"} />}
          {activeGame === "flappy" && <FlappyBirdGame active={visible && activeGame === "flappy"} />}
          {activeGame === "breathing" && <BoxBreathingGame active={visible && activeGame === "breathing"} />}

          {/* Game selector tabs */}
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
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
                <Text style={[styles.gameTabLabel, { color: activeGame === id ? colors.primary : colors.mutedForeground }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    borderRadius: 24,
    borderWidth: 1,
    width: 300,
    overflow: "hidden",
  },

  // Notification card
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 14,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  notifEmoji: { fontSize: 26 },
  notifTitle: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  notifMsg: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Full ring layout
  ringWrap: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  restLabel: {
    fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 2,
  },
  restTime: { fontSize: 42, fontWeight: "700", fontFamily: "Inter_700Bold" },
  adjRow: { flexDirection: "row", gap: 8 },
  adjBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100 },
  adjText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  skipBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 100 },
  skipText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Compact bar (when game is open)
  compactBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactTime: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold", minWidth: 56 },
  compactAdj: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 100 },
  compactAdjText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  compactSkip: { flex: 1, paddingVertical: 7, borderRadius: 100, alignItems: "center" },
  compactSkipText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },

  // Shared game wrapper
  gameWrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 6, alignItems: "center" },
  gameScore: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", alignSelf: "flex-start" },
  gameHint: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Snake
  snakeGrid: { borderRadius: 8, overflow: "hidden" },
  gameOver: { alignItems: "center", justifyContent: "center", gap: 4 },
  gameOverText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  gameOverSub: { color: "#ffffffcc", fontSize: 12, fontFamily: "Inter_400Regular" },

  // D-pad
  dpad: { alignItems: "center" },
  dpadBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dpadRow: { flexDirection: "row", alignItems: "center" },
  dpadCenter: { width: 22, height: 22, borderRadius: 11 },

  // Flappy
  flappyCanvas: { borderRadius: 8 },

  // Box breathing
  breathCount: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  breathLabel: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  breathSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  breathHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },

  // Game tabs
  gameTabs: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  gameTab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  gameTabLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
