import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth } from "../../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

type Mode = "login" | "signup";

const ACCENT = "#6366F1";

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabAnimation = useRef(new Animated.Value(0)).current;

  const tabWidth = tabsWidth > 0 ? (tabsWidth - 8) / 2 : 0;

  useEffect(() => {
    Animated.spring(tabAnimation, {
      toValue: mode === "login" ? 0 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 16,
    }).start();
  }, [mode, tabAnimation]);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  const switchMode = (next: Mode) => {
    reset();
    setMode(next);
  };

  const validate = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return false;
    }

    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return false;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        Alert.alert("Missing name", "Please enter your full name.");
        return false;
      }

      if (password !== confirmPassword) {
        Alert.alert("Password mismatch", "Passwords do not match.");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      if (mode == "login") {
        await signInWithEmailAndPassword(auth, email, password);
        router.replace("/home");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        router.replace("/home");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }

    Alert.alert(
      mode === "login" ? "Logged in!" : "Account created!",
      mode === "login"
        ? `Welcome back, ${email}`
        : `Welcome, ${name}! Your account is ready.`,
      [{ text: "Continue", onPress: () => router.replace("/home") }]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>✦</Text>
            <Text style={styles.title}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "login"
                ? "Sign in to continue"
                : "Get started for free"}
            </Text>
          </View>

          <View style={styles.card}>
            <View
              onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}
              style={styles.tabs}
            >
              {tabWidth > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.tabIndicator,
                    {
                      width: tabWidth,
                      transform: [
                        {
                          translateX: Animated.multiply(tabAnimation, tabWidth),
                        },
                      ],
                    },
                  ]}
                />
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => switchMode("login")}
                style={styles.tab}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "login" && styles.tabTextActive,
                  ]}
                >
                  Log in
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => switchMode("signup")}
                style={styles.tab}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "signup" && styles.tabTextActive,
                  ]}
                >
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fields}>
              {mode === "signup" && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full name</Text>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={setName}
                    placeholder="Jane Smith"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="next"
                    style={styles.input}
                    value={name}
                  />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="next"
                  style={styles.input}
                  value={email}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    onChangeText={setPassword}
                    onSubmitEditing={
                      mode === "login" ? handleSubmit : undefined
                    }
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType={mode === "signup" ? "next" : "done"}
                    secureTextEntry={!showPassword}
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                  />
                  <TouchableOpacity
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onPress={() => setShowPassword((value) => !value)}
                    style={styles.eyeBtn}
                  >
                    <Text style={styles.eyeText}>
                      {showPassword ? "🙈" : "👁️"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {mode === "signup" && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    onChangeText={setConfirmPassword}
                    onSubmitEditing={handleSubmit}
                    placeholder="Repeat your password"
                    placeholderTextColor="#9CA3AF"
                    returnKeyType="done"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    value={confirmPassword}
                  />
                </View>
              )}

              {mode === "login" && (
                <TouchableOpacity style={styles.forgotBtn}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleSubmit}
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {mode === "login" ? "Sign in" : "Create account"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity activeOpacity={0.8} style={styles.socialBtn}>
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} style={styles.socialBtn}>
              <Text style={styles.socialIcon}>⌘</Text>
              <Text style={styles.socialText}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
            </Text>
            <TouchableOpacity
              onPress={() => switchMode(mode === "login" ? "signup" : "login")}
            >
              <Text style={styles.footerLink}>
                {mode === "login" ? "Sign up" : "Log in"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    color: ACCENT,
    fontSize: 32,
    marginBottom: 12,
  },
  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#6B7280",
    fontSize: 15,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    elevation: 4,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  tabs: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    flexDirection: "row",
    marginBottom: 24,
    padding: 4,
    position: "relative",
  },
  tabIndicator: {
    backgroundColor: "#fff",
    borderRadius: 8,
    bottom: 4,
    elevation: 2,
    left: 4,
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    top: 4,
  },
  tab: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 8,
    zIndex: 1,
  },
  tabText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#111827",
  },
  fields: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderWidth: 1.5,
    color: "#111827",
    fontSize: 15,
    height: 48,
    paddingHorizontal: 14,
  },
  passwordRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  passwordInput: {
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    flex: 1,
  },
  eyeBtn: {
    backgroundColor: "#FAFAFA",
    borderBottomRightRadius: 12,
    borderColor: "#E5E7EB",
    borderTopRightRadius: 12,
    borderWidth: 1.5,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  eyeText: {
    fontSize: 16,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -4,
  },
  forgotText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "500",
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: ACCENT,
    borderRadius: 14,
    height: 50,
    justifyContent: "center",
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginVertical: 20,
  },
  dividerLine: {
    backgroundColor: "#E5E7EB",
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  socialBtn: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: "row",
    gap: 10,
    height: 48,
    justifyContent: "center",
    marginBottom: 10,
  },
  socialIcon: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "700",
  },
  socialText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#6B7280",
    fontSize: 14,
  },
  footerLink: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: "600",
  },
});
