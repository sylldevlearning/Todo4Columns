// App.tsx

import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import Column from "./src/components/Column";
import TimerModal from "./src/components/TimerModal";
import { CATEGORIES } from "./src/constants/categories";
import { SPACING } from "./src/constants/layout";
import { useTasks } from "./src/hooks/useTasks";
import { Category } from "./src/types";

export default function App() {
  const { tasks, addTask, toggleDone, removeTask, startTimer } = useTasks();
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("UI");
  // Tâche dont on saisit la durée du timer (null = modal fermée)
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);

  // Ajouter une tâche
  const handleAdd = () => {
    const title = inputText.trim();
    if (!title) return;
    addTask(title, selectedCategory);
    setInputText("");
  };

  // Confirmation avant suppression
  const confirmAndRemove = (id: string) => {
    Alert.alert(
      "Supprimer la tâche",
      "Voulez-vous vraiment supprimer cette tâche ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "SUPPRIMER",
          style: "destructive",
          onPress: () => removeTask(id),
        },
      ]
    );
  };

  const validateTimer = (minutes: number) => {
    if (timerTaskId) startTimer(timerTaskId, minutes);
    setTimerTaskId(null);
  };

  // Récupérer la largeur de l'écran pour déterminer la largeur minimale des colonnes
  const windowWidth = Dimensions.get("window").width;
  const columnWidth = Math.max(windowWidth / 4, 260);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* --- HEADER : titre + auteur --- */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>MATRICE</Text>
            <Text style={styles.headerSubtitle}>Eisenhower</Text>
          </View>

          {/* --- Zone de création de tâche --- */}
          <View style={styles.inputSection}>
            {/* Choix de catégorie (boutons centrés) */}
            <View style={styles.categorySelector}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  style={[
                    styles.catButton,
                    selectedCategory === cat.key && styles.catButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.catButtonText,
                      selectedCategory === cat.key && styles.catTextSelected,
                    ]}
                  >
                    {cat.shortLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input pour nouvelle tâche */}
            <TextInput
              style={styles.input}
              placeholder="Nouvelle tâche…"
              placeholderTextColor="#888888"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />

            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>AJOUTER</Text>
            </TouchableOpacity>
          </View>

          {/* --- Affichage des colonnes avec scroll horizontal --- */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.columnsWrapper}
          >
            {CATEGORIES.map((cat) => (
              <Column
                key={cat.key}
                category={cat}
                tasks={tasks.filter((t) => t.category === cat.key)}
                width={columnWidth}
                onToggleDone={toggleDone}
                onOpenTimer={setTimerTaskId}
                onRemove={confirmAndRemove}
              />
            ))}
          </ScrollView>

          <TimerModal
            visible={timerTaskId !== null}
            onCancel={() => setTimerTaskId(null)}
            onValidate={validateTimer}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: SPACING,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#BB86FC", // violet accent
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#888888",
    marginTop: SPACING / 4,
  },

  // Section d'entrée
  inputSection: {
    paddingHorizontal: SPACING,
    paddingVertical: SPACING / 2,
    backgroundColor: "#1F1B24",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  categorySelector: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginBottom: SPACING / 2,
  },
  catButton: {
    flex: 1,
    marginHorizontal: SPACING / 4,
    paddingVertical: SPACING / 2,
    borderRadius: 8,
    backgroundColor: "#2C2A33",
    alignItems: "center",
  },
  catButtonSelected: {
    backgroundColor: "#BB86FC",
  },
  catButtonText: {
    color: "#E5E5E5",
    fontSize: 14,
    fontWeight: "700",
  },
  catTextSelected: {
    color: "#121212",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 8,
    paddingHorizontal: SPACING / 1.5,
    fontSize: 18,
    fontWeight: "700",
    backgroundColor: "#1F1B24",
    color: "#E5E5E5",
    marginBottom: SPACING / 2,
  },
  addButton: {
    alignSelf: "center",
    backgroundColor: "#03DAC6",
    paddingVertical: SPACING / 2,
    paddingHorizontal: SPACING * 1.5,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "700",
  },

  // Colonnes
  columnsWrapper: {
    paddingVertical: SPACING / 2,
    paddingHorizontal: SPACING / 2,
  },
});
