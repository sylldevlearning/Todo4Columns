import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SPACING } from "../constants/layout";

interface Props {
  visible: boolean;
  onCancel: () => void;
  onValidate: (minutes: number) => void;
}

// Fenêtre de saisie de la durée du timer (le bouton retour Android la ferme)
export default function TimerModal({ visible, onCancel, onValidate }: Props) {
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
      <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Durée du Timer (en min)</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Ex. : 10"
            placeholderTextColor="#AAAAAA"
            value={input}
            onChangeText={setInput}
            keyboardType="numeric"
          />
          <View style={styles.modalButtonsRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancel]}
              onPress={onCancel}
            >
              <Text style={styles.modalButtonText}>ANNULER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalValidate]}
              onPress={validate}
            >
              <Text style={styles.modalButtonText}>VALIDER</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#1F1B24",
    borderRadius: 12,
    padding: SPACING,
    borderWidth: 1,
    borderColor: "#333333",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E5E5E5",
    marginBottom: SPACING / 2,
    textAlign: "center",
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 8,
    paddingHorizontal: SPACING / 2,
    fontSize: 16,
    color: "#E5E5E5",
    backgroundColor: "#2C2A33",
    marginBottom: SPACING,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING / 2,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancel: {
    backgroundColor: "#CF6679",
    marginRight: SPACING / 4,
  },
  modalValidate: {
    backgroundColor: "#03DAC6",
    marginLeft: SPACING / 4,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#121212",
  },
});
