import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
} from "@firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type MainTab = "overview" | "reports" | "users";
type ReportFilter = "all" | "pending" | "resolved" | "dismissed";

interface Report {
  id: string;
  reporterId: string;
  contentType: "post" | "user";
  contentId: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalWorkouts: number;
  totalPosts: number;
  totalGroups: number;
  pendingReports: number;
}

interface UserRecord {
  uid: string;
  displayName: string;
  handle: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  followersCount: number;
  postsCount: number;
}

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>("overview");
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalWorkouts: 0, totalPosts: 0, totalGroups: 0, pendingReports: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<ReportFilter>("all");
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (!appUser?.isAdmin) {
      Alert.alert("Access denied", "You don't have admin access.");
      router.back();
      return;
    }
    loadData();
  }, [appUser]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [userSnap, workoutSnap, postSnap, groupSnap, reportSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "workoutLogs")),
        getDocs(collection(db, "posts")),
        getDocs(collection(db, "groups")),
        getDocs(query(collection(db, "reports"), where("status", "==", "pending"))),
      ]);

      setStats({
        totalUsers: userSnap.size,
        totalWorkouts: workoutSnap.size,
        totalPosts: postSnap.size,
        totalGroups: groupSnap.size,
        pendingReports: reportSnap.size,
      });

      const allReports = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
      setReports(allReports.docs.map((d) => d.data() as Report));

      setUsers(
        userSnap.docs.map((d) => {
          const u = d.data();
          return {
            uid: u.uid,
            displayName: u.displayName ?? "",
            handle: u.handle ?? "",
            email: u.email ?? "",
            isAdmin: u.isAdmin ?? false,
            createdAt: u.createdAt ?? "",
            followersCount: u.followersCount ?? 0,
            postsCount: u.postsCount ?? 0,
          } as UserRecord;
        })
      );
    } catch {
      Alert.alert("Error", "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveReport = async (reportId: string) => {
    await updateDoc(doc(db, "reports", reportId), { status: "resolved" });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "resolved" } : r));
    setStats((s) => ({ ...s, pendingReports: Math.max(0, s.pendingReports - 1) }));
  };

  const dismissReport = async (reportId: string) => {
    await updateDoc(doc(db, "reports", reportId), { status: "dismissed" });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "dismissed" } : r));
    setStats((s) => ({ ...s, pendingReports: Math.max(0, s.pendingReports - 1) }));
  };

  const deleteContent = async (report: Report) => {
    Alert.alert("Delete content", "This will permanently delete the reported content.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const col = report.contentType === "post" ? "posts" : "users";
          await deleteDoc(doc(db, col, report.contentId));
          await resolveReport(report.id);
        },
      },
    ]);
  };

  const toggleAdmin = async (uid: string, isAdmin: boolean) => {
    const action = isAdmin ? "Remove admin" : "Make admin";
    Alert.alert(action, `${action} for this user?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        onPress: async () => {
          await updateDoc(doc(db, "users", uid), { isAdmin: !isAdmin });
          setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, isAdmin: !isAdmin } : u));
        },
      },
    ]);
  };

  const deleteUser = async (uid: string, displayName: string) => {
    Alert.alert(
      "Delete user",
      `Permanently delete ${displayName} and all their data? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", uid));
              setUsers((prev) => prev.filter((u) => u.uid !== uid));
              setStats((s) => ({ ...s, totalUsers: s.totalUsers - 1 }));
            } catch {
              Alert.alert("Error", "Could not delete user.");
            }
          },
        },
      ]
    );
  };

  const filteredReports = reports.filter((r) =>
    reportFilter === "all" ? true : r.status === reportFilter
  );

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.handle.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF4500" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FF4500" />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={loadData} style={styles.backBtn}>
          <Ionicons name="refresh" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Main tabs */}
      <View style={styles.tabs}>
        {(["overview", "reports", "users"] as MainTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "reports" && stats.pendingReports > 0 ? ` (${stats.pendingReports})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <View>
            <Text style={styles.sectionTitle}>Platform Stats</Text>
            <View style={styles.statsGrid}>
              {[
                { label: "Users", value: stats.totalUsers, icon: "👤" },
                { label: "Workouts", value: stats.totalWorkouts, icon: "🏋️" },
                { label: "Posts", value: stats.totalPosts, icon: "📸" },
                { label: "Groups", value: stats.totalGroups, icon: "👥" },
                { label: "Pending Reports", value: stats.pendingReports, icon: "🚨" },
              ].map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <Text style={styles.statIcon}>{item.icon}</Text>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* REPORTS */}
        {activeTab === "reports" && (
          <View>
            {/* Filter pills */}
            <View style={styles.filterRow}>
              {(["all", "pending", "resolved", "dismissed"] as ReportFilter[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, reportFilter === f && styles.filterPillActive]}
                  onPress={() => setReportFilter(f)}
                >
                  <Text style={[styles.filterPillText, reportFilter === f && styles.filterPillTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === "pending" && stats.pendingReports > 0 ? ` · ${stats.pendingReports}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredReports.length === 0 ? (
              <Text style={styles.empty}>No {reportFilter === "all" ? "" : reportFilter} reports.</Text>
            ) : (
              filteredReports.map((report) => (
                <View key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportTypeBadge}>
                      <Text style={styles.reportType}>{report.contentType.toUpperCase()}</Text>
                    </View>
                    <Text style={[
                      styles.reportStatus,
                      report.status === "pending" && { color: "#FF4500" },
                      report.status === "resolved" && { color: "#22c55e" },
                      report.status === "dismissed" && { color: "#888" },
                    ]}>
                      {report.status}
                    </Text>
                  </View>
                  <Text style={styles.reportReason}>{report.reason}</Text>
                  <Text style={styles.reportId}>
                    Content ID: {report.contentId.slice(0, 16)}...
                  </Text>
                  <Text style={styles.reportDate}>
                    {new Date(report.createdAt).toLocaleDateString()}
                  </Text>
                  {report.status === "pending" && (
                    <View style={styles.reportActions}>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => resolveReport(report.id)}>
                        <Text style={styles.actionBtnText}>Resolve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => deleteContent(report)}>
                        <Text style={styles.actionBtnText}>Delete Content</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, styles.dimBtn]} onPress={() => dismissReport(report.id)}>
                        <Text style={styles.actionBtnText}>Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* USERS */}
        {activeTab === "users" && (
          <View>
            {/* Search */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#666" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, handle, email..."
                placeholderTextColor="#555"
                value={userSearch}
                onChangeText={setUserSearch}
                autoCapitalize="none"
              />
              {userSearch.length > 0 && (
                <TouchableOpacity onPress={() => setUserSearch("")}>
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>
              Users ({filteredUsers.length}{userSearch ? ` of ${users.length}` : ""})
            </Text>

            {filteredUsers.map((u) => (
              <View key={u.uid} style={styles.userCard}>
                <View style={[styles.userAvatar, { backgroundColor: u.isAdmin ? "#FF450022" : "#1a1a1a" }]}>
                  <Text style={[styles.userAvatarText, { color: u.isAdmin ? "#FF4500" : "#888" }]}>
                    {u.displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() || "?"}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.userName}>{u.displayName}</Text>
                    {u.isAdmin && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userHandle}>@{u.handle}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <Text style={styles.userMeta}>{u.followersCount} followers · {u.postsCount} posts</Text>
                </View>
                <View style={styles.userActions}>
                  <TouchableOpacity
                    style={[styles.userActionBtn, u.isAdmin && styles.userActionBtnActive]}
                    onPress={() => toggleAdmin(u.uid, u.isAdmin)}
                  >
                    <Ionicons name={u.isAdmin ? "shield-checkmark" : "shield-outline"} size={14} color={u.isAdmin ? "#FF4500" : "#888"} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.userActionBtn, styles.deleteBtn]}
                    onPress={() => deleteUser(u.uid, u.displayName)}
                  >
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 18, fontWeight: "700" },
  tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#FF4500" },
  tabText: { color: "#888", fontSize: 14 },
  tabTextActive: { color: "#FF4500", fontWeight: "700" },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 16 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, alignItems: "center", width: "30%", minWidth: 90 },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#888", fontSize: 11, textAlign: "center", marginTop: 4 },
  // Report filters
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333" },
  filterPillActive: { backgroundColor: "#FF4500", borderColor: "#FF4500" },
  filterPillText: { color: "#888", fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: "#fff" },
  empty: { color: "#666", textAlign: "center", marginTop: 32 },
  reportCard: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12 },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reportTypeBadge: { backgroundColor: "#FF450020", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reportType: { color: "#FF4500", fontSize: 11, fontWeight: "700" },
  reportStatus: { fontSize: 12, fontWeight: "700" },
  reportReason: { color: "#fff", fontSize: 14, marginBottom: 4 },
  reportId: { color: "#666", fontSize: 11 },
  reportDate: { color: "#555", fontSize: 11, marginBottom: 12 },
  reportActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { backgroundColor: "#22c55e", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  dangerBtn: { backgroundColor: "#ef4444" },
  dimBtn: { backgroundColor: "#555" },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  // User search
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: "#333" },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  // User cards
  userCard: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontSize: 16, fontWeight: "700" },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  adminBadge: { backgroundColor: "#FF450020", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { color: "#FF4500", fontSize: 10, fontWeight: "700" },
  userHandle: { color: "#888", fontSize: 12, marginTop: 1 },
  userEmail: { color: "#666", fontSize: 11, marginTop: 1 },
  userMeta: { color: "#555", fontSize: 11, marginTop: 2 },
  userActions: { flexDirection: "column", gap: 6 },
  userActionBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#2a2a2a" },
  userActionBtnActive: { backgroundColor: "#FF450015" },
  deleteBtn: { backgroundColor: "#ef444415" },
});
