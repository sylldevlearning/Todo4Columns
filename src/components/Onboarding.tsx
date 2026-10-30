import React, { ComponentType, useRef, useState } from "react";
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { t } from "../i18n";
import { useSettingsReady, useSettingsSelector, useTaskActions } from "../store/TasksContext";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import {
  CreateIllustration,
  GesturesIllustration,
  MatrixIllustration,
} from "./OnboardingIllustrations";

// Textes lus à l'affichage, dans la langue courante
const PAGES: { text: () => { title: string; body: string }; Illustration: ComponentType }[] = [
  { text: () => t.onboarding.matrix, Illustration: MatrixIllustration },
  { text: () => t.onboarding.create, Illustration: CreateIllustration },
  { text: () => t.onboarding.gestures, Illustration: GesturesIllustration },
];

interface Props {
  onDone: () => void; // « Passer », « C'est parti » ou bouton retour
}

// Présentation en 3 écrans à faire défiler, avec « Passer » toujours visible
export default function Onboarding({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  const next = () => {
    if (last) return onDone();
    scroll.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDone}
      testID="onboarding"
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" onPress={onDone} style={styles.skip}>
            <Text style={styles.skipText}>{t.onboarding.skip}</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={styles.pager}
          testID="onboarding-pager"
        >
          {PAGES.map(({ text, Illustration }, i) => (
            <ScrollView
              key={i}
              style={{ width }}
              contentContainerStyle={styles.page}
              // Seul l'écran affiché est lu par les lecteurs d'écran
              accessibilityElementsHidden={i !== page}
              importantForAccessibility={i === page ? "auto" : "no-hide-descendants"}
            >
              <Illustration />
              <View style={styles.text}>
                <Text style={styles.title} accessibilityRole="header">
                  {text().title}
                </Text>
                <Text style={styles.body}>{text().body}</Text>
              </View>
            </ScrollView>
          ))}
        </ScrollView>

        <View style={styles.bottom}>
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={t.onboarding.progress(page + 1, PAGES.length)}
          >
            {PAGES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={next}
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Text style={styles.nextText}>{last ? t.onboarding.start : t.onboarding.next}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Présentation montrée une seule fois, aussi aux utilisateurs qui font la mise à jour.
// Attend la lecture des réglages : rien ne s'affiche pour qui l'a déjà vue.
export function FirstLaunchOnboarding() {
  const ready = useSettingsReady();
  const done = useSettingsSelector((s) => s.onboardingDone);
  const { updateSettings, getSettings } = useTaskActions();
  if (!ready || done) return null;
  return <Onboarding onDone={() => updateSettings({ ...getSettings(), onboardingDone: true })} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  top: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  skip: {
    minHeight: TOUCH_SIZE,
    minWidth: TOUCH_SIZE,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textMuted,
  },
  pager: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 32,
  },
  text: {
    gap: 10,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 26,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bottom: {
    paddingHorizontal: 24,
    gap: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: colors.text,
  },
  next: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CATEGORY_BY_KEY.UI.color,
  },
  nextText: {
    fontFamily: fonts.extrabold,
    fontSize: 16,
    color: CATEGORY_BY_KEY.UI.onColor,
  },
  pressed: {
    opacity: 0.85,
  },
});
