import Ionicons from "@expo/vector-icons/Ionicons";
import React, { ComponentType, useEffect, useRef, useState } from "react";
import { Settings } from "../settings";
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
import { isDriveAvailable } from "../drive/googleAccount";
import { useBackup } from "../hooks/useBackup";
import { useDriveBackup } from "../hooks/useDriveBackup";
import { t } from "../i18n";
import { usePermissionState } from "../notifications/usePermissionState";
import { useSettingsReady, useSettingsSelector, useTaskActions } from "../store/TasksContext";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import {
  CalendarVoiceIllustration,
  CreateIllustration,
  DriveIllustration,
  GesturesIllustration,
  MatrixIllustration,
  RemindersIllustration,
} from "./OnboardingIllustrations";

type PageId = "matrix" | "create" | "gestures" | "calendar" | "reminders" | "drive";

// Textes lus à l'affichage, dans la langue courante. 6 écrans au plus ; « Sauvegarde Google
// Drive » seulement là où elle existe (Android).
const ALL_PAGES: { id: PageId; text: () => { title: string; body: string }; Illustration: ComponentType }[] = [
  { id: "matrix", text: () => t.onboarding.matrix, Illustration: MatrixIllustration },
  { id: "create", text: () => t.onboarding.create, Illustration: CreateIllustration },
  { id: "gestures", text: () => t.onboarding.gestures, Illustration: GesturesIllustration },
  { id: "calendar", text: () => t.onboarding.calendar, Illustration: CalendarVoiceIllustration },
  { id: "reminders", text: () => t.onboarding.reminders, Illustration: RemindersIllustration },
  { id: "drive", text: () => t.onboarding.drive, Illustration: DriveIllustration },
];

interface Props {
  onDone: () => void; // « Passer », dernier écran terminé ou bouton retour
  // Réglages écrits en même temps à la fin (présentation du premier lancement : onboardingDone).
  // Une seule écriture : deux à la suite s'écraseraient (getSettings est lu au rendu suivant).
  extraSettings?: Partial<Settings>;
}

// Présentation à faire défiler, avec « Passer » sur chaque écran.
// - « Ne rate plus rien » : « Activer les rappels » affiche la fenêtre système d'Android puis
//   passe à l'écran suivant, quelle que soit la réponse ; « Plus tard » passe sans rien demander.
// - « Sauvegarde Google Drive » (facultative, dernier écran) : « Se connecter » ouvre la connexion
//   Google (sauvegarde automatique activée, restauration d'une sauvegarde existante) ;
//   « Plus tard » termine sans connexion.
export default function Onboarding({ onDone, extraSettings }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [PAGES] = useState(() => ALL_PAGES.filter((p) => p.id !== "drive" || isDriveAvailable()));
  const [page, setPage] = useState(0);
  const current = PAGES[page].id;
  const last = page === PAGES.length - 1;
  const [permission] = usePermissionState();
  const granted = permission === "granted";
  const { requestNotificationPermission, updateSettings, getSettings } = useTaskActions();
  const [asking, setAsking] = useState(false);
  const backup = useBackup();
  const drive = useDriveBackup(backup.applyBackup);
  const connected = drive.account !== null;

  // Écran Google Drive affiché au moins une fois
  const sawDrive = useRef(false);
  useEffect(() => {
    if (current === "drive") sawDrive.current = true;
  }, [current]);

  // Rappels et sauvegarde proposés : les cartes de la matrice ne les reproposeront pas. Passée
  // avant l'écran Google Drive (« Passer », bouton retour), la sauvegarde n'a pas été vue : la
  // carte de la matrice la proposera une fois, plus tard (10 tâches).
  const finish = () => {
    const settings = getSettings();
    const driveSkipped = PAGES.some((p) => p.id === "drive") && !sawDrive.current && current !== "drive";
    const drive =
      driveSkipped && !settings.drivePromptDone
        ? { driveDeferred: true }
        : { drivePromptDone: true, driveDeferred: undefined };
    updateSettings({ ...settings, remindersPromptDone: true, ...drive, ...extraSettings });
    onDone();
  };

  const goTo = (target: number) => {
    scroll.current?.scrollTo({ x: target * width, animated: true });
    setPage(target);
  };
  const advance = () => (last ? finish() : goTo(page + 1));

  const enableReminders = async () => {
    if (asking) return;
    setAsking(true);
    // Refusée et fenêtre système plus disponible : la carte « Ouvrir les réglages » s'affiche
    await requestNotificationPermission().catch(() => {});
    setAsking(false);
    advance();
  };

  const connectDrive = async () => {
    if (asking) return;
    setAsking(true);
    await drive.connect();
    setAsking(false);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  // Bouton principal et bouton secondaire (« Plus tard ») de chaque écran
  const primary =
    current === "reminders" && !granted
      ? { label: t.onboarding.enableReminders, onPress: enableReminders }
      : current === "drive" && !connected
      ? { label: t.onboarding.connect, onPress: connectDrive }
      : { label: last ? t.onboarding.start : t.onboarding.next, onPress: advance };
  const secondary = (current === "reminders" && !granted) || (current === "drive" && !connected);

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={finish}
      testID="onboarding"
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" onPress={finish} style={styles.skip}>
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
          {PAGES.map(({ id, text, Illustration }, i) => (
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
                {id === "reminders" && granted && (
                  <View style={styles.grantedRow}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    <Text style={styles.granted}>{t.onboarding.remindersOn}</Text>
                  </View>
                )}
                {id === "drive" && connected && (
                  <View style={styles.grantedRow}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    <Text style={styles.granted}>{t.onboarding.driveOn}</Text>
                  </View>
                )}
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
            onPress={primary.onPress}
            disabled={asking}
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Text style={styles.nextText}>{primary.label}</Text>
          </Pressable>
          {secondary && (
            <Pressable accessibilityRole="button" onPress={advance} disabled={asking} style={styles.later}>
              <Text style={styles.laterText}>{t.permissionCard.later}</Text>
            </Pressable>
          )}
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
  // Nouvelle installation : rappels et sauvegarde sont proposés dans la présentation, pas par les
  // cartes de la matrice ; seule exception : présentation passée avant l'écran Google Drive
  return <Onboarding extraSettings={{ onboardingDone: true }} onDone={() => {}} />;
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
    minHeight: TOUCH_SIZE + 4,
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
  grantedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  granted: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.success,
  },
  later: {
    minHeight: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -12,
  },
  laterText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.85,
  },
});
