import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useWorkout } from "@/context/WorkoutContext";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  DAYS, SESSION_TYPES, SESSION_COLORS, EXERCISE_LIBRARY, ALL_EXERCISES,
} from "@/components/ExerciseData";
import type { Split, SplitDay, Exercise } from "@/context/WorkoutContext";

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function ExercisePickerModal({ visible, sessionType, onAdd, onClose }: {
  visible: boolean; sessionType: string; onAdd: (ex: Exercise) => void; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All");

  const muscleGroups = ["All", ...Object.keys(EXERCISE_LIBRARY)];

  const exercises = selectedGroup === "All"
    ? ALL_EXERCISES.filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()))
    : (EXERCISE_LIBRARY[selectedGroup] ?? []).filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (template: any) => {
    onAdd({
      id: generateId(),
      name: template.name,
      muscleGroup: template.muscleGroup,
      sets: template.defaultSets,
      reps: template.defaultReps,
      weight: 0,
      unit: "kg" as const,
      restSeconds: 90,
      notes: "",
      type: template.type,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.exerciseModal, { backgroundColor: colors.background, paddingTop: (insets.top || 20) + 20 }]}>
        <View style={[styles.exerciseModalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.mutedForeground} /></TouchableOpacity>
          <Text style={[styles.exerciseModalTitle, { color: colors.foreground }]}>Add Exercise</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.searchBarWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search exercises..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.groupPillsScroll, { borderBottomColor: colors.border }]}>
          <View style={styles.groupPills}>
            {muscleGroups.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.groupPill, { backgroundColor: selectedGroup === g ? colors.primary : colors.muted, borderColor: selectedGroup === g ? colors.primary : colors.border }]}
                onPress={() => setSelectedGroup(g)}
              >
                <Text style={[styles.groupPillText, { color: selectedGroup === g ? colors.primaryForeground : colors.mutedForeground }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <FlatList
          data={exercises}
          keyExtractor={(item) => item.name}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.exerciseListItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleAdd(item)}
              activeOpacity={0.7}
            >
              <View style={styles.exerciseListInfo}>
                <Text style={[styles.exerciseListName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.exerciseListMeta, { color: colors.mutedForeground }]}>
                  {item.muscleGroup} · {item.defaultSets}×{item.defaultReps}
                </Text>
              </View>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

function DaySection({ day, onUpdateDay, onAddExercise }: {
  day: SplitDay;
  onUpdateDay: (updated: SplitDay) => void;
  onAddExercise: (dayId: string) => void;
}) {
  const colors = useColors();
  const [isOpen, setIsOpen] = useState(false);
  const isCustomType = !SESSION_TYPES.includes(day.sessionType) && day.sessionType !== "";
  const [showCustomInput, setShowCustomInput] = useState(isCustomType);
  const [customName, setCustomName] = useState(isCustomType ? day.sessionType : "");
  const color = SESSION_COLORS[day.sessionType] ?? colors.primary;

  const removeExercise = (exId: string) => {
    onUpdateDay({ ...day, exercises: day.exercises.filter((e) => e.id !== exId) });
  };

  const handleSessionTypePress = (type: string) => {
    if (type === "Custom") {
      // Don't change sessionType yet — just show the input
      setShowCustomInput(true);
      setCustomName("");
    } else {
      setShowCustomInput(false);
      setCustomName("");
      onUpdateDay({ ...day, sessionType: type });
    }
  };

  const handleCustomNameSave = () => {
    const trimmed = customName.trim();
    if (trimmed) {
      onUpdateDay({ ...day, sessionType: trimmed });
      setShowCustomInput(false);
    }
  };

  const isCustomPillActive = showCustomInput || isCustomType;

  return (
    <View style={[styles.daySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.daySectionHeader}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <View style={[styles.dayDot, { backgroundColor: color }]} />
        <View style={styles.daySectionInfo}>
          <Text style={[styles.daySectionDay, { color: colors.foreground }]}>{day.dayOfWeek}</Text>
          {day.sessionType ? (
            <View style={[styles.sessionTypePill, { backgroundColor: color + "22", borderColor: color + "44" }]}>
              <Text style={[styles.sessionTypePillText, { color }]}>{day.sessionType}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.daySectionRight}>
          {day.exercises.length > 0 && (
            <Text style={[styles.exerciseCountBadge, { color: colors.mutedForeground }]}>{day.exercises.length}</Text>
          )}
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={[styles.daySectionBody, { borderTopColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sessionTypeScroll}>
            <View style={styles.sessionTypePills}>
              {SESSION_TYPES.map((type) => {
                const isActive = type === "Custom" ? isCustomPillActive : day.sessionType === type;
                const activeColor = SESSION_COLORS[type] ?? colors.primary;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sessionTypeOption, { backgroundColor: isActive ? activeColor : colors.muted, borderColor: isActive ? activeColor : colors.border }]}
                    onPress={() => handleSessionTypePress(type)}
                  >
                    <Text style={[styles.sessionTypeOptionText, { color: isActive ? "#fff" : colors.mutedForeground }]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {showCustomInput && (
            <View style={styles.customNameRow}>
              <TextInput
                style={[styles.customNameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. Arms, Chest & Back…"
                placeholderTextColor={colors.mutedForeground}
                value={customName}
                onChangeText={setCustomName}
                onSubmitEditing={handleCustomNameSave}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.customNameSaveBtn, { backgroundColor: colors.primary }]}
                onPress={handleCustomNameSave}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {day.exercises.map((ex) => (
            <View key={ex.id} style={[styles.exerciseItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.exerciseItemInfo}
                onPress={() => router.push(`/exercise-history?name=${encodeURIComponent(ex.name)}`)}
                activeOpacity={0.7}
              >
                <Text style={[styles.exerciseItemName, { color: colors.foreground }]}>{ex.name}</Text>
                <Text style={[styles.exerciseItemMeta, { color: colors.mutedForeground }]}>{ex.sets}×{ex.reps} · {ex.restSeconds}s rest</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ))}

          {day.sessionType && day.sessionType !== "Rest" && (
            <TouchableOpacity
              style={[styles.addExBtn, { borderColor: colors.border }]}
              onPress={() => onAddExercise(day.id)}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[styles.addExBtnText, { color: colors.primary }]}>Add exercise</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function SplitBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addSplit, splits, updateSplit } = useWorkout();
  const { splitId } = useLocalSearchParams<{ splitId?: string }>();

  const existing = splitId ? splits.find((s) => s.id === splitId) : null;

  const initDays = (): SplitDay[] =>
    DAYS.map((d) => ({ id: generateId(), dayOfWeek: d, sessionType: "", exercises: [] }));

  const [splitName, setSplitName] = useState(existing?.name ?? "");
  const [days, setDays] = useState<SplitDay[]>(existing?.days ?? initDays());
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const pickerDay = days.find((d) => d.id === pickerDayId);

  const handleUpdateDay = (updated: SplitDay) => {
    setDays((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleAddExercise = (ex: Exercise) => {
    if (!pickerDayId) return;
    setDays((prev) =>
      prev.map((d) => (d.id === pickerDayId ? { ...d, exercises: [...d.exercises, ex] } : d))
    );
  };

  const handleSave = async () => {
    if (!splitName.trim()) {
      Alert.alert("Name required", "Please enter a split name.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (existing) {
      await updateSplit({ ...existing, name: splitName.trim(), days });
    } else {
      await addSplit({ name: splitName.trim(), days });
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{existing ? "Edit Split" : "New Split"}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: splitName.trim() ? colors.primary : colors.muted }]}
          onPress={handleSave}
          disabled={!splitName.trim()}
        >
          <Text style={[styles.saveBtnText, { color: splitName.trim() ? colors.primaryForeground : colors.mutedForeground }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          style={[styles.nameInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          placeholder="Split name (e.g. Push Pull Legs)"
          placeholderTextColor={colors.mutedForeground}
          value={splitName}
          onChangeText={setSplitName}
          returnKeyType="done"
        />

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Configure each day</Text>

        {days.map((day) => (
          <DaySection
            key={day.id}
            day={day}
            onUpdateDay={handleUpdateDay}
            onAddExercise={(id) => setPickerDayId(id)}
          />
        ))}
      </ScrollView>

      <ExercisePickerModal
        visible={!!pickerDayId}
        sessionType={pickerDay?.sessionType ?? ""}
        onAdd={handleAddExercise}
        onClose={() => setPickerDayId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  saveBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  scrollContent: { padding: 16, gap: 10 },
  nameInput: { borderRadius: 14, borderWidth: 1, padding: 16, fontSize: 17, fontFamily: "Inter_500Medium" },
  sectionLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4 },
  daySection: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  daySectionHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  dayDot: { width: 8, height: 8, borderRadius: 4 },
  daySectionInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  daySectionDay: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  sessionTypePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  sessionTypePillText: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  daySectionRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  exerciseCountBadge: { fontSize: 13, fontFamily: "Inter_400Regular" },
  daySectionBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  sessionTypeScroll: { marginBottom: 8 },
  sessionTypePills: { flexDirection: "row", gap: 6 },
  sessionTypeOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },
  sessionTypeOptionText: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  customNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  customNameInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_500Medium" },
  customNameSaveBtn: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  exerciseItem: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12 },
  exerciseItemInfo: { flex: 1 },
  exerciseItemName: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  exerciseItemMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addExBtn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", justifyContent: "center" },
  addExBtnText: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  exerciseModal: { flex: 1 },
  exerciseModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  exerciseModalTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  searchBarWrap: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  groupPillsScroll: { maxHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth },
  groupPills: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  groupPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, borderWidth: 1 },
  groupPillText: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  exerciseListItem: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14 },
  exerciseListInfo: { flex: 1 },
  exerciseListName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  exerciseListMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
