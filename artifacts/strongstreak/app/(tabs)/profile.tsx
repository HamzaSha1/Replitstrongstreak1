import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Modal, Switch, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/context/SocialContext";
import { useWorkout } from "@/context/WorkoutContext";
import { format, parseISO } from "date-fns";
import { SESSION_COLORS } from "@/components/ExerciseData";

function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { myProfile, updateProfile } = useSocial();
  const [displayName, setDisplayName] = useState(myProfile.displayName);
  const [handle, setHandle] = useState(myProfile.handle);
  const [bio, setBio] = useState(myProfile.bio);
  const [isPrivate, setIsPrivate] = useState(myProfile.isPrivate);

  const handleSave = async () => {
    await updateProfile({ displayName, handle: handle.replace("@", ""), bio, isPrivate });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: (insets.top || 20) + 20 }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Display Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Username</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              value={handle}
              onChangeText={setHandle}
              placeholder="username"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Bio</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, minHeight: 80, textAlignVertical: "top" }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell the world about your fitness journey..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
          </View>

          <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Private Account</Text>
              <Text style={[styles.settingDesc, { color: colors.mutedForeground }]}>Only followers see your posts</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { myProfile } = useSocial();
  const { workoutLogs, streak, longestStreak } = useWorkout();
  const [editVisible, setEditVisible] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const initials = myProfile.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const recentLogs = workoutLogs.slice(0, 5);
  const totalMinutes = workoutLogs.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
        <TouchableOpacity onPress={() => setEditVisible(true)}>
          <Ionicons name="pencil-outline" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.avatarLargeText, { color: colors.primary }]}>{initials}</Text>
          </View>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{myProfile.displayName}</Text>
          <Text style={[styles.profileHandle, { color: colors.primary }]}>@{myProfile.handle}</Text>
          {myProfile.bio ? (
            <Text style={[styles.profileBio, { color: colors.mutedForeground }]}>{myProfile.bio}</Text>
          ) : null}
          {myProfile.isPrivate && (
            <View style={[styles.privateBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="lock-closed" size={11} color={colors.mutedForeground} />
              <Text style={[styles.privateBadgeText, { color: colors.mutedForeground }]}>Private</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="flame" size={20} color="#F97316" />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Streak</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="trophy" size={20} color="#F59E0B" />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{longestStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Best</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="barbell" size={20} color={colors.primary} />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{workoutLogs.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Sessions</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="time" size={20} color={colors.purple} />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{Math.round(totalMinutes / 60)}h</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total</Text>
          </View>
        </View>

        {recentLogs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Recent Activity</Text>
            {recentLogs.map((log) => {
              const color = SESSION_COLORS[log.sessionType] ?? colors.primary;
              return (
                <View key={log.id} style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.activityDot, { backgroundColor: color }]} />
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityType, { color: colors.foreground }]}>{log.sessionType}</Text>
                    <Text style={[styles.activityMeta, { color: colors.mutedForeground }]}>
                      {format(parseISO(log.startedAt), "MMM d")} · {log.durationMinutes ?? "—"}min · {log.setLogs.length} sets
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <EditProfileModal visible={editVisible} onClose={() => setEditVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  scrollContent: { padding: 16, gap: 12 },
  profileSection: { alignItems: "center", paddingVertical: 20, gap: 6 },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  avatarLargeText: { fontSize: 30, fontWeight: "700", fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  profileHandle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  profileBio: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 40, marginTop: 2 },
  privateBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, borderWidth: 1, marginTop: 4,
  },
  privateBadgeText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: { flex: 1, minWidth: "45%", alignItems: "center", padding: 16, borderRadius: 14, borderWidth: 1, gap: 4 },
  statNum: { fontSize: 24, fontWeight: "700", fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  activityCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  activityDot: { width: 10, height: 10, borderRadius: 5 },
  activityInfo: { flex: 1 },
  activityType: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  activityMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  saveText: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", paddingLeft: 4 },
  textInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
  settingRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  settingLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  settingDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
