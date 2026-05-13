import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
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

type Tab = "overview" | "reports" | "users";

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

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalWorkouts: 0, totalPosts: 0, totalGroups: 0, pendingReports: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.isAdmin) {
      Alert.alert("Access denied", "You don't have admin access.");
      router.back();
      return;
    }
    loadData();
  }, [appUser]);

  const loadData = async () => {
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

      setUsers(userSnap.docs.map((d) => d.data()));
    } catch (e) {
      Alert.alert("Error", "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (reportId: string) => {
    await updateDoc(doc(db, "reports", reportId), { status: "resolved" });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "resolved" } : r));
  };

  const dismissReport = async (reportId: string) => {
    await updateDoc(doc(db, "reports", reportId), { status: "dismissed" });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "dismissed" } : r));
  };

  const deleteContent = async (report: Report) => {
    Alert.alert("Delete content", "This will permanently delete the reported content.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const collectionName = report.contentType === "post" ? "posts" : "users";
          await deleteDoc(doc(db, collectionName, report.contentId));
          await resolveReport(report.id);
        },
      },
    ]);
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    await updateDoc(doc(db, "users", userId), { isAdmin: !isAdmin });
    setUsers((prev) => prev.map((u) => u.uid === userId ? { ...u, isAdmin: !isAdmin } : u));
  };

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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Dashboard</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["overview", "reports", "users"] as Tab[]).map((tab) => (
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

        {activeTab === "reports" && (
          <View>
            <Text style={styles.sectionTitle}>Reports</Text>
            {reports.length === 0 ? (
              <Text style={styles.empty}>No reports yet.</Text>
            ) : (
              reports.map((report) => (
                <View key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportType}>{report.contentType.toUpperCase()}</Text>
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
                  <Text style={styles.reportId}>Content ID: {report.contentId.slice(0, 12)}...</Text>
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

        {activeTab === "users" && (
          <View>
            <Text style={styles.sectionTitle}>Users ({users.length})</Text>
            {users.map((u) => (
              <View key={u.uid} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.displayName}</Text>
                  <Text style={styles.userHandle}>@{u.handle}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.adminBtn, u.isAdmin && styles.adminBtnActive]}
                  onPress={() => toggleAdmin(u.uid, u.isAdmin)}
                >
                  <Text style={styles.adminBtnText}>{u.isAdmin ? "Admin ✓" : "Make Admin"}</Text>
                </TouchableOpacity>
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
  back: { color: "#FF4500", fontSize: 16 },
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
  empty: { color: "#666", textAlign: "center", marginTop: 32 },
  reportCard: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12 },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  reportType: { color: "#FF4500", fontSize: 12, fontWeight: "700" },
  reportStatus: { fontSize: 12, fontWeight: "700" },
  reportReason: { color: "#fff", fontSize: 14, marginBottom: 4 },
  reportId: { color: "#666", fontSize: 11, marginBottom: 12 },
  reportActions: { flexDirection: "row", gap: 8 },
  actionBtn: { backgroundColor: "#22c55e", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  dangerBtn: { backgroundColor: "#ef4444" },
  dimBtn: { backgroundColor: "#555" },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  userCard: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  userInfo: { flex: 1 },
  userName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  userHandle: { color: "#888", fontSize: 12 },
  userEmail: { color: "#666", fontSize: 11, marginTop: 2 },
  adminBtn: { backgroundColor: "#333", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  adminBtnActive: { backgroundColor: "#FF4500" },
  adminBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
