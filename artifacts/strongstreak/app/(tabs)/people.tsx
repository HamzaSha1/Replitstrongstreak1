import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/context/SocialContext";
import { useWorkout } from "@/context/WorkoutContext";

const SAMPLE_PEOPLE = [
  { id: "u1", displayName: "Alex Fitness", handle: "alexfitness", bio: "PPL fanatic. 4 years lifting.", streak: 18, followers: 42, following: 31 },
  { id: "u2", displayName: "Sarah Lifts", handle: "sarahlifts", bio: "Powerlifter. Nutrition coach.", streak: 32, followers: 128, following: 56 },
  { id: "u3", displayName: "Marcus Power", handle: "marcuspower", bio: "Bodybuilding competitor.", streak: 7, followers: 89, following: 44 },
  { id: "u4", displayName: "Jordan Run", handle: "jordanrun", bio: "Cardio + strength hybrid athlete.", streak: 60, followers: 210, following: 88 },
  { id: "u5", displayName: "Emma Yoga", handle: "emmayoga", bio: "Mindful movement every day.", streak: 90, followers: 305, following: 120 },
];

function PersonCard({ person, isFollowing, onFollow }: { person: any; isFollowing: boolean; onFollow: () => void }) {
  const colors = useColors();
  const initials = person.displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();

  return (
    <View style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.personAvatar, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.personAvatarText, { color: colors.primary }]}>{initials}</Text>
      </View>
      <View style={styles.personInfo}>
        <Text style={[styles.personName, { color: colors.foreground }]}>{person.displayName}</Text>
        <Text style={[styles.personHandle, { color: colors.mutedForeground }]}>@{person.handle}</Text>
        {person.bio ? (
          <Text style={[styles.personBio, { color: colors.mutedForeground }]} numberOfLines={1}>{person.bio}</Text>
        ) : null}
        <View style={styles.personStats}>
          <View style={[styles.streakPill, { backgroundColor: colors.muted }]}>
            <Ionicons name="flame" size={12} color="#F97316" />
            <Text style={[styles.streakPillText, { color: colors.foreground }]}>{person.streak}</Text>
          </View>
          <Text style={[styles.personMetaText, { color: colors.mutedForeground }]}>{person.followers} followers</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, {
          backgroundColor: isFollowing ? colors.muted : colors.primary,
          borderColor: isFollowing ? colors.border : colors.primary,
        }]}
        onPress={onFollow}
        activeOpacity={0.8}
      >
        <Text style={[styles.followBtnText, { color: isFollowing ? colors.foreground : colors.primaryForeground }]}>
          {isFollowing ? "Following" : "Follow"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PeopleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { following, updateProfile } = useSocial();
  const [search, setSearch] = useState("");
  const [localFollowing, setLocalFollowing] = useState<Set<string>>(new Set());

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = search.trim()
    ? SAMPLE_PEOPLE.filter(
        (p) =>
          p.displayName.toLowerCase().includes(search.toLowerCase()) ||
          p.handle.toLowerCase().includes(search.toLowerCase())
      )
    : SAMPLE_PEOPLE;

  const handleFollow = (personId: string) => {
    setLocalFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>People</Text>
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

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 90, gap: 10 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            isFollowing={localFollowing.has(item.id)}
            onFollow={() => handleFollow(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="person-outline" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  personCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  personAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  personAvatarText: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  personInfo: { flex: 1, gap: 2 },
  personName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  personHandle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  personBio: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  personStats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  streakPillText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  personMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  followBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  followBtnText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
