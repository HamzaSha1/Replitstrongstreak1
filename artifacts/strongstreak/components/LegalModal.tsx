import React, { useState, useRef } from "react";
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const TERMS_SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "These Terms constitute a legally binding agreement between you and Zod Al-Khair Company for Information Technology (\"we\", \"us\", or \"our\") governing your use of the StrongStreak mobile application. By tapping \"I Agree\" or by accessing and using the App, you confirm that you are at least 13 years of age and agree to these Terms.",
  },
  {
    title: "2. User Accounts",
    body: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and truthful information when creating your account and to update it as necessary.",
    highlight: false,
  },
  {
    title: "3. Objectionable Content — Zero Tolerance Policy",
    body: "StrongStreak has a zero-tolerance policy for objectionable content and abusive behavior. You agree that you will NOT post, share, upload, or transmit any content that is:\n\n• Hateful, racist, sexist, or discriminatory based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin\n• Sexually explicit, pornographic, or contains nudity\n• Promotes, glorifies, or depicts violence, self-harm, eating disorders, or dangerous activities\n• Harasses, bullies, threatens, or intimidates other users\n• Contains spam, misinformation, or deceptive content\n• Violates the intellectual property rights of others\n• Involves impersonation of any person or entity\n• Is illegal under applicable laws or regulations\n\nViolations of this policy will result in immediate content removal and permanent account termination without notice.",
    danger: true,
  },
  {
    title: "4. Abusive Users — Zero Tolerance Policy",
    body: "We have a zero-tolerance policy for abusive users. You agree not to:\n\n• Harass, stalk, threaten, or abuse any other user of the App\n• Engage in coordinated harassment or pile-ons against other users\n• Create multiple accounts to evade a ban or suspension\n• Attempt to hack, exploit, or interfere with the App or other users' accounts\n• Engage in any conduct that restricts or inhibits any other user's use or enjoyment of the App\n\nAbusive users will be permanently banned from StrongStreak. We reserve the right to report abusive behavior to law enforcement where applicable.",
    danger: true,
  },
  {
    title: "5. Content Moderation & Reporting",
    body: "We provide in-app tools to report objectionable content or abusive users. All reports are reviewed by our moderation team. We reserve the right to remove any content and terminate any account that violates these Terms, at our sole discretion and without prior notice. We aim to act on valid reports within 24 hours.",
  },
  {
    title: "6. User-Generated Content",
    body: "You retain ownership of content you post. By posting content on StrongStreak, you grant us a non-exclusive, worldwide, royalty-free license to display and distribute that content within the App. You represent and warrant that you have all rights necessary to post such content.",
  },
  {
    title: "7. Privacy",
    body: "Your use of the App is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using StrongStreak, you consent to the collection and use of your data as described in our Privacy Policy.",
  },
  {
    title: "8. Disclaimers",
    body: "StrongStreak is a fitness tracking tool and is not a substitute for professional medical advice. Always consult a qualified healthcare provider before starting any fitness program. We are not responsible for any injury or health issues arising from use of the App.",
  },
  {
    title: "9. Termination",
    body: "We reserve the right to suspend or permanently terminate your account at any time, with or without notice, if you violate these Terms or engage in any conduct we deem harmful to other users or the App.",
  },
  {
    title: "10. Changes to These Terms",
    body: "We may update these Terms from time to time. Continued use of the App after changes are posted constitutes your acceptance of the revised Terms. We will notify you of significant changes via the App.",
  },
  {
    title: "11. Contact Us",
    body: "For questions, concerns, or to report a violation:\n\nCompany: Zod Al-Khair Company for Information Technology\nEmail: hamza@zod-alkhair.com",
  },
];

const PRIVACY_SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "We collect the following types of information when you create an account and use the App:\n\n• Account Information: Full name, email address, display name, and bio\n• Health & Fitness Data: Weight entries, workout logs (duration, start and end times), and detailed set logs (exercise names, repetitions, weight, and RPE)\n• User-Generated Content: Workout posts with captions and optional images\n• Social Interaction Data: Follower and following relationships, group memberships, and post likes\n• Workout Preferences: Custom workout split configurations and exercise details",
  },
  {
    title: "2. How We Use Your Information",
    body: "We use the information we collect to:\n\n• Provide, operate, and maintain the StrongStreak App and its features\n• Allow you to track your fitness progress and view historical workout data\n• Enable social features such as sharing achievements, following other users, and participating in groups\n• Personalise your experience and improve the App's functionality\n• Communicate with you about updates, new features, or support-related matters\n• Ensure the security and integrity of the App",
  },
  {
    title: "3. Data Sharing and Disclosure",
    body: "We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following limited circumstances:\n\n• Service Providers: Trusted third-party service providers who assist in operating our App (e.g., cloud hosting, analytics), subject to confidentiality agreements\n• Legal Requirements: If required by law, regulation, or legal process\n• Business Transfers: In the event of a merger, acquisition, or sale of assets",
  },
  {
    title: "4. Data Retention",
    body: "We retain your personal data for as long as your account is active or as needed to provide you with our services. You may request deletion of your account and associated data at any time by contacting us at hamza@zod-alkhair.com.",
  },
  {
    title: "5. Your Rights",
    body: "Depending on your location, you may have the following rights regarding your personal data:\n\n• The right to access the personal data we hold about you\n• The right to request correction of inaccurate data\n• The right to request deletion of your personal data\n• The right to withdraw consent at any time where processing is based on consent\n\nTo exercise any of these rights, please contact us at hamza@zod-alkhair.com.",
  },
  {
    title: "6. Children's Privacy",
    body: "StrongStreak is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will promptly delete it.",
  },
  {
    title: "7. Security",
    body: "We take the security of your data seriously and implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction.",
  },
  {
    title: "8. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the \"Last updated\" date at the top of this page. We encourage you to review this policy periodically.",
  },
  {
    title: "9. Contact Us",
    body: "If you have any questions or concerns about this Privacy Policy, please contact us:\n\nCompany: Zod Al-Khair Company for Information Technology\nEmail: hamza@zod-alkhair.com",
  },
];

interface LegalModalProps {
  visible: boolean;
  type: "terms" | "privacy";
  onClose: () => void;
  onAccept?: () => void;
}

export default function LegalModal({ visible, type, onClose, onAccept }: LegalModalProps) {
  const insets = useSafeAreaInsets();
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  const isTerms = type === "terms";
  const title = isTerms ? "Terms & Conditions" : "Privacy Policy";
  const lastUpdated = isTerms ? "April 5, 2026" : "March 29, 2026";
  const sections = isTerms ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
    if (atBottom) setScrolledToBottom(true);
  };

  const handleClose = () => {
    setScrolledToBottom(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top || 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#888" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 34 }} />
        </View>

        {/* Icon + intro */}
        <View style={styles.intro}>
          <View style={styles.iconCircle}>
            <Ionicons name={isTerms ? "shield-checkmark" : "lock-closed"} size={28} color="#FF4500" />
          </View>
          <Text style={styles.introSubtitle}>StrongStreak · Last updated: {lastUpdated}</Text>
          {isTerms && (
            <Text style={styles.introText}>
              By creating an account and using StrongStreak, you agree to be bound by these Terms and Conditions. Please read them carefully.
            </Text>
          )}
          {!isTerms && (
            <Text style={styles.introText}>
              This Privacy Policy describes how Zod Al-Khair Company for Information Technology collects, uses, and protects your information when you use StrongStreak.
            </Text>
          )}
        </View>

        {/* Scroll hint */}
        {!scrolledToBottom && onAccept && (
          <Text style={styles.scrollHint}>Scroll down to read all terms</Text>
        )}

        {/* Content */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          showsVerticalScrollIndicator
        >
          {sections.map((section, i) => (
            <View
              key={i}
              style={[
                styles.section,
                (section as any).danger && styles.sectionDanger,
              ]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  (section as any).danger && styles.sectionTitleDanger,
                ]}
              >
                {section.title}
              </Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
          <Text style={styles.copyright}>
            © 2026 Zod Al-Khair Company for Information Technology. All rights reserved.
          </Text>
        </ScrollView>

        {/* Accept button (only on Terms when used during onboarding) */}
        {onAccept && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[styles.acceptBtn, !scrolledToBottom && styles.acceptBtnDisabled]}
              onPress={() => {
                if (!scrolledToBottom) return;
                handleClose();
                onAccept();
              }}
              activeOpacity={scrolledToBottom ? 0.8 : 1}
            >
              <Text style={styles.acceptBtnText}>
                {scrolledToBottom ? "I Agree & Continue" : "Read all terms to continue"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerNote}>
              By tapping "I Agree", you confirm you are 13+ years old and accept these Terms & Conditions, including our zero-tolerance policy for objectionable content and abusive behavior.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#1a1a1a",
  },
  closeBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  intro: { alignItems: "center", paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, gap: 8 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FF450020", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  introSubtitle: { color: "#666", fontSize: 12 },
  introText: { color: "#888", fontSize: 13, textAlign: "center", lineHeight: 20 },
  scrollHint: { color: "#555", fontSize: 11, textAlign: "center", marginBottom: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  section: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, gap: 8 },
  sectionDanger: { backgroundColor: "#ef444410", borderWidth: 1, borderColor: "#ef444430" },
  sectionTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  sectionTitleDanger: { color: "#ef4444" },
  sectionBody: { color: "#aaa", fontSize: 13, lineHeight: 20 },
  copyright: { color: "#444", fontSize: 11, textAlign: "center", paddingTop: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#1a1a1a" },
  acceptBtn: { backgroundColor: "#FF4500", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  acceptBtnDisabled: { backgroundColor: "#333" },
  acceptBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  footerNote: { color: "#555", fontSize: 11, textAlign: "center", lineHeight: 16 },
});
