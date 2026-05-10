import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE } from "@/constants/api";
import { eventTagOptions } from "@/constants/event-tags";
import { interestOptions } from "@/constants/interests";
import { flatButton, flatOutline, palette } from "@/constants/palette";
import { auth } from "../../firebase";

const DRAFT_KEY = "hackdavis:onboarding-draft";

type Draft = {
  display_name?: string;
  personality_type?: string;
  interests?: string[];
  preferred_tags?: string[];
  availability?: string[];
  home_location?: string;
  free_time_activities?: string[];
  onboarding_answers?: Record<string, string>;
};

type StepConfig = {
  step: number;
  title: string;
  subtitle: string;
  field: keyof Draft;
  answerKey?: string;
  inputPlaceholder?: string;
  singleSelectOptions?: readonly string[];
  multiSelectOptions?: readonly string[];
  nextRoute?: string;
};

const personalityOptions = ["Introvert", "Extrovert", "Ambivert"] as const;

const availabilityOptions = [
  "Weekday mornings",
  "Weekday afternoons",
  "Weekday nights",
  "Weekend mornings",
  "Weekend afternoons",
  "Weekend nights",
] as const;

const freeTimeOptions = [
  "Try new food",
  "Go to concerts",
  "Study with friends",
  "Play sports",
  "Volunteer",
  "Meet new people",
  "Build projects",
  "Explore outdoors",
  "Attend workshops",
  "Go to parties",
  "Book clubs",
  "Play board games",
] as const;

export const onboardingSteps: Record<number, StepConfig> = {
  1: {
    step: 1,
    title: "Are you an Introvert, Extrovert, or Ambivert?",
    subtitle: "This will tailor to your interests in events.",
    field: "personality_type",
    answerKey: "personality_type",
    singleSelectOptions: personalityOptions,
    nextRoute: "/onboarding/step2",
  },
  2: {
    step: 2,
    title: "What kind of events fit your vibe?",
    subtitle: "Choose any that sound like you.",
    field: "interests",
    multiSelectOptions: interestOptions,
    nextRoute: "/onboarding/step3",
  },
  3: {
    step: 3,
    title: "Which event tags do you want more of?",
    subtitle: "These help tune your For You section.",
    field: "preferred_tags",
    multiSelectOptions: eventTagOptions,
    nextRoute: "/onboarding/step4",
  },
  4: {
    step: 4,
    title: "When are you usually free?",
    subtitle: "Pick the times you are most likely to go out.",
    field: "availability",
    multiSelectOptions: availabilityOptions,
    nextRoute: "/onboarding/step5",
  },
  5: {
    step: 5,
    title: "Select what do you like to do in your free time.",
    subtitle: "Choose the activities you want events to match.",
    field: "free_time_activities",
    multiSelectOptions: freeTimeOptions,
  },
};

const loadDraft = async (): Promise<Draft> => {
  const saved = await AsyncStorage.getItem(DRAFT_KEY);
  return saved ? (JSON.parse(saved) as Draft) : {};
};

const saveDraft = async (draft: Draft) => {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

const toggleValue = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((currentValue) => currentValue !== value)
    : [...values, value];

export function OnboardingScreen({ step }: { step: number }) {
  const router = useRouter();
  const config = onboardingSteps[step];
  const [draft, setDraft] = useState<Draft>({});
  const [textValue, setTextValue] = useState("");
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const hydrate = async () => {
      try {
        const savedDraft = await loadDraft();
        setDraft(savedDraft);
        const fieldValue = savedDraft[config.field];

        if (Array.isArray(fieldValue)) {
          setSelectedValues(fieldValue);
        } else if (typeof fieldValue === "string") {
          if (config.singleSelectOptions) {
            setSelectedValues([fieldValue]);
          } else {
            setTextValue(fieldValue);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, [config.field, config.singleSelectOptions]);

  useEffect(() => {
    contentOpacity.setValue(0);
    contentTranslateY.setValue(12);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        duration: 220,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentTranslateY, step]);

  const buildNextDraft = () => {
    const nextDraft: Draft = {
      ...draft,
      onboarding_answers: {
        ...draft.onboarding_answers,
      },
    };

    if (config.multiSelectOptions) {
      nextDraft[config.field] = selectedValues as never;
      nextDraft.onboarding_answers![config.field] = selectedValues.join(", ");
    } else if (config.singleSelectOptions) {
      const selectedValue = selectedValues[0] ?? "";
      nextDraft[config.field] = selectedValue as never;
      nextDraft.onboarding_answers![config.field] = selectedValue;
    } else {
      nextDraft[config.field] = textValue.trim() as never;
      if (config.answerKey) {
        nextDraft.onboarding_answers![config.answerKey] = textValue.trim();
      }
    }

    return nextDraft;
  };

  const canContinue = config.multiSelectOptions || config.singleSelectOptions
    ? selectedValues.length > 0
    : textValue.trim().length > 0;

  const goNext = async () => {
    if (!canContinue) {
      Alert.alert("Answer required", "Choose or enter an answer to continue.");
      return;
    }

    const nextDraft = buildNextDraft();
    setSaving(true);

    try {
      await saveDraft(nextDraft);

      if (config.nextRoute) {
        router.push(config.nextRoute as never);
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Not signed in", "Please sign in again to finish setup.");
        router.replace("/" as never);
        return;
      }

      const response = await fetch(`${API_BASE}/api/users/${user.uid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          personality_type: nextDraft.personality_type ?? null,
          interests: nextDraft.interests ?? [],
          preferred_tags: nextDraft.preferred_tags ?? [],
          availability: nextDraft.availability ?? [],
          home_location: nextDraft.home_location ?? null,
          free_time_activities: nextDraft.free_time_activities ?? [],
          onboarding_answers: nextDraft.onboarding_answers ?? {},
          onboarding_completed: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Profile save failed with status ${response.status}`);
      }

      await AsyncStorage.removeItem(DRAFT_KEY);
      router.replace("/home" as never);
    } catch (error) {
      console.error(error);
      Alert.alert("Could not save", "Check that the backend is running, then try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={palette.coral} style={styles.loader} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.progressRow}>
            {Object.keys(onboardingSteps).map((stepKey) => {
              const active = Number(stepKey) <= step;
              return (
                <View
                  key={stepKey}
                  style={[styles.progressDot, active && styles.progressDotActive]}
                />
              );
            })}
          </View>

          <Animated.View
            style={{
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            }}
          >
            <View style={styles.header}>
              <Text style={styles.stepLabel}>Step {step} of 5</Text>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.subtitle}>{config.subtitle}</Text>
            </View>

            {config.multiSelectOptions || config.singleSelectOptions ? (
              <View style={styles.optionGrid}>
                {(config.multiSelectOptions ?? config.singleSelectOptions ?? []).map((option) => {
                  const selected = selectedValues.includes(option);
                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      key={option}
                      onPress={() => {
                        if (config.singleSelectOptions) {
                          setSelectedValues([option]);
                          return;
                        }

                        setSelectedValues((currentValues) =>
                          toggleValue(currentValues, option)
                        );
                      }}
                      style={[styles.option, selected && styles.optionSelected]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TextInput
                autoCapitalize="words"
                onChangeText={setTextValue}
                placeholder={config.inputPlaceholder}
                placeholderTextColor={palette.textSubtle}
                returnKeyType="done"
                style={styles.input}
                value={textValue}
              />
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={saving}
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saving}
            onPress={goNext}
            style={[
              styles.nextButton,
              step === 1 && styles.nextButtonFull,
              saving && styles.nextButtonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === 5 ? "Finish" : "Continue"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: palette.bg,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loader: {
    marginTop: 80,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 32,
  },
  progressDot: {
    backgroundColor: palette.border,
    borderRadius: 999,
    flex: 1,
    height: 6,
  },
  progressDotActive: {
    backgroundColor: palette.coral,
  },
  header: {
    marginBottom: 24,
  },
  stepLabel: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  title: {
    color: palette.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  input: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1.5,
    color: palette.textPrimary,
    fontSize: 17,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  option: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  optionSelected: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  optionText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  optionTextSelected: {
    color: "#fff",
  },
  footer: {
    backgroundColor: palette.bg,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 16,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
    ...flatOutline,
  },
  backButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  nextButton: {
    alignItems: "center",
    backgroundColor: palette.coral,
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
    ...flatButton("coral"),
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
