import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, TextInput, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSocial, UserProfile } from "@/context/SocialContext";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs } from "@firebase/firestore";
import { db } from "@/lib/firebase";

type FollowState = "none" | "following" | "requested";

function FollowRequestCard({
  request,
  onApprove,
  onDeny,
}: {
  request: { id: string; requesterName: string; requesterHandle: string };
  onApprove: () => void;
  onDeny: () => void;
}) {
  const colors = useColors();
  const initials = request.requesterName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
  return (
    <View style={[styles.requestCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
      <View style={[styles.personAvatar, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.personAvatarText, { color: colors.primary }]}>{initials}</Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={[styles.personName, { color: colors.foreground }]}>{request.requesterName}</Text>
        <Text style={[styles.personHandle, { color: colors.mutedForeground }]}>@{request.requesterHandle}</Text>
        <Text style={[styles.requestLabel, { color: colors.primary }]}>wants to follow you</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.reqBtn, { backgroundColor: colors.primary }]}
          onPress={onApprove}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.reqBtn, { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }]}
          onPress={onDeny}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PersonCard({
  person,
  followState,
  onFollow,
  onUnfollow,
}: {
  person: UserProfile;
  followState: FollowState;
  onFollow: () => void;
  onUnfollow: () => void;
}) {
  const colors = useColors();
  const initials = person.displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();

  const handlePress = () => {
    if (followState === "following") {
      Alert.alert("Unfollow", `Unfollow @${person.handle}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Unfollow", style: "destructive", onPress: onUnfollow },
      ]);
    } else if (followState === "none") {
      onFollow();
    }
  };

  const btnBg =
    followState === "following"
      ? colors.muted
      : followState === "requested"
      ? colors.muted
      : colors.primary;
  const btnBorder =
    followState === "following" || followState === "requested" ? colors.border : colors.primary;
  const btnTextColor =
    followState === "following" || followState === "requested"
      ? colors.foreground
      : colors.primaryForeground;
  const btnLabel =
    followState === "following" ? "Following" : followState === "requested" ? "Requested" : "Follow";

  return (
    <View style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.personAvatar, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.personAvatarText, { color: colors.primary }]}>{initials}</Text>
      </View>
      <View style={styles.personInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.personName, { color: colors.foreground }]}>{person.displayName}</Text>
          {person.isPrivate && (
            <Ionicons name="lock-closed" size={12} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={[styles.personHandle, { color: colors.mutedForeground }]}>@{person.handle}</Text>
        {person.bio ? (
          <Text style={[styles.personBio, { color: colors.mutedForeground }]} numberOfLines={1}>
            {person.bio}
          </Text>
        ) : null}
        <View style={styles.personStats}>
          <Text style={[styles.personMetaText, { color: colors.mutedForeground }]}>
            {person.followersCount} followers
          </Text>
          <Text style={[styles.personMetaText, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.personMetaText, { color: colors.mutedForeground }]}>
            {person.postsCount} posts
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
        onPress={handlePress}
        disabled={followState === "requested"}
        activeOpacity={0.8}
      >
        {followState === "requested" ? (
          <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
        ) : null}
        <Text style={[styles.followBtnText, { color: btnTextColor }]}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PeopleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const {
    following,
    pendingFollowRequests,
    followUser,
    unfollowUser,
    approveFollowRequest,
    denyFollowRequest,
    getAllUsers,
    blockedUsers,
  } = useSocial();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [outgoingPending, setOutgoingPending] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const loadData = useCallback(async () => {
    if (!uid) return;
    try {
      const [allUsers, reqSnap] = await Promise.all([
        getAllUsers(),
        getDocs(
          query(collection(db, "followRequests"), where("requesterId", "==", uid), where("status", "==", "pending"))
        ),
      ]);
      setUsers(allUsers);
      setOutgoingPending(new Set(reqSnap.docs.map((d) => d.data().targetId as string)));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleFollow = async (person: UserProfile) => {
    try {
      await followUser(person.id, person.isPrivate);
      if (person.isPrivate) {
        setOutgoingPending((prev) => new Set([...prev, person.id]));
      }
    } catch {
      Alert.alert("Error", "Could not follow. Please try again.");
    }
  };

  const handleUnfollow = async (personId: string) => {
    try {
      await unfollowUser(personId);
      setOutgoingPending((prev) => {
        const next = new Set(prev);
        next.delete(personId);
        return next;
      });
    } catch {
      Alert.alert("Error", "Could not unfollow. Please try again.");
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await approveFollowRequest(requestId);
    } catch {
      Alert.alert("Error", "Could not approve request.");
    }
  };

  const handleDeny = async (requestId: string) => {
    try {
      await denyFollowRequest(requestId);
    } catch {
      Alert.alert("Error", "Could not deny request.");
    }
  };

  const getFollowState = (personId: string): FollowState => {
    if (following.includes(personId)) return "following";
    if (outgoingPending.has(personId)) return "requested";
    return "none";
  };

  const filtered = users.filter((u) => {
    if (blockedUsers.includes(u.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q);
  });

  const hasPendingRequests = pendingFollowRequests.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>People</Text>
        {hasPendingRequests && (
          <View style={[styles.requestBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.requestBadgeText, { color: colors.primaryForeground }]}>
              {pendingFollowRequests.length}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search athletes..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            hasPendingRequests ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  FOLLOW REQUESTS
                </Text>
                {pendingFollowRequests.map((req) => (
                  <FollowRequestCard
                    key={req.id}
                    request={req}
                    onApprove={() => handleApprove(req.id)}
                    onDeny={() => handleDeny(req.id)}
                  />
                ))}
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>
                  DISCOVER ATHLETES
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PersonCard
              person={item}
              followState={getFollowState(item.id)}
              onFollow={() => handleFollow(item)}
              onUnfollow={() => handleUnfollow(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="person-outline" size={44} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {search ? "No results" : "No athletes yet"}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                {search ? "Try a different search" : "Be the first to join!"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  requestBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  requestBadgeText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionLabel: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 8 },
  requestCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  personCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  personAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  personAvatarText: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  personInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  personName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  personHandle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  personBio: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  personStats: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  personMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  followBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  followBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  requestActions: { flexDirection: "row", gap: 8 },
  reqBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  requestLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
