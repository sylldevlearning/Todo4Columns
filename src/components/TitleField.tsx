import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { formatDue } from "../format";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { currentLanguage, t } from "../i18n";
import { analyzeTitle, DateSuggestion } from "../smartInput";
import { colors, fonts, TOUCH_SIZE, withAlpha } from "../theme";
import InfoButton from "./InfoButton";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  autoFocus: boolean;
  autoStartVoice?: boolean; // appui long sur « + » : la dictée démarre à l'ouverture
  urgent: boolean;
  important: boolean;
  accent: string; // couleur du quadrant
  onApplyDate: (date: DateSuggestion) => void; // « Appliquer » : échéance et titre sans l'expression
  onTurnOnUrgent: () => void;
  onTurnOnImportant: () => void;
}

// Champ titre de la fiche : bouton micro (dictée), puis suggestions tirées du titre (date,
// « urgent », « important »). Rien n'est appliqué sans un appui sur la suggestion.
export default function TitleField({
  value,
  onChangeText,
  onSubmitEditing,
  autoFocus,
  autoStartVoice = false,
  urgent,
  important,
  accent,
  onApplyDate,
  onTurnOnUrgent,
  onTurnOnImportant,
}: Props) {
  const voice = useVoiceInput({ onText: onChangeText });
  // Suggestions écartées (« Ignorer ») : la date par son expression, les mots une fois pour toutes
  const [dismissed, setDismissed] = useState<{ date: string | null; urgent: boolean; important: boolean }>({
    date: null,
    urgent: false,
    important: false,
  });

  useEffect(() => {
    if (autoStartVoice) void voice.start(value);
    // Une seule fois, à l'ouverture de la fiche
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Analyse locale du titre ; pas pendant la dictée (le texte change à chaque mot)
  const analysis = useMemo(
    () => (voice.listening ? null : analyzeTitle(value, currentLanguage(), Date.now())),
    [value, voice.listening]
  );
  const date = analysis?.date && analysis.date.text !== dismissed.date ? analysis.date : null;
  const showUrgent = !!analysis?.urgent && !urgent && !dismissed.urgent;
  const showImportant = !!analysis?.important && !important && !dismissed.important;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder={voice.listening ? t.voice.listening : t.form.titlePlaceholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          autoFocus={autoFocus && !autoStartVoice}
          returnKeyType="done"
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={t.form.titleLabel}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voice.listening ? t.voice.stop : t.voice.start}
          accessibilityState={{ selected: voice.listening }}
          onPress={() => (voice.listening ? voice.stop() : voice.start(value))}
          style={({ pressed }) => [
            styles.mic,
            voice.listening && { backgroundColor: withAlpha(accent, 0.2), borderColor: accent },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name={voice.listening ? "stop" : "mic-outline"} size={22} color={voice.listening ? accent : colors.text} />
        </Pressable>
        <InfoButton info="voice" />
      </View>
      {voice.listening && (
        <Text style={styles.listening} accessibilityLiveRegion="polite">
          {t.voice.listening}
        </Text>
      )}

      {date && (
        <Suggestion
          text={t.smart.due(formatDue(date.due))}
          action={t.smart.apply}
          accent={accent}
          onApply={() => onApplyDate(date)}
          onDismiss={() => setDismissed((d) => ({ ...d, date: date.text }))}
        />
      )}
      {showUrgent && (
        <Suggestion
          text={t.smart.urgent}
          action={t.smart.turnOn}
          accent={accent}
          onApply={onTurnOnUrgent}
          onDismiss={() => setDismissed((d) => ({ ...d, urgent: true }))}
        />
      )}
      {showImportant && (
        <Suggestion
          text={t.smart.important}
          action={t.smart.turnOn}
          accent={accent}
          onApply={onTurnOnImportant}
          onDismiss={() => setDismissed((d) => ({ ...d, important: true }))}
        />
      )}
    </View>
  );
}

function Suggestion({
  text,
  action,
  accent,
  onApply,
  onDismiss,
}: {
  text: string;
  action: string;
  accent: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.suggestion, { borderColor: withAlpha(accent, 0.35) }]} accessibilityLiveRegion="polite">
      <Ionicons name="sparkles-outline" size={16} color={colors.textMuted} />
      <Text style={styles.suggestionText}>{text}</Text>
      <Pressable accessibilityRole="button" onPress={onApply} style={styles.suggestionButton}>
        <Text style={[styles.suggestionAction, { color: accent }]}>{action}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.smart.dismiss} : ${text}`}
        onPress={onDismiss}
        style={styles.suggestionButton}
      >
        <Ionicons name="close" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
  mic: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: TOUCH_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  listening: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 12,
    backgroundColor: colors.bg,
  },
  suggestionText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 8,
  },
  suggestionButton: {
    minHeight: TOUCH_SIZE,
    minWidth: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  suggestionAction: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
