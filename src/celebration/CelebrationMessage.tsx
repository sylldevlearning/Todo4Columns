import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, withAlpha } from "../theme";
import { CELEBRATION_MS } from "./plan";

const IN_MS = 260;
const OUT_MS = 380;

interface Props {
  message: string;
  color: string; // couleur du quadrant
  reduceMotion: boolean;
}

// Carte arrondie en haut de l'écran : loin du bandeau « Annuler » et du bouton flottant
export default function CelebrationMessage({ message, color, reduceMotion }: Props) {
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.back(1.6)) }),
      withDelay(CELEBRATION_MS - IN_MS - OUT_MS, withTiming(0, { duration: OUT_MS }))
    );
  }, [progress]);

  // Animations réduites : simple fondu, sans mouvement
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1),
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - progress.value) * -16 }, { scale: 0.94 + 0.06 * progress.value }],
  }));

  return (
    <View pointerEvents="none" style={[styles.container, { top: insets.top + 10 }]}>
      <Animated.View
        testID="celebration-message"
        style={[styles.card, { borderColor: withAlpha(color, 0.5) }, style]}
      >
        <Ionicons name="checkmark-circle" size={22} color={color} />
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 420,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.surfaceRaised,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  text: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
});
