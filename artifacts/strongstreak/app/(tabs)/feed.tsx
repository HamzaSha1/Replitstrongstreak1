import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, TextInput, Modal,
  RefreshControl, Alert, Image, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSocial } from "@/context/SocialContext";
import { useWorkout } from "@/context/WorkoutContext";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { formatDistanceToNow } from "date-fns";

const REPORT_REASONS = [
  "Spam",
  "Inappropriate content",
  "Harassment",
  "False information",
  "Other",
];

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "22" }]}>
      <Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function ReportModal({
  visible,
  post,
  onClose,
}: {
  visible: boolean;
  post: { id: string; userId: string; userDisplayName: string } | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { reportPost, blockUser } = useSocial();
  const [submitting, setSubmitting] = useState(false);

  const handleReport = async (reason: string) => {
    if (!post) return;
    setSubmitting(true);
    try {
      await reportPost(post.id, reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      Alert.alert(
        "Reported",
        `Post reported for "${reason}". Do you also want to block @${post.userDisplayName}?`,
        [
          { text: "No thanks", style: "cancel" },
          {
            text: "Block user",
            style: "destructive",
            onPress: async () => { await blockUser(post.userId); },
          },
        ]
      );
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent>
      <View style={styles.reportOverlay}>
        <View style={[styles.reportSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.reportHandle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.reportTitle, { color: colors.foreground }]}>Report Post</Text>
          <Text style={[styles.reportSubtitle, { color: colors.mutedForeground }]}>
            Why are you reporting this post?
          </Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[styles.reportReasonBtn, { borderColor: colors.border }]}
              onPress={() => handleReport(reason)}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={[styles.reportReasonText, { color: colors.foreground }]}>{reason}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.reportCancelBtn} onPress={onClose}>
            <Text style={[styles.reportCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PostCard({
  post,
  uid,
  onReport,
}: {
  post: any;
  uid: string;
  onReport: (post: any) => void;
}) {
  const colors = useColors();
  const { toggleLike, deletePost } = useSocial();
  const isLiked = post.likedBy.includes(uid);
  const isOwn = post.userId === uid;

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleLike(post.id);
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.postHeader}>
        <View style={styles.postUserInfo}>
          <Avatar name={post.userDisplayName} size={40} />
          <View>
            <Text style={[styles.postUserName, { color: colors.foreground }]}>{post.userDisplayName}</Text>
            <View style={styles.postMetaRow}>
              <Text style={[styles.postMeta, { color: colors.mutedForeground }]}>@{post.userHandle} · {timeAgo}</Text>
              {post.visibility === "private" && (
                <View style={[styles.privatePill, { backgroundColor: colors.muted }]}>
                  <Ionicons name="lock-closed" size={9} color={colors.mutedForeground} />
                  <Text style={[styles.privatePillText, { color: colors.mutedForeground }]}>Only me</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {isOwn ? (
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Delete post", "Are you sure?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deletePost(post.id) },
              ]);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => onReport(post)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="flag-outline" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {post.workoutSummary && (
        <View style={[styles.workoutSummaryBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Ionicons name="barbell" size={14} color={colors.primary} />
          <Text style={[styles.workoutSummaryText, { color: colors.primary }]}>
            {post.workoutSummary.sessionType} · {post.workoutSummary.durationMinutes}min · {post.workoutSummary.exerciseCount} exercises
          </Text>
        </View>
      )}

      {post.content ? (
        <Text style={[styles.postContent, { color: colors.foreground }]}>{post.content}</Text>
      ) : null}

      {post.imageUri ? (
        <Image
          source={{ uri: post.imageUri }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.likeBtn} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={20}
            color={isLiked ? "#EF4444" : colors.mutedForeground}
          />
          <Text style={[styles.likeCount, { color: isLiked ? "#EF4444" : colors.mutedForeground }]}>
            {post.likedBy.length}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ComposeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addPost, uploadPostImage } = useSocial();
  const { workoutLogs } = useWorkout();
  const [text, setText] = useState("");
  const [attachWorkout, setAttachWorkout] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [uploading, setUploading] = useState(false);

  const lastWorkout = workoutLogs[0];

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  const handlePickPhoto = async () => {
    Alert.alert("Add Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: async () => {
          const granted = await requestCameraPermission();
          if (!granted) {
            Alert.alert("Permission needed", "Camera access is required to take photos.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const granted = await requestGalleryPermission();
          if (!granted) {
            Alert.alert("Permission needed", "Photo library access is required.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            setImageUri(result.assets[0].uri);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handlePost = async () => {
    if (!text.trim() && !imageUri) return;
    setUploading(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      let uploadedImageUri: string | undefined;
      if (imageUri) {
        uploadedImageUri = await uploadPostImage(imageUri);
      }
      await addPost({
        content: text.trim(),
        imageUri: uploadedImageUri,
        visibility,
        workoutSummary: attachWorkout && lastWorkout ? {
          splitName: lastWorkout.splitName,
          sessionType: lastWorkout.sessionType,
          durationMinutes: lastWorkout.durationMinutes ?? 0,
          exerciseCount: lastWorkout.setLogs.length,
        } : undefined,
      });
      setText("");
      setAttachWorkout(false);
      setImageUri(null);
      setVisibility("public");
      onClose();
    } catch {
      Alert.alert("Error", "Could not post. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const canPost = (text.trim().length > 0 || imageUri !== null) && !uploading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.composeModal, { backgroundColor: colors.background, paddingTop: insets.top || 20 }]}>
        <View style={[styles.composeHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} disabled={uploading}>
            <Text style={[styles.composeCancel, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.composeTitle, { color: colors.foreground }]}>New Post</Text>
          <TouchableOpacity
            style={[styles.composePostBtn, { backgroundColor: canPost ? colors.primary : colors.muted }]}
            onPress={handlePost}
            disabled={!canPost}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.composePostText, { color: canPost ? colors.primaryForeground : colors.mutedForeground }]}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.composeInput, { color: colors.foreground }]}
          placeholder="Share your progress..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          value={text}
          onChangeText={setText}
          autoFocus={!imageUri}
          editable={!uploading}
        />

        {/* Image preview */}
        {imageUri && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setImageUri(null)}
              disabled={uploading}
            >
              <Ionicons name="close-circle" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Toolbar */}
        <View style={[styles.composeToolbar, { borderTopColor: colors.border }]}>
          {/* Photo button */}
          <TouchableOpacity
            style={[styles.toolbarBtn, { borderColor: colors.border }]}
            onPress={handlePickPhoto}
            disabled={uploading}
          >
            <Ionicons name="image-outline" size={20} color={imageUri ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>

          {/* Attach workout button */}
          {lastWorkout && (
            <TouchableOpacity
              style={[styles.toolbarBtn, { borderColor: colors.border, backgroundColor: attachWorkout ? colors.primary + "20" : "transparent" }]}
              onPress={() => setAttachWorkout(!attachWorkout)}
              disabled={uploading}
            >
              <Ionicons name="barbell-outline" size={20} color={attachWorkout ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />

          {/* Visibility toggle */}
          <TouchableOpacity
            style={[styles.visibilityToggle, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => setVisibility(visibility === "public" ? "private" : "public")}
            disabled={uploading}
          >
            <Ionicons
              name={visibility === "public" ? "globe-outline" : "lock-closed-outline"}
              size={14}
              color={visibility === "public" ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.visibilityText, { color: visibility === "public" ? colors.primary : colors.mutedForeground }]}>
              {visibility === "public" ? "Public" : "Only me"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Attached workout preview */}
        {attachWorkout && lastWorkout && (
          <View style={[styles.attachedWorkout, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30", marginHorizontal: 16, marginBottom: 12 }]}>
            <Ionicons name="barbell" size={14} color={colors.primary} />
            <Text style={[styles.attachWorkoutText, { color: colors.primary }]}>
              {lastWorkout.sessionType} · {lastWorkout.durationMinutes ?? 0}min
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const { posts, blockedUsers } = useSocial();
  const [composeVisible, setComposeVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportTarget, setReportTarget] = useState<any>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const onRefresh = async () => {
    setRefreshing(true);
    // Posts stream live via onSnapshot — brief indicator for UX
    setTimeout(() => setRefreshing(false), 500);
  };

  const sorted = [...posts]
    .filter((p) => {
      if (blockedUsers.includes(p.userId)) return false;
      // Private posts only visible to their author
      if (p.visibility === "private" && p.userId !== uid) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Feed</Text>
        <TouchableOpacity
          style={[styles.composeBtn, { backgroundColor: colors.primary }]}
          onPress={() => setComposeVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.feedContent, { paddingBottom: bottomPad + 90 }]}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <PostCard post={item} uid={uid} onReport={setReportTarget} />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="newspaper-outline" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Share your first workout</Text>
          </View>
        }
      />

      <ComposeModal visible={composeVisible} onClose={() => setComposeVisible(false)} />
      <ReportModal
        visible={reportTarget !== null}
        post={reportTarget}
        onClose={() => setReportTarget(null)}
      />
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
  composeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  feedContent: { paddingHorizontal: 16, paddingTop: 12 },
  postCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  postHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  postUserInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "700", fontFamily: "Inter_700Bold" },
  postUserName: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  postMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  postMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  privatePill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 },
  privatePillText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  workoutSummaryBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
  },
  workoutSummaryText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  postContent: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  postImage: { width: "100%", height: 220, borderRadius: 12 },
  postActions: { flexDirection: "row", alignItems: "center" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeCount: { fontSize: 14, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular" },
  // Compose
  composeModal: { flex: 1 },
  composeHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  composeTitle: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  composeCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  composePostBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, minWidth: 56, alignItems: "center" },
  composePostText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  composeInput: {
    fontSize: 17, fontFamily: "Inter_400Regular", padding: 16,
    minHeight: 100, textAlignVertical: "top",
  },
  imagePreviewContainer: { marginHorizontal: 16, marginBottom: 8, position: "relative" },
  imagePreview: { width: "100%", height: 200, borderRadius: 12 },
  removeImageBtn: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 13,
  },
  composeToolbar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  visibilityToggle: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1,
  },
  visibilityText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  attachedWorkout: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  attachWorkoutText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  // Report modal
  reportOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  reportSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  reportHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  reportTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 4 },
  reportSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 16 },
  reportReasonBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reportReasonText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  reportCancelBtn: { paddingVertical: 16, alignItems: "center" },
  reportCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
