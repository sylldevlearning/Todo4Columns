import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n";
import { colors, fonts, TOUCH_SIZE } from "../theme";

interface Props {
  label: string;
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};

const toHHMM = (d: Date) =>
  `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

// Sélecteur d'heure : dialogue natif sur Android, sélecteur compact sur iOS
export default function TimeField({ label, value, onChange }: Props) {
  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: toDate(value),
      mode: "time",
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type === "set" && date) onChange(toHHMM(date));
      },
    });

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === "ios" ? (
        <DateTimePicker
          value={toDate(value)}
          mode="time"
          display="compact"
          themeVariant="dark"
          locale={t.locale}
          accessibilityLabel={label}
          onChange={(_, date) => date && onChange(toHHMM(date))}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${value}`}
          onPress={openAndroid}
          style={styles.value}
        >
          <Text style={styles.valueText}>{value}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  value: {
    minHeight: TOUCH_SIZE,
    minWidth: 80,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.text,
  },
});
