import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDue } from "../format";
import { t } from "../i18n";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import IconButton from "./IconButton";

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  color: string;
}

// Demain à 9 h : proposé à l'ajout d'une échéance
function defaultDue(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

// Échéance : date puis heure (dialogues natifs sur Android, sélecteur compact sur iOS)
export default function DueDateField({ value, onChange, color }: Props) {
  const openAndroidPicker = () => {
    const initial = new Date(value ?? defaultDue());
    DateTimePickerAndroid.open({
      value: initial,
      mode: "date",
      onChange: (event, date) => {
        if (event.type !== "set" || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          onChange: (timeEvent, time) => {
            if (timeEvent.type === "set" && time) onChange(time.getTime());
          },
        });
      },
    });
  };

  const onPress = () => {
    if (Platform.OS === "android") openAndroidPicker();
    else if (value === null) onChange(defaultDue());
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          value === null ? t.dueDate.add : t.dueDate.label(formatDue(value))
        }
        onPress={onPress}
        style={styles.field}
      >
        <Ionicons name="calendar-outline" size={18} color={color} />
        {value !== null && Platform.OS === "ios" ? (
          <DateTimePicker
            value={new Date(value)}
            mode="datetime"
            display="compact"
            themeVariant="dark"
            accentColor={color}
            locale={t.locale}
            onChange={(_, date) => date && onChange(date.getTime())}
          />
        ) : (
          <Text style={[styles.text, value === null && styles.placeholder]}>
            {value === null ? t.dueDate.add : formatDue(value)}
          </Text>
        )}
      </Pressable>
      {value !== null && (
        <IconButton
          icon="close-circle"
          label={t.dueDate.remove}
          color={colors.textMuted}
          onPress={() => onChange(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: TOUCH_SIZE + 4,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
});
