import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, fonts, TOUCH_SIZE } from "../theme";

interface Props {
  visible: boolean;
  color: string; // couleur du quadrant
  onColor: string;
  onCancel: () => void;
  onValidate: (minutes: number) => void;
}

// Fenêtre de saisie de la durée du timer (le bouton retour Android la ferme)
export default function TimerModal({
  visible,
  color,
  onColor,
  onCancel,
  onValidate,
}: Props) {
  const [input, setInput] = useState(""); // saisie en minutes

  // Champ vide à chaque ouverture
  useEffect(() => {
    if (visible) setInput("");
  }, [visible]);

  const validate = () => {
    const minutes = parseInt(input, 10);
    if (isNaN(minutes) || minutes <= 0) {
      Alert.alert(
        "Durée invalide",
        "Veuillez entrer un nombre de minutes valide."
      );
      return;
    }
    onValidate(minutes);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <View style={styles.container}>
          <Text style={styles.title}>Minuteur</Text>
          <Text style={styles.subtitle}>Durée en minutes</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex. : 25"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            keyboardType="numeric"
            autoFocus
            accessibilityLabel="Durée du minuteur en minutes"
          />
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.cancel]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: color }]}
              onPress={validate}
            >
              <Text style={[styles.validateText, { color: onColor }]}>Démarrer</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "84%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 20,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: TOUCH_SIZE,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: {
    backgroundColor: colors.surfaceRaised,
  },
  cancelText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  validateText: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
