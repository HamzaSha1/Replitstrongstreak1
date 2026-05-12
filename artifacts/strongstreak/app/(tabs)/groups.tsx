import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Modal, Alert, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/context/SocialContext";
import * as Haptics from "expo-haptics";

function GroupCard({ group, isMember, onPress }: { group: any; isMember: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.groupCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.groupIcon, { backgroundColor: colors.primary + "20" }]}>
        <Ionicons name="people" size={22} color={colors.primary} />
      </View>
      <View style={styles.groupInfo}>
        <View style={styles.groupNameRow}>
          <Text style={[styles.groupName, { color: colors.foreground }]}>{group.name}</Text>
          {isMember && (
            <View style={[styles.memberBadge, { backgroundColor: colors.success + "20", borderColor: colors.success + "40" }]}>
              <Text style={[styles.memberBadgeText, { color: colors.success }]}>Member</Text>
            </View>
          )}
        </View>
        {group.description ? (
          <Text style={[styles.groupDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{group.description}</Text>
        ) : null}
        <View style={styles.groupMeta}>
          <Ionicons name="people-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.groupMetaText, { color: colors.mutedForeground }]}>{group.memberCount} members</Text>
          <Text style={[styles.groupMetaDot, { color: colors.border }]}>·</Text>
          <Text style={[styles.groupMetaText, { color: colors.mutedForeground }]}>{group.difficulty}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function GroupDetailModal({ group, isMember, visible, onClose }: { group: any; isMember: boolean; visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { leaveGroup } = useSocial();

  if (!group) return null;

  const sortedMembers = [...group.members].sort((a, b) => b.streak - a.streak);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.detailModal, { backgroundColor: colors.background, paddingTop: (insets.top || 20) + 20 }]}>
        <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.detailTitle, { color: colors.foreground }]}>{group.name}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={[styles.inviteCodeBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.inviteLabel, { color: colors.mutedForeground }]}>Invite Code</Text>
            <Text style={[styles.inviteCode, { color: colors.primary }]}>{group.inviteCode}</Text>
          </View>

          <Text style={[styles.leaderboardTitle, { color: colors.foreground }]}>Leaderboard</Text>

          {sortedMembers.map((member: any, i: number) => (
            <View key={member.userId} style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.memberRank, { color: i < 3 ? colors.primary : colors.mutedForeground }]}>#{i + 1}</Text>
              <Text style={[styles.memberName, { color: colors.foreground }]}>{member.displayName}</Text>
              <View style={[styles.memberStreak, { backgroundColor: colors.muted }]}>
                <Ionicons name="flame" size={12} color="#F97316" />
                <Text style={[styles.memberStreakText, { color: colors.foreground }]}>{member.streak}</Text>
              </View>
            </View>
          ))}

          {isMember && (
            <TouchableOpacity
              style={[styles.leaveBtn, { borderColor: colors.destructive + "50" }]}
              onPress={() => {
                Alert.alert("Leave group", `Leave ${group.name}?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Leave", style: "destructive", onPress: () => { leaveGroup(group.id); onClose(); } },
                ]);
              }}
            >
              <Text style={[styles.leaveBtnText, { color: colors.destructive }]}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CreateGroupModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createGroup } = useSocial();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [difficulty, setDifficulty] = useState("medium");

  const handleCreate = async () => {
    if (!name.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createGroup({ name: name.trim(), description: desc.trim(), createdBy: "local_user", difficulty });
    setName(""); setDesc(""); setDifficulty("medium");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.createModal, { backgroundColor: colors.background, paddingTop: (insets.top || 20) + 20 }]}>
        <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.mutedForeground} /></TouchableOpacity>
          <Text style={[styles.detailTitle, { color: colors.foreground }]}>Create Group</Text>
          <TouchableOpacity onPress={handleCreate}>
            <Text style={[styles.saveText, { color: name.trim() ? colors.primary : colors.mutedForeground }]}>Create</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Group name"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, minHeight: 80 }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.mutedForeground}
            value={desc}
            onChangeText={setDesc}
            multiline
          />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
          <View style={styles.difficultyRow}>
            {["easy", "medium", "hard"].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.diffOption, { backgroundColor: difficulty === d ? colors.primary : colors.muted, borderColor: difficulty === d ? colors.primary : colors.border }]}
                onPress={() => setDifficulty(d)}
              >
                <Text style={[styles.diffText, { color: difficulty === d ? colors.primaryForeground : colors.mutedForeground }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function JoinGroupModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { joinGroup } = useSocial();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = async () => {
    setError("");
    try {
      await joinGroup(code.trim().toUpperCase());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCode("");
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.createModal, { backgroundColor: colors.background, paddingTop: (insets.top || 20) + 20 }]}>
        <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.mutedForeground} /></TouchableOpacity>
          <Text style={[styles.detailTitle, { color: colors.foreground }]}>Join Group</Text>
          <TouchableOpacity onPress={handleJoin}>
            <Text style={[styles.saveText, { color: code.trim() ? colors.primary : colors.mutedForeground }]}>Join</Text>
          </TouchableOpacity>
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, textTransform: "uppercase", letterSpacing: 4, fontSize: 24, textAlign: "center" }]}
            placeholder="INVITE CODE"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

export default function GroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { groups, myGroups } = useSocial();
  const [createVisible, setCreateVisible] = useState(false);
  const [joinVisible, setJoinVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const myGroupObjs = groups.filter((g) => myGroups.includes(g.id));
  const discoverGroups = groups.filter((g) => !myGroups.includes(g.id));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => setJoinVisible(true)}
          >
            <Ionicons name="enter-outline" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setCreateVisible(true)}
          >
            <Ionicons name="add" size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {myGroupObjs.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>My Groups</Text>
            {myGroupObjs.map((g) => (
              <GroupCard key={g.id} group={g} isMember={true} onPress={() => setSelectedGroup(g)} />
            ))}
          </>
        )}

        {discoverGroups.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Discover</Text>
            {discoverGroups.map((g) => (
              <GroupCard key={g.id} group={g} isMember={false} onPress={() => setSelectedGroup(g)} />
            ))}
          </>
        )}

        {groups.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No groups yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Create or join a group to stay accountable</Text>
            <View style={styles.emptyBtnRow}>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => setCreateVisible(true)}
              >
                <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Create Group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => setJoinVisible(true)}
              >
                <Text style={[styles.emptyBtnText, { color: colors.foreground }]}>Join Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <CreateGroupModal visible={createVisible} onClose={() => setCreateVisible(false)} />
      <JoinGroupModal visible={joinVisible} onClose={() => setJoinVisible(false)} />
      {selectedGroup && (
        <GroupDetailModal
          group={selectedGroup}
          isMember={myGroups.includes(selectedGroup.id)}
          visible={!!selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
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
  headerActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  scrollContent: { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 4 },
  groupCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  groupIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1, gap: 4 },
  groupNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  memberBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, borderWidth: 1 },
  memberBadgeText: { fontSize: 10, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  groupDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  groupMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  groupMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  groupMetaDot: { fontSize: 12 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, borderWidth: 1 },
  emptyBtnText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  detailModal: { flex: 1 },
  detailHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  inviteCodeBox: { alignItems: "center", padding: 20, borderRadius: 16, borderWidth: 1, gap: 4 },
  inviteLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  inviteCode: { fontSize: 32, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 6 },
  leaderboardTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  memberRank: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", width: 32 },
  memberName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  memberStreak: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  memberStreakText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  leaveBtn: { padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  leaveBtnText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  createModal: { flex: 1 },
  textInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 16, fontFamily: "Inter_400Regular" },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  difficultyRow: { flexDirection: "row", gap: 8 },
  diffOption: { flex: 1, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  diffText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  saveText: { fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
});
