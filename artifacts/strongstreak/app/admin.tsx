import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Image,
} from "react-native";
import { router } from "expo-router";
import {
  collection, getDocs, query, where, updateDoc,
  deleteDoc, doc, orderBy, getDoc, setDoc,
} from "@firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";

type MainTab = "reports" | "users" | "analytics" | "settings";
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

// ─── Report Card ─────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onResolve,
  onDismiss,
  onDeleteContent,
}: {
  report: Report;
  onResolve: () => void;
  onDismiss: () => void;
  onDeleteContent: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [postPreview, setPostPreview] = useState<any>(null);
  const [reporterName, setReporterName] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!expanded) return;
    setLoadingPreview(true);
    try {
      const [reporterSnap, contentSnap] = await Promise.all([
        getDoc(doc(db, "users", report.reporterId)),
        report.contentType === "post" ? getDoc(doc(db, "posts", report.contentId)) : Promise.resolve(null),
      ]);
      if (reporterSnap.exists()) {
        const r = reporterSnap.data();
        setReporterName(r.displayName || r.email || report.reporterId.slice(0, 8));
      }
      if (contentSnap && contentSnap.exists()) {
        setPostPreview(contentSnap.data());
      }
    } catch {
      // ignore
    } finally {
      setLoadingPreview(false);
    }
  }, [expanded, report]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  const statusColor =
    report.status === "pending" ? "#f59e0b" :
    report.status === "resolved" ? "#22c55e" : "#666";

  const reportDate = report.createdAt
    ? (typeof (report.createdAt as any).toDate === "function"
        ? (report.createdAt as any).toDate()
        : new Date(report.createdAt))
    : null;
  const timeAgo = reportDate && !isNaN(reportDate.getTime())
    ? formatDistanceToNow(reportDate, { addSuffix: true })
    : "";

  return (
    <View style={styles.reportCard}>
      <TouchableOpacity
        style={styles.reportCardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.8}
      >
        <View style={styles.reportCardLeft}>
          <View style={styles.reportTopRow}>
            <View style={[styles.reportTypeBadge, { backgroundColor: "#FF450015" }]}>
              <Text style={[styles.reportTypeText, { color: "#FF4500" }]}>
                {report.contentType.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.reportStatusBadge, { backgroundColor: statusColor + "20", borderColor: statusColor + "40" }]}>
              <Text style={[styles.reportStatusText, { color: statusColor }]}>{report.status}</Text>
            </View>
          </View>
          <Text style={styles.reportReason}>{report.reason}</Text>
          {reporterName ? (
            <Text style={styles.reportMeta}>Reported by <Text style={styles.reportMetaBold}>{reporterName}</Text></Text>
          ) : null}
          <Text style={styles.reportDate}>{timeAgo}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color="#666"
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.reportExpanded}>
          {loadingPreview ? (
            <ActivityIndicator size="small" color="#FF4500" />
          ) : report.contentType === "post" && postPreview ? (
            <View style={styles.postPreview}>
              {postPreview.imageUri ? (
                <Image source={{ uri: postPreview.imageUri }} style={styles.postPreviewImage} resizeMode="cover" />
              ) : null}
              {postPreview.content ? (
                <Text style={styles.postPreviewText}>{postPreview.content}</Text>
              ) : null}
              {!postPreview.imageUri && !postPreview.content ? (
                <Text style={styles.postPreviewEmpty}>Post has no visible content</Text>
              ) : null}
            </View>
          ) : report.contentType === "post" && !postPreview ? (
            <Text style={styles.reportMeta}>Post no longer exists or was already deleted.</Text>
          ) : null}

          {report.status === "pending" && (
            <View style={styles.reportActions}>
              <TouchableOpacity
                style={[styles.reportActionBtn, { backgroundColor: "#22c55e20", borderColor: "#22c55e40" }]}
                onPress={onResolve}
              >
                <Ionicons name="checkmark-circle-outline" size={13} color="#22c55e" />
                <Text style={[styles.reportActionText, { color: "#22c55e" }]}>Resolve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reportActionBtn, { backgroundColor: "#ffffff10", borderColor: "#333" }]}
                onPress={onDismiss}
              >
                <Ionicons name="close-circle-outline" size={13} color="#888" />
                <Text style={[styles.reportActionText, { color: "#888" }]}>Dismiss</Text>
              </TouchableOpacity>
              {report.contentType === "post" && postPreview && (
                confirmDelete ? (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.reportActionText, { color: "#ef4444" }]}>Sure?</Text>
                    <TouchableOpacity
                      style={[styles.reportActionBtn, { backgroundColor: "#ef444420", borderColor: "#ef444440" }]}
                      onPress={() => { onDeleteContent(); setConfirmDelete(false); }}
                    >
                      <Ionicons name="trash-outline" size={13} color="#ef4444" />
                      <Text style={[styles.reportActionText, { color: "#ef4444" }]}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reportActionBtn, { backgroundColor: "#ffffff10", borderColor: "#333" }]}
                      onPress={() => setConfirmDelete(false)}
                    >
                      <Text style={[styles.reportActionText, { color: "#888" }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.reportActionBtn, { backgroundColor: "#ef444415", borderColor: "#ef444430" }]}
                    onPress={() => setConfirmDelete(true)}
                  >
                    <Ionicons name="trash-outline" size={13} color="#ef4444" />
                    <Text style={[styles.reportActionText, { color: "#ef4444" }]}>Delete Post</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
          {report.status !== "pending" && (
            <Text style={styles.reportMeta}>This report has already been {report.status}.</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ reports, stats, onResolve, onDismiss, onDeleteContent }: {
  reports: Report[];
  stats: { pendingReports: number };
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  onDeleteContent: (report: Report) => void;
}) {
  const [filter, setFilter] = useState<ReportFilter>("all");

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
    dismissed: reports.filter((r) => r.status === "dismissed").length,
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  return (
    <View>
      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(["all", "pending", "resolved", "dismissed"] as ReportFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
            <View style={[styles.filterCount, filter === f && styles.filterCountActive]}>
              <Text style={[styles.filterCountText, filter === f && styles.filterCountTextActive]}>
                {counts[f]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabContent}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={36} color="#444" />
            <Text style={styles.emptyText}>No reports found</Text>
          </View>
        ) : (
          filtered.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolve={() => onResolve(report.id)}
              onDismiss={() => onDismiss(report.id)}
              onDeleteContent={() => onDeleteContent(report)}
            />
          ))
        )}
      </View>
    </View>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ users, currentUid, onToggleAdmin, onDeleteUser }: {
  users: UserRecord[];
  currentUid: string;
  onToggleAdmin: (uid: string, isAdmin: boolean) => void;
  onDeleteUser: (uid: string, name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.displayName.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const adminCount = users.filter((u) => u.isAdmin).length;
  const regularCount = users.length - adminCount;

  return (
    <View style={styles.tabContent}>
      {/* Stats row */}
      <View style={styles.userStatsRow}>
        {[
          { label: "Total", value: users.length, color: "#fff" },
          { label: "Admins", value: adminCount, color: "#FF4500" },
          { label: "Regular", value: regularCount, color: "#888" },
        ].map((s) => (
          <View key={s.label} style={styles.userStatCard}>
            <Text style={[styles.userStatValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.userStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={15} color="#555" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, handle, email..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={15} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {filtered.map((u) => {
        const isYou = u.uid === currentUid;
        const initials = u.displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() || "?";
        const createdAtDate = u.createdAt
          ? (typeof (u.createdAt as any).toDate === "function"
              ? (u.createdAt as any).toDate()
              : new Date(u.createdAt))
          : null;
        const joinedAgo = createdAtDate && !isNaN(createdAtDate.getTime())
          ? formatDistanceToNow(createdAtDate, { addSuffix: true })
          : null;

        return (
          <View key={u.uid} style={styles.userCard}>
            <View style={styles.userCardTop}>
              <View style={[styles.userAvatar, { backgroundColor: u.isAdmin ? "#FF450020" : "#1a1a1a" }]}>
                <Text style={[styles.userAvatarText, { color: u.isAdmin ? "#FF4500" : "#888" }]}>{initials}</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{u.displayName}</Text>
                  {u.isAdmin && (
                    <View style={styles.adminBadge}>
                      <Ionicons name="shield-checkmark" size={10} color="#FF4500" />
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  )}
                  {isYou && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>You</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userHandle}>@{u.handle}</Text>
                <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                {joinedAgo && <Text style={styles.userJoined}>Joined {joinedAgo}</Text>}
              </View>
            </View>

            {!isYou && (
              <View style={styles.userActions}>
                <TouchableOpacity
                  style={[styles.userActionBtn, u.isAdmin ? styles.userActionBtnAdmin : styles.userActionBtnDefault]}
                  onPress={() => onToggleAdmin(u.uid, u.isAdmin)}
                >
                  <Ionicons name={u.isAdmin ? "shield-outline" : "shield-checkmark-outline"} size={13} color={u.isAdmin ? "#888" : "#FF4500"} />
                  <Text style={[styles.userActionText, { color: u.isAdmin ? "#888" : "#FF4500" }]}>
                    {u.isAdmin ? "Remove Admin" : "Make Admin"}
                  </Text>
                </TouchableOpacity>

                {confirmDeleteId === u.uid ? (
                  <View style={styles.confirmRow}>
                    <Text style={[styles.userActionText, { color: "#ef4444" }]}>Sure?</Text>
                    <TouchableOpacity
                      style={[styles.userActionBtn, { backgroundColor: "#ef444420", borderColor: "#ef444440" }]}
                      onPress={() => { onDeleteUser(u.uid, u.displayName); setConfirmDeleteId(null); }}
                    >
                      <Text style={[styles.userActionText, { color: "#ef4444" }]}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.userActionBtn, styles.userActionBtnDefault]}
                      onPress={() => setConfirmDeleteId(null)}
                    >
                      <Text style={[styles.userActionText, { color: "#888" }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.userActionBtn, { backgroundColor: "#ef444410", borderColor: "#ef444430" }]}
                    onPress={() => setConfirmDeleteId(u.uid)}
                  >
                    <Ionicons name="trash-outline" size={13} color="#ef4444" />
                    <Text style={[styles.userActionText, { color: "#ef4444" }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        );
      })}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={36} color="#444" />
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      )}
    </View>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function SimpleBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartBars}>
        {data.map((d, i) => (
          <View key={i} style={styles.chartBarWrapper}>
            <Text style={styles.chartBarValue}>{d.value > 0 ? d.value : ""}</Text>
            <View style={styles.chartBarOuter}>
              <View
                style={[
                  styles.chartBarInner,
                  { height: Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0) },
                ]}
              />
            </View>
            <Text style={styles.chartBarLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AnalyticsTab({ stats }: { stats: any }) {
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  useEffect(() => {
    const fetchChart = async () => {
      try {
        const days: { label: string; value: number }[] = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          days.push({
            label: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 3),
            value: 0,
          });
        }
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const snap = await getDocs(
          query(collection(db, "workoutLogs"), where("startedAt", ">=", sevenDaysAgo.toISOString()))
        );
        snap.docs.forEach((d) => {
          const log = d.data();
          const logDate = new Date(log.startedAt);
          const dayIndex = 6 - Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
          if (dayIndex >= 0 && dayIndex < 7) {
            days[dayIndex].value += 1;
          }
        });
        setChartData(days);
      } catch {
        // silently handle
      } finally {
        setLoadingChart(false);
      }
    };
    fetchChart();
  }, []);

  const STAT_CARDS = [
    { label: "Total Users", value: stats.totalUsers, icon: "people", color: "#60a5fa" },
    { label: "Total Workouts", value: stats.totalWorkouts, icon: "barbell", color: "#FF4500" },
    { label: "Total Posts", value: stats.totalPosts, icon: "images", color: "#a78bfa" },
    { label: "Groups", value: stats.totalGroups, icon: "people-circle", color: "#34d399" },
    { label: "Pending Reports", value: stats.pendingReports, icon: "flag", color: "#ef4444" },
  ];

  return (
    <View style={styles.tabContent}>
      <View style={styles.analyticsGrid}>
        {STAT_CARDS.map((s) => (
          <View key={s.label} style={styles.analyticsCard}>
            <View style={[styles.analyticsIcon, { backgroundColor: s.color + "20" }]}>
              <Ionicons name={s.icon as any} size={18} color={s.color} />
            </View>
            <View>
              <Text style={[styles.analyticsValue, { color: "#fff" }]}>{s.value}</Text>
              <Text style={styles.analyticsLabel}>{s.label}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Workouts — Last 7 Days</Text>
        {loadingChart ? (
          <ActivityIndicator size="small" color="#FF4500" style={{ marginTop: 20 }} />
        ) : (
          <SimpleBarChart data={chartData} />
        )}
      </View>
    </View>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const { appUser } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, "invites", id), {
        id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        invitedBy: appUser?.uid,
        invitedByName: appUser?.displayName,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      Alert.alert("Invite recorded", `${inviteEmail} has been added to the invite list. They can sign up using that email address.`);
      setInviteEmail("");
    } catch {
      Alert.alert("Error", "Could not save invite. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <View style={styles.tabContent}>
      {/* Invite Users */}
      <View style={styles.settingsCard}>
        <View style={styles.settingsCardHeader}>
          <Ionicons name="person-add-outline" size={15} color="#fff" />
          <Text style={styles.settingsCardTitle}>Invite Users</Text>
        </View>
        <Text style={styles.settingsCardDesc}>Record an invitation for a new user.</Text>
        <TextInput
          style={styles.settingsInput}
          placeholder="Email address"
          placeholderTextColor="#555"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.inviteRoleRow}>
          {(["user", "admin"] as const).map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.roleBtn, inviteRole === role && styles.roleBtnActive]}
              onPress={() => setInviteRole(role)}
            >
              <Text style={[styles.roleBtnText, inviteRole === role && styles.roleBtnTextActive]}>
                {role === "user" ? "Regular User" : "Admin"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.inviteBtn, (!inviteEmail.trim() || inviting) && styles.inviteBtnDisabled]}
          onPress={handleInvite}
          disabled={!inviteEmail.trim() || inviting}
        >
          {inviting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.inviteBtnText}>Save Invite</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Platform Info */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Platform Info</Text>
        {[
          { label: "Platform", value: "Firebase / Expo" },
          { label: "Auth", value: "Firebase Auth" },
          { label: "Database", value: "Firestore" },
          { label: "Storage", value: "Firebase Storage" },
        ].map((item, i, arr) => (
          <View key={item.label} style={[styles.infoRow, i < arr.length - 1 && styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Moderation Summary */}
      <View style={styles.settingsCard}>
        <Text style={styles.settingsCardTitle}>Moderation</Text>
        <Text style={styles.settingsCardDesc}>Use the Reports tab to review flagged content.</Text>
        <View style={styles.moderationList}>
          {[
            "Users can report posts and other users",
            "Admins can resolve or dismiss reports",
            "Admins can delete flagged posts",
            "Users can block others from interacting",
            "Zero-tolerance policy enforced in Terms",
          ].map((item) => (
            <Text key={item} style={styles.moderationItem}>✅  {item}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────

const TABS: { key: MainTab; label: string; icon: string }[] = [
  { key: "reports", label: "Reports", icon: "flag" },
  { key: "users", label: "Users", icon: "people" },
  { key: "analytics", label: "Analytics", icon: "bar-chart" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export default function AdminDashboard() {
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>("reports");
  const [stats, setStats] = useState({ totalUsers: 0, totalWorkouts: 0, totalPosts: 0, totalGroups: 0, pendingReports: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (e) {
      Alert.alert("Error", "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleResolve = async (reportId: string) => {
    await updateDoc(doc(db, "reports", reportId), { status: "resolved" });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "resolved" } : r));
    setStats((s) => ({ ...s, pendingReports: Math.max(0, s.pendingReports - 1) }));
  };

  const handleDismiss = async (reportId: string) => {
    await updateDoc(doc(db, "reports", reportId), { status: "dismissed" });
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: "dismissed" } : r));
    setStats((s) => ({ ...s, pendingReports: Math.max(0, s.pendingReports - 1) }));
  };

  const handleDeleteContent = async (report: Report) => {
    const col = report.contentType === "post" ? "posts" : "users";
    await deleteDoc(doc(db, col, report.contentId));
    await handleResolve(report.id);
    if (report.contentType === "post") {
      setStats((s) => ({ ...s, totalPosts: Math.max(0, s.totalPosts - 1) }));
    }
  };

  const handleToggleAdmin = async (uid: string, isAdmin: boolean) => {
    await updateDoc(doc(db, "users", uid), { isAdmin: !isAdmin });
    setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, isAdmin: !isAdmin } : u));
  };

  const handleDeleteUser = async (uid: string, displayName: string) => {
    try {
      await deleteDoc(doc(db, "users", uid));
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      setStats((s) => ({ ...s, totalUsers: Math.max(0, s.totalUsers - 1) }));
    } catch {
      Alert.alert("Error", `Could not delete ${displayName}.`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FF4500" />
      </View>
    );
  }

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={20} color="#FF4500" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="shield-checkmark" size={18} color="#FF4500" />
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={loadData} style={styles.headerBtn}>
          <Ionicons name="refresh" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
        {TABS.map(({ key, label, icon }) => {
          const isActive = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tabBtn, isActive && styles.tabBtnActive]}
              onPress={() => setActiveTab(key)}
            >
              <Ionicons name={icon as any} size={14} color={isActive ? "#fff" : "#888"} />
              <Text style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}>{label}</Text>
              {key === "reports" && pendingCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === "reports" && (
          <ReportsTab
            reports={reports}
            stats={stats}
            onResolve={handleResolve}
            onDismiss={handleDismiss}
            onDeleteContent={handleDeleteContent}
          />
        )}
        {activeTab === "users" && (
          <UsersTab
            users={users}
            currentUid={appUser?.uid ?? ""}
            onToggleAdmin={handleToggleAdmin}
            onDeleteUser={handleDeleteUser}
          />
        )}
        {activeTab === "analytics" && <AnalyticsTab stats={stats} />}
        {activeTab === "settings" && <SettingsTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  tabBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#1a1a1a" },
  tabBtnActive: { backgroundColor: "#FF4500" },
  tabBtnText: { color: "#888", fontSize: 13, fontWeight: "600" },
  tabBtnTextActive: { color: "#fff" },
  tabBadge: { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { color: "#FF4500", fontSize: 10, fontWeight: "800" },
  tabContent: { padding: 12, gap: 10 },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "#555", fontSize: 14 },
  // Filter row
  filterRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: "#1a1a1a" },
  filterPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#2a2a2a" },
  filterPillActive: { backgroundColor: "#FF4500", borderColor: "#FF4500" },
  filterPillText: { color: "#888", fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: "#fff" },
  filterCount: { backgroundColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  filterCountText: { color: "#888", fontSize: 11, fontWeight: "700" },
  filterCountTextActive: { color: "#fff" },
  // Report card
  reportCard: { backgroundColor: "#1a1a1a", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#2a2a2a" },
  reportCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14 },
  reportCardLeft: { flex: 1, gap: 4 },
  reportTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  reportTypeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  reportTypeText: { fontSize: 10, fontWeight: "800" },
  reportStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, borderWidth: 1 },
  reportStatusText: { fontSize: 11, fontWeight: "700" },
  reportReason: { color: "#fff", fontSize: 14, fontWeight: "600" },
  reportMeta: { color: "#666", fontSize: 12 },
  reportMetaBold: { color: "#aaa", fontWeight: "600" },
  reportDate: { color: "#555", fontSize: 11 },
  reportExpanded: { borderTopWidth: 1, borderTopColor: "#2a2a2a", padding: 14, gap: 12 },
  postPreview: { backgroundColor: "#111", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "#2a2a2a" },
  postPreviewImage: { width: "100%", height: 160 },
  postPreviewText: { color: "#ccc", fontSize: 13, padding: 10 },
  postPreviewEmpty: { color: "#555", fontSize: 12, padding: 10, fontStyle: "italic" },
  reportActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reportActionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  reportActionText: { fontSize: 12, fontWeight: "600" },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  // Users
  userStatsRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  userStatCard: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 12, alignItems: "center", gap: 2 },
  userStatValue: { fontSize: 20, fontWeight: "800" },
  userStatLabel: { color: "#666", fontSize: 11 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: "#2a2a2a" },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },
  userCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: "#2a2a2a" },
  userCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  userAvatarText: { fontSize: 16, fontWeight: "800" },
  userInfo: { flex: 1, gap: 2 },
  userNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  userName: { color: "#fff", fontSize: 14, fontWeight: "700", flexShrink: 1 },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#FF450020", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  adminBadgeText: { color: "#FF4500", fontSize: 10, fontWeight: "700" },
  youBadge: { backgroundColor: "#2a2a2a", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  youBadgeText: { color: "#888", fontSize: 10, fontWeight: "600" },
  userHandle: { color: "#666", fontSize: 12 },
  userEmail: { color: "#555", fontSize: 11 },
  userJoined: { color: "#444", fontSize: 11 },
  userActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderTopColor: "#2a2a2a", paddingTop: 10 },
  userActionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  userActionBtnDefault: { backgroundColor: "#ffffff08", borderColor: "#2a2a2a" },
  userActionBtnAdmin: { backgroundColor: "#ffffff08", borderColor: "#2a2a2a" },
  userActionText: { fontSize: 12, fontWeight: "600" },
  // Analytics
  analyticsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  analyticsCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, width: "47%", borderWidth: 1, borderColor: "#2a2a2a" },
  analyticsIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  analyticsValue: { fontSize: 20, fontWeight: "800" },
  analyticsLabel: { color: "#666", fontSize: 11, marginTop: 1 },
  chartCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#2a2a2a" },
  chartTitle: { color: "#fff", fontSize: 13, fontWeight: "700", marginBottom: 16 },
  chartContainer: { height: 140 },
  chartBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, paddingTop: 20 },
  chartBarWrapper: { flex: 1, alignItems: "center", gap: 4 },
  chartBarValue: { color: "#888", fontSize: 10, height: 14 },
  chartBarOuter: { flex: 1, width: "60%", justifyContent: "flex-end" },
  chartBarInner: { backgroundColor: "#FF4500", borderRadius: 4, width: "100%", minHeight: 2 },
  chartBarLabel: { color: "#666", fontSize: 10 },
  // Settings
  settingsCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: "#2a2a2a" },
  settingsCardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingsCardTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  settingsCardDesc: { color: "#666", fontSize: 12, lineHeight: 18 },
  settingsInput: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "#2a2a2a" },
  inviteRoleRow: { flexDirection: "row", gap: 8 },
  roleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: "#111", borderWidth: 1, borderColor: "#2a2a2a" },
  roleBtnActive: { backgroundColor: "#FF450020", borderColor: "#FF4500" },
  roleBtnText: { color: "#666", fontSize: 13, fontWeight: "600" },
  roleBtnTextActive: { color: "#FF4500" },
  inviteBtn: { backgroundColor: "#FF4500", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  inviteBtnDisabled: { backgroundColor: "#333" },
  inviteBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
  infoLabel: { color: "#666", fontSize: 13 },
  infoValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
  moderationList: { gap: 8 },
  moderationItem: { color: "#888", fontSize: 13, lineHeight: 20 },
});
