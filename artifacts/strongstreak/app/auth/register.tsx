import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import LegalModal from "@/components/LegalModal";

type HandleStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function RegisterScreen() {
  const { signUp, checkHandleAvailable } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!handle.trim()) {
      setHandleStatus("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(handle.toLowerCase())) {
      setHandleStatus("invalid");
      return;
    }
    setHandleStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkHandleAvailable(handle.toLowerCase());
        setHandleStatus(available ? "available" : "taken");
      } catch {
        setHandleStatus("idle");
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [handle]);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !handle.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (handleStatus === "taken") {
      Alert.alert("Handle taken", "Please choose a different username.");
      return;
    }
    if (handleStatus === "invalid") {
      Alert.alert("Invalid username", "Username must be 3–20 characters, letters, numbers, and underscores only.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (!tosAccepted) {
      Alert.alert("Terms required", "Please accept the Terms of Service to continue.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim(), handle.trim().toLowerCase());
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Sign up failed", e.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusIcon = () => {
    if (handleStatus === "checking") return <ActivityIndicator size="small" color="#888" />;
    if (handleStatus === "available") return <Ionicons name="checkmark-circle" size={20} color="#22c55e" />;
    if (handleStatus === "taken") return <Ionicons name="close-circle" size={20} color="#ef4444" />;
    if (handleStatus === "invalid") return <Ionicons name="alert-circle" size={20} color="#f59e0b" />;
    return null;
  };

  const handleStatusText = () => {
    if (handleStatus === "available") return { text: "Username available", color: "#22c55e" };
    if (handleStatus === "taken") return { text: "Username already taken", color: "#ef4444" };
    if (handleStatus === "invalid") return { text: "3–20 characters: letters, numbers, underscores only", color: "#f59e0b" };
    return null;
  };

  const statusText = handleStatusText();
  const canSubmit = !loading && handleStatus !== "taken" && handleStatus !== "invalid" && handleStatus !== "checking" && tosAccepted;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🔥 StrongStreak</Text>
        <Text style={styles.subtitle}>Create your account and start your streak</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        {/* Handle field */}
        <View style={styles.handleContainer}>
          <View style={[styles.input, styles.handleInputRow, { marginBottom: 0 }]}>
            <Text style={styles.handleAt}>@</Text>
            <TextInput
              style={styles.handleInput}
              placeholder="username"
              placeholderTextColor="#666"
              value={handle}
              onChangeText={(t) => setHandle(t.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {handleStatusIcon()}
          </View>
          {statusText && (
            <Text style={[styles.handleStatus, { color: statusText.color }]}>{statusText.text}</Text>
          )}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#666"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />

        {/* ToS */}
        <View style={styles.tosRow}>
          <TouchableOpacity onPress={() => setTosAccepted(!tosAccepted)} activeOpacity={0.7}>
            <View style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}>
              {tosAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
          <Text style={styles.tosText}>
            I agree to the{" "}
            <Text style={styles.tosLink} onPress={() => setLegalModal("terms")}>Terms of Service</Text>
            {" "}and{" "}
            <Text style={styles.tosLink} onPress={() => setLegalModal("privacy")}>Privacy Policy</Text>
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={!canSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkBold}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <LegalModal
        visible={legalModal === "terms"}
        type="terms"
        onClose={() => setLegalModal(null)}
        onAccept={() => setTosAccepted(true)}
      />
      <LegalModal
        visible={legalModal === "privacy"}
        type="privacy"
        onClose={() => setLegalModal(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  inner: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  logo: { fontSize: 32, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#888", textAlign: "center", marginBottom: 40 },
  input: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "#fff",
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  handleContainer: { marginBottom: 12 },
  handleInputRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  handleAt: { color: "#666", fontSize: 16 },
  handleInput: { flex: 1, color: "#fff", fontSize: 16 },
  handleStatus: { fontSize: 12, marginTop: 6, marginLeft: 4 },
  tosRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20, marginTop: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#555",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxChecked: { backgroundColor: "#FF4500", borderColor: "#FF4500" },
  tosText: { flex: 1, color: "#888", fontSize: 13, lineHeight: 20 },
  tosLink: { color: "#FF4500", fontWeight: "600" },
  button: {
    backgroundColor: "#FF4500",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { marginTop: 24, alignItems: "center" },
  linkText: { color: "#888", fontSize: 14 },
  linkBold: { color: "#FF4500", fontWeight: "700" },
});
