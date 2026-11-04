import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useRef, useState } from "react";
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n";
import { colors, fonts, TOUCH_SIZE } from "../theme";

export type InfoKey = keyof typeof t.help.info;

// Distance de glissement vers le bas qui ferme la carte
const DISMISS_DISTANCE = 80;

// Fin du glissement : assez loin ou assez vite vers le bas pour fermer
export const shouldDismiss = (dy: number, vy: number) => dy > DISMISS_DISTANCE || vy > 1;

interface Props {
  info: InfoKey;
  color?: string;
}

// Petite icône « i » : un appui ouvre une carte d'explication en bas de l'écran
export default function InfoButton({ info, color = colors.textMuted }: Props) {
  const [open, setOpen] = useState(false);
  const { title } = t.help.info[info];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.help.infoLabel(title)}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons name="information-circle-outline" size={20} color={color} />
      </Pressable>
      {/* Montée seulement à l'ouverture : les nombreux boutons « i » ne coûtent rien */}
      {open && <InfoSheet info={info} onClose={() => setOpen(false)} />}
    </>
  );
}

// Carte d'explication : titre, 1 à 3 phrases et un exemple.
// Se ferme par un appui à côté, un glissement vers le bas ou le bouton retour.
export function InfoSheet({ info, onClose }: { info: InfoKey; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { title, body, example } = t.help.info[info];
  const translateY = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (shouldDismiss(g.dy, g.vy)) onClose();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () =>
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;

  return (
    <Modal
      testID="info-sheet"
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t.help.close}
      />
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 24, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.grabber} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.example}>
          <Text style={styles.exampleText}>{t.help.example(example)}</Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Zone tactile de 44 px sans agrandir la ligne qui l'accueille
  button: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    marginVertical: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 12,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.text,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  example: {
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    padding: 14,
  },
  exampleText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
