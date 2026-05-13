import React, { createContext, useContext, useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  increment,
  updateDoc,
  serverTimestamp,
} from "@firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  displayName: string;
  handle: string;
  bio: string;
  avatarUri?: string;
  isPrivate: boolean;
  fitnessGoal: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
}

export interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userHandle: string;
  userAvatarUri?: string;
  content: string;
  workoutSummary?: {
    splitName: string;
    sessionType: string;
    durationMinutes: number;
    exerciseCount: number;
  };
  likesCount: number;
  likedBy: string[];
  createdAt: string;
  imageUri?: string;
  visibility: "public" | "private";
}

export interface Group {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  createdBy: string;
  memberCount: number;
  members: GroupMember[];
  difficulty: string;
  createdAt: string;
  groupStreak: number;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  streak: number;
  joinedAt: string;
}

export interface FollowRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterHandle: string;
  targetId: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
}

interface SocialContextType {
  myProfile: UserProfile | null;
  posts: Post[];
  groups: Group[];
  myGroups: string[];
  following: string[];
  followers: string[];
  blockedUsers: string[];
  pendingFollowRequests: FollowRequest[];
  isLoaded: boolean;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  addPost: (post: Omit<Post, "id" | "createdAt" | "likesCount" | "likedBy" | "userId" | "userDisplayName" | "userHandle">) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  createGroup: (group: Omit<Group, "id" | "createdAt" | "members" | "memberCount" | "inviteCode" | "groupStreak">) => Promise<Group>;
  joinGroup: (inviteCode: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  followUser: (targetId: string, isPrivate: boolean) => Promise<void>;
  unfollowUser: (targetId: string) => Promise<void>;
  blockUser: (targetId: string) => Promise<void>;
  unblockUser: (targetId: string) => Promise<void>;
  reportPost: (postId: string, reason: string) => Promise<void>;
  reportUser: (userId: string, reason: string) => Promise<void>;
  approveFollowRequest: (requestId: string) => Promise<void>;
  denyFollowRequest: (requestId: string) => Promise<void>;
  getAllUsers: () => Promise<UserProfile[]>;
}

const SocialContext = createContext<SocialContextType | null>(null);

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { user, appUser } = useAuth();
  const uid = user?.uid ?? "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [pendingFollowRequests, setPendingFollowRequests] = useState<FollowRequest[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const myProfile: UserProfile | null = appUser
    ? {
        id: appUser.uid,
        displayName: appUser.displayName,
        handle: appUser.handle,
        bio: appUser.bio,
        avatarUri: appUser.avatarUri,
        isPrivate: appUser.isPrivate,
        fitnessGoal: appUser.fitnessGoal,
        followersCount: appUser.followersCount,
        followingCount: appUser.followingCount,
        postsCount: appUser.postsCount,
      }
    : null;

  // Public feed listener
  useEffect(() => {
    if (!uid) return;

    const unsubPosts = onSnapshot(
      query(collection(db, "posts"), where("visibility", "==", "public"), orderBy("createdAt", "desc")),
      (snap) => {
        const all = snap.docs.map((d) => d.data() as Post);
        // Filter out blocked users
        setPosts(all.filter((p) => !blockedUsers.includes(p.userId)));
        setIsLoaded(true);
      }
    );

    const unsubFollowing = onSnapshot(
      query(collection(db, "follows"), where("followerId", "==", uid)),
      (snap) => setFollowing(snap.docs.map((d) => d.data().followingId as string))
    );

    const unsubFollowers = onSnapshot(
      query(collection(db, "follows"), where("followingId", "==", uid)),
      (snap) => setFollowers(snap.docs.map((d) => d.data().followerId as string))
    );

    const unsubBlocks = onSnapshot(
      query(collection(db, "blocks"), where("blockerId", "==", uid)),
      (snap) => setBlockedUsers(snap.docs.map((d) => d.data().blockedId as string))
    );

    const unsubRequests = onSnapshot(
      query(collection(db, "followRequests"), where("targetId", "==", uid), where("status", "==", "pending")),
      (snap) => setPendingFollowRequests(snap.docs.map((d) => d.data() as FollowRequest))
    );

    const unsubGroups = onSnapshot(
      query(collection(db, "groups"), where("members", "array-contains", uid)),
      (snap) => {
        const g = snap.docs.map((d) => d.data() as Group);
        setGroups(g);
        setMyGroups(g.map((gr) => gr.id));
      }
    );

    return () => {
      unsubPosts(); unsubFollowing(); unsubFollowers();
      unsubBlocks(); unsubRequests(); unsubGroups();
    };
  }, [uid]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid), updates);
  };

  const addPost = async (post: Omit<Post, "id" | "createdAt" | "likesCount" | "likedBy" | "userId" | "userDisplayName" | "userHandle">) => {
    if (!myProfile) return;
    const id = generateId();
    const newPost: Post = {
      ...post,
      id,
      userId: uid,
      userDisplayName: myProfile.displayName,
      userHandle: myProfile.handle,
      userAvatarUri: myProfile.avatarUri,
      likesCount: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
      visibility: post.visibility ?? "public",
    };
    await setDoc(doc(db, "posts", id), newPost);
    await updateDoc(doc(db, "users", uid), { postsCount: increment(1) });
  };

  const deletePost = async (id: string) => {
    await deleteDoc(doc(db, "posts", id));
    await updateDoc(doc(db, "users", uid), { postsCount: increment(-1) });
  };

  const toggleLike = async (postId: string) => {
    const postRef = doc(db, "posts", postId);
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const liked = post.likedBy.includes(uid);
    const newLikedBy = liked ? post.likedBy.filter((id) => id !== uid) : [...post.likedBy, uid];
    await updateDoc(postRef, {
      likedBy: newLikedBy,
      likesCount: liked ? increment(-1) : increment(1),
    });
    // Optimistic local update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likedBy: newLikedBy, likesCount: liked ? p.likesCount - 1 : p.likesCount + 1 }
          : p
      )
    );
  };

  const createGroup = async (
    group: Omit<Group, "id" | "createdAt" | "members" | "memberCount" | "inviteCode" | "groupStreak">
  ): Promise<Group> => {
    if (!myProfile) throw new Error("Not logged in");
    const id = generateId();
    const newGroup: Group = {
      ...group,
      id,
      inviteCode: generateCode(),
      members: [{ userId: uid, displayName: myProfile.displayName, streak: 0, joinedAt: new Date().toISOString() }],
      memberCount: 1,
      groupStreak: 0,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "groups", id), { ...newGroup, memberIds: [uid] });
    return newGroup;
  };

  const joinGroup = async (inviteCode: string) => {
    if (!myProfile) return;
    const snap = await getDocs(
      query(collection(db, "groups"), where("inviteCode", "==", inviteCode.toUpperCase()))
    );
    if (snap.empty) throw new Error("Invalid invite code");
    const groupDoc = snap.docs[0];
    const group = groupDoc.data() as Group & { memberIds: string[] };
    if (group.memberIds?.includes(uid)) throw new Error("Already a member");

    const updatedMembers = [
      ...group.members,
      { userId: uid, displayName: myProfile.displayName, streak: 0, joinedAt: new Date().toISOString() },
    ];
    await updateDoc(groupDoc.ref, {
      members: updatedMembers,
      memberIds: [...(group.memberIds ?? []), uid],
      memberCount: increment(1),
    });
  };

  const leaveGroup = async (groupId: string) => {
    const groupRef = doc(db, "groups", groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) return;
    const group = snap.data() as Group & { memberIds: string[] };
    await updateDoc(groupRef, {
      members: group.members.filter((m) => m.userId !== uid),
      memberIds: (group.memberIds ?? []).filter((id) => id !== uid),
      memberCount: increment(-1),
    });
  };

  const followUser = async (targetId: string, isPrivate: boolean) => {
    if (isPrivate) {
      // Send follow request instead
      const id = generateId();
      const request: FollowRequest = {
        id,
        requesterId: uid,
        requesterName: myProfile?.displayName ?? "",
        requesterHandle: myProfile?.handle ?? "",
        targetId,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "followRequests", id), request);
    } else {
      const id = `${uid}_${targetId}`;
      await setDoc(doc(db, "follows", id), { followerId: uid, followingId: targetId, createdAt: new Date().toISOString() });
      await updateDoc(doc(db, "users", uid), { followingCount: increment(1) });
      await updateDoc(doc(db, "users", targetId), { followersCount: increment(1) });
    }
  };

  const unfollowUser = async (targetId: string) => {
    const id = `${uid}_${targetId}`;
    await deleteDoc(doc(db, "follows", id));
    await updateDoc(doc(db, "users", uid), { followingCount: increment(-1) });
    await updateDoc(doc(db, "users", targetId), { followersCount: increment(-1) });
  };

  const blockUser = async (targetId: string) => {
    const id = `${uid}_${targetId}`;
    await setDoc(doc(db, "blocks", id), { blockerId: uid, blockedId: targetId, createdAt: new Date().toISOString() });
    // Also unfollow if following
    if (following.includes(targetId)) await unfollowUser(targetId);
  };

  const unblockUser = async (targetId: string) => {
    await deleteDoc(doc(db, "blocks", `${uid}_${targetId}`));
  };

  const reportPost = async (postId: string, reason: string) => {
    const id = generateId();
    await setDoc(doc(db, "reports", id), {
      id,
      reporterId: uid,
      contentType: "post",
      contentId: postId,
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  };

  const reportUser = async (userId: string, reason: string) => {
    const id = generateId();
    await setDoc(doc(db, "reports", id), {
      id,
      reporterId: uid,
      contentType: "user",
      contentId: userId,
      reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  };

  const approveFollowRequest = async (requestId: string) => {
    const req = pendingFollowRequests.find((r) => r.id === requestId);
    if (!req) return;
    await updateDoc(doc(db, "followRequests", requestId), { status: "approved" });
    // Create the follow relationship
    const id = `${req.requesterId}_${uid}`;
    await setDoc(doc(db, "follows", id), {
      followerId: req.requesterId,
      followingId: uid,
      createdAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, "users", req.requesterId), { followingCount: increment(1) });
    await updateDoc(doc(db, "users", uid), { followersCount: increment(1) });
  };

  const denyFollowRequest = async (requestId: string) => {
    await updateDoc(doc(db, "followRequests", requestId), { status: "denied" });
  };

  const getAllUsers = async (): Promise<UserProfile[]> => {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs
      .map((d) => {
        const u = d.data();
        return {
          id: u.uid,
          displayName: u.displayName,
          handle: u.handle,
          bio: u.bio ?? "",
          avatarUri: u.avatarUri,
          isPrivate: u.isPrivate ?? false,
          fitnessGoal: u.fitnessGoal ?? "",
          followersCount: u.followersCount ?? 0,
          followingCount: u.followingCount ?? 0,
          postsCount: u.postsCount ?? 0,
        } as UserProfile;
      })
      .filter((u) => u.id !== uid && !blockedUsers.includes(u.id));
  };

  return (
    <SocialContext.Provider
      value={{
        myProfile,
        posts,
        groups,
        myGroups,
        following,
        followers,
        blockedUsers,
        pendingFollowRequests,
        isLoaded,
        updateProfile,
        addPost,
        deletePost,
        toggleLike,
        createGroup,
        joinGroup,
        leaveGroup,
        followUser,
        unfollowUser,
        blockUser,
        unblockUser,
        reportPost,
        reportUser,
        approveFollowRequest,
        denyFollowRequest,
        getAllUsers,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within SocialProvider");
  return ctx;
}
