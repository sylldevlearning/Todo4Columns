// App.tsx

import React, { useEffect, useState, useRef } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Types de catégorie
type Category = "UI" | "INU" | "UDI" | "NDNI";

interface Task {
  id: string;
  title: string;
  category: Category;
  isDone: boolean;
  timerEnd: number | null; // timestamp en ms où le timer se termine, ou null
}

// Clé de stockage dans AsyncStorage
const STORAGE_KEY = "TASKS_4COLS";

export default function App() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("UI");

  // ---- États pour gérer le "modal" de saisie du timer ----
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [timerTaskId, setTimerTaskId] = useState<string | null>(null);
  const [timerInput, setTimerInput] = useState(""); // saisie en minutes

  // Référence vers l’intervalle de mise à jour du compteur
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Charger les tâches sauvegardées au démarrage
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const saved: Task[] = JSON.parse(json);
          setAllTasks(saved);
        }
      } catch (e) {
        console.warn("Erreur récupération tâches :", e);
      }
    })();
  }, []);

  // Sauvegarder à chaque modification de la liste
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
      } catch (e) {
        console.warn("Erreur sauvegarde tâches :", e);
      }
    })();
  }, [allTasks]);

  // ---- Gestion du compte à rebours ----
  useEffect(() => {
    // À chaque seconde, on vérifie s'il y a des timers actifs
    intervalRef.current = setInterval(() => {
      setAllTasks((prev) => {
        const now = Date.now();
        return prev.map((task) => {
          if (task.timerEnd && now >= task.timerEnd) {
            // Timer écoulé : on déclenche une alerte (une seule fois)
            Alert.alert(
              "Temps écoulé",
              `Le délai pour la tâche "${task.title}" est terminé !`
            );
            return { ...task, timerEnd: null };
          }
          return task;
        });
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Ajouter une tâche
  const addTask = () => {
    const title = inputText.trim();
    if (!title) return;
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      category: selectedCategory,
      isDone: false,
      timerEnd: null,
    };
    setAllTasks((prev) => [...prev, newTask]);
    setInputText("");
  };

  // Basculer le statut "terminée"
  const toggleDone = (id: string) => {
    setAllTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t))
    );
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
          onPress: () => {
            setAllTasks((prev) => prev.filter((t) => t.id !== id));
          },
        },
      ]
    );
  };

  // Ouvre le "modal" de saisie de durée pour la tâche sélectionnée
  const openTimerModal = (id: string) => {
    setTimerTaskId(id);
    setTimerInput("");
    setTimerModalVisible(true);
  };

  // Valide la saisie de la durée (en minutes) et calcule timerEnd
  const validateTimer = () => {
    if (!timerTaskId) return;
    const minutes = parseInt(timerInput, 10);
    if (isNaN(minutes) || minutes <= 0) {
      Alert.alert(
        "Durée invalide",
        "Veuillez entrer un nombre de minutes valide."
      );
      return;
    }
    const endTimestamp = Date.now() + minutes * 60 * 1000;
    setAllTasks((prev) =>
      prev.map((t) =>
        t.id === timerTaskId ? { ...t, timerEnd: endTimestamp } : t
      )
    );
    setTimerModalVisible(false);
    setTimerTaskId(null);
    setTimerInput("");
  };

  // Fermeture du "modal" sans validation
  const cancelTimer = () => {
    setTimerModalVisible(false);
    setTimerTaskId(null);
    setTimerInput("");
  };

  // Filtrer par catégorie
  const tasksByCategory = (cat: Category) =>
    allTasks.filter((t) => t.category === cat);

  // Récupérer la largeur de l'écran pour déterminer la largeur minimale des colonnes
  const windowWidth = Dimensions.get("window").width;
  const columnWidth = Math.max(windowWidth / 4, 260);

  // Formate le temps restant en "MM:SS"
  const formatRemaining = (endTs: number | null): string => {
    if (!endTs) return "";
    const diffSec = Math.max(Math.ceil((endTs - Date.now()) / 1000), 0);
    const m = Math.floor(diffSec / 60)
      .toString()
      .padStart(2, "0");
    const s = (diffSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* --- HEADER : titre + auteur --- */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MATRICE</Text>
          <Text style={styles.headerSubtitle}>eiseinoeur</Text>
        </View>

        {/* --- Zone de création de tâche --- */}
        <View style={styles.inputSection}>
          {/* Choix de catégorie (boutons centrés) */}
          <View style={styles.categorySelector}>
            {(["UI", "INU", "UDI", "NDNI"] as Category[]).map((cat) => {
              let label = "";
              switch (cat) {
                case "UI":
                  label = "U-I";
                  break;
                case "INU":
                  label = "NU-I";
                  break;
                case "UDI":
                  label = "U-NI";
                  break;
                case "NDNI":
                  label = "NU-NI";
                  break;
              }
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catButton,
                    selectedCategory === cat && styles.catButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.catButtonText,
                      selectedCategory === cat && styles.catTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Input pour nouvelle tâche */}
          <TextInput
            style={styles.input}
            placeholder="Nouvelle tâche…"
            placeholderTextColor="#888888"
            value={inputText}
            onChangeText={setInputText}
          />

          <TouchableOpacity style={styles.addButton} onPress={addTask}>
            <Text style={styles.addButtonText}>AJOUTER</Text>
          </TouchableOpacity>
        </View>

        {/* --- Affichage des colonnes avec scroll horizontal --- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.columnsWrapper}
        >
          {(["UI", "INU", "UDI", "NDNI"] as Category[]).map((cat) => (
            <View key={cat} style={[styles.column, { width: columnWidth }]}>
              <Text style={styles.columnTitle}>
                {cat === "UI"
                  ? "Urgent + Important"
                  : cat === "INU"
                  ? "Important + Non-urgent"
                  : cat === "UDI"
                  ? "Urgent + Déléguer"
                  : "Ni Urgent ni Important"}
              </Text>
              <ScrollView contentContainerStyle={styles.scrollContent}>
                {tasksByCategory(cat).map((task) => (
                  <View key={task.id} style={styles.taskItem}>
                    <TouchableOpacity
                      onPress={() => toggleDone(task.id)}
                      style={styles.checkbox}
                    >
                      <Text style={styles.checkboxEmoji}>
                        {task.isDone ? "✅" : "⬜️"}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.textAndTimer}>
                      <Text
                        style={[
                          styles.taskText,
                          task.isDone && styles.taskTextDone,
                        ]}
                      >
                        {task.title}
                      </Text>
                      {task.timerEnd && (
                        <Text style={styles.timerText}>
                          ⏱ {formatRemaining(task.timerEnd)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.iconsRight}>
                      <TouchableOpacity onPress={() => openTimerModal(task.id)}>
                        <Text style={styles.timerIcon}>⏱️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmAndRemove(task.id)}
                      >
                        <Text style={styles.deleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        {/* --- "Modal" de saisie du timer (overlay) --- */}
        {timerModalVisible && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Durée du Timer (en min)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex. : 10"
                placeholderTextColor="#AAAAAA"
                value={timerInput}
                onChangeText={setTimerInput}
                keyboardType="numeric"
              />
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={cancelTimer}
                >
                  <Text style={styles.modalButtonText}>ANNULER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalValidate]}
                  onPress={validateTimer}
                >
                  <Text style={styles.modalButtonText}>VALIDER</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const SPACING = Constants.statusBarHeight; // unité de marge/padding

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: SPACING,
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
  column: {
    marginHorizontal: SPACING / 4,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 8,
    backgroundColor: "#1F1B24",
    overflow: "hidden",
  },
  columnTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: SPACING / 2,
    backgroundColor: "#333333",
    color: "#E5E5E5",
  },
  scrollContent: {
    paddingBottom: SPACING / 2,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING / 1.5,
    paddingVertical: SPACING / 3,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  checkbox: {
    marginRight: SPACING / 2,
  },
  checkboxEmoji: {
    fontSize: 22,
    color: "#E5E5E5",
  },
  textAndTimer: {
    flex: 1,
    flexDirection: "column",
  },
  taskText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E5E5E5",
  },
  taskTextDone: {
    textDecorationLine: "line-through",
    color: "#777777",
    fontStyle: "italic",
  },
  timerText: {
    marginTop: 4,
    fontSize: 14,
    color: "#03DAC6",
    fontWeight: "700",
  },
  iconsRight: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: SPACING / 2,
  },
  timerIcon: {
    fontSize: 20,
    color: "#BB86FC",
    marginRight: SPACING / 2,
  },
  deleteText: {
    fontSize: 18,
    color: "#CF6679",
  },

  // Modal (overlay) pour le timer
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
