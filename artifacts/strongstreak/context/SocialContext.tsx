import React, { createContext, useContext, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  likedBy: string[];
  createdAt: string;
  imageUri?: string;
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
}

export interface GroupMember {
  userId: string;
  displayName: string;
  streak: number;
  joinedAt: string;
}

interface SocialContextType {
  myProfile: UserProfile;
  posts: Post[];
  groups: Group[];
  myGroups: string[];
  following: string[];
  isLoaded: boolean;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  addPost: (post: Omit<Post, "id" | "createdAt" | "likedBy" | "userId" | "userDisplayName" | "userHandle">) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  createGroup: (group: Omit<Group, "id" | "createdAt" | "members" | "memberCount" | "inviteCode">) => Promise<Group>;
  joinGroup: (inviteCode: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
}

const SocialContext = createContext<SocialContextType | null>(null);

const MY_USER_ID = "local_user";

const STORAGE_KEYS = {
  PROFILE: "ss_profile",
  POSTS: "ss_posts",
  GROUPS: "ss_groups",
  MY_GROUPS: "ss_my_groups",
  FOLLOWING: "ss_following",
};

function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const DEFAULT_PROFILE: UserProfile = {
  id: MY_USER_ID,
  displayName: "You",
  handle: "strongstreak_user",
  bio: "Fitness enthusiast",
  isPrivate: false,
  fitnessGoal: "Build muscle",
  followersCount: 0,
  followingCount: 0,
  postsCount: 0,
};

const SAMPLE_POSTS: Post[] = [
  {
    id: "sample1",
    userId: "user2",
    userDisplayName: "Alex Fitness",
    userHandle: "alexfitness",
    content: "Crushed legs day today! 🔥 New PR on squats — 140kg for 5 reps. Consistency pays off.",
    likedBy: [],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    workoutSummary: { splitName: "PPL", sessionType: "Legs", durationMinutes: 72, exerciseCount: 6 },
  },
  {
    id: "sample2",
    userId: "user3",
    userDisplayName: "Sarah Lifts",
    userHandle: "sarahlifts",
    content: "Week 4 of my cut complete. Down 3kg and strength is holding. The streak keeps me accountable.",
    likedBy: [MY_USER_ID],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: "sample3",
    userId: "user4",
    userDisplayName: "Marcus Power",
    userHandle: "marcuspower",
    content: "Rest day well earned. 6 days of training this week. Body needs recovery too.",
    likedBy: [],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

export function SocialProvider({ children }: { children: React.ReactNode }) {
  const [myProfile, setMyProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [posts, setPosts] = useState<Post[]>(SAMPLE_POSTS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRaw, postsRaw, groupsRaw, myGroupsRaw, followingRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
        AsyncStorage.getItem(STORAGE_KEYS.POSTS),
        AsyncStorage.getItem(STORAGE_KEYS.GROUPS),
        AsyncStorage.getItem(STORAGE_KEYS.MY_GROUPS),
        AsyncStorage.getItem(STORAGE_KEYS.FOLLOWING),
      ]);
      if (profileRaw) setMyProfile(JSON.parse(profileRaw));
      if (postsRaw) {
        const stored = JSON.parse(postsRaw);
        setPosts([...stored, ...SAMPLE_POSTS.filter((s) => !stored.find((p: Post) => p.id === s.id))]);
      }
      if (groupsRaw) setGroups(JSON.parse(groupsRaw));
      if (myGroupsRaw) setMyGroups(JSON.parse(myGroupsRaw));
      if (followingRaw) setFollowing(JSON.parse(followingRaw));
    } catch (e) {
    } finally {
      setIsLoaded(true);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const updated = { ...myProfile, ...updates };
    setMyProfile(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));
  };

  const addPost = async (post: Omit<Post, "id" | "createdAt" | "likedBy" | "userId" | "userDisplayName" | "userHandle">) => {
    const newPost: Post = {
      ...post,
      id: generateId(),
      userId: MY_USER_ID,
      userDisplayName: myProfile.displayName,
      userHandle: myProfile.handle,
      userAvatarUri: myProfile.avatarUri,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newPost, ...posts];
    setPosts(updated);
    const myPosts = updated.filter((p) => p.userId === MY_USER_ID);
    await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(myPosts));
    await updateProfile({ postsCount: myProfile.postsCount + 1 });
  };

  const deletePost = async (id: string) => {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    const myPosts = updated.filter((p) => p.userId === MY_USER_ID);
    await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(myPosts));
  };

  const toggleLike = async (postId: string) => {
    const updated = posts.map((p) => {
      if (p.id !== postId) return p;
      const liked = p.likedBy.includes(MY_USER_ID);
      return {
        ...p,
        likedBy: liked ? p.likedBy.filter((id) => id !== MY_USER_ID) : [...p.likedBy, MY_USER_ID],
      };
    });
    setPosts(updated);
    const myPosts = updated.filter((p) => p.userId === MY_USER_ID);
    await AsyncStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(myPosts));
  };

  const createGroup = async (group: Omit<Group, "id" | "createdAt" | "members" | "memberCount" | "inviteCode">): Promise<Group> => {
    const newGroup: Group = {
      ...group,
      id: generateId(),
      inviteCode: generateCode(),
      members: [{ userId: MY_USER_ID, displayName: myProfile.displayName, streak: 0, joinedAt: new Date().toISOString() }],
      memberCount: 1,
      createdAt: new Date().toISOString(),
    };
    const updatedGroups = [...groups, newGroup];
    const updatedMyGroups = [...myGroups, newGroup.id];
    setGroups(updatedGroups);
    setMyGroups(updatedMyGroups);
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updatedGroups));
    await AsyncStorage.setItem(STORAGE_KEYS.MY_GROUPS, JSON.stringify(updatedMyGroups));
    return newGroup;
  };

  const joinGroup = async (inviteCode: string) => {
    const group = groups.find((g) => g.inviteCode === inviteCode.toUpperCase());
    if (!group) throw new Error("Invalid invite code");
    if (myGroups.includes(group.id)) throw new Error("Already a member");

    const updatedGroups = groups.map((g) => {
      if (g.id !== group.id) return g;
      return {
        ...g,
        memberCount: g.memberCount + 1,
        members: [...g.members, { userId: MY_USER_ID, displayName: myProfile.displayName, streak: 0, joinedAt: new Date().toISOString() }],
      };
    });
    const updatedMyGroups = [...myGroups, group.id];
    setGroups(updatedGroups);
    setMyGroups(updatedMyGroups);
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updatedGroups));
    await AsyncStorage.setItem(STORAGE_KEYS.MY_GROUPS, JSON.stringify(updatedMyGroups));
  };

  const leaveGroup = async (groupId: string) => {
    const updatedGroups = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        memberCount: Math.max(0, g.memberCount - 1),
        members: g.members.filter((m) => m.userId !== MY_USER_ID),
      };
    });
    const updatedMyGroups = myGroups.filter((id) => id !== groupId);
    setGroups(updatedGroups);
    setMyGroups(updatedMyGroups);
    await AsyncStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(updatedGroups));
    await AsyncStorage.setItem(STORAGE_KEYS.MY_GROUPS, JSON.stringify(updatedMyGroups));
  };

  return (
    <SocialContext.Provider
      value={{
        myProfile,
        posts,
        groups,
        myGroups,
        following,
        isLoaded,
        updateProfile,
        addPost,
        deletePost,
        toggleLike,
        createGroup,
        joinGroup,
        leaveGroup,
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
