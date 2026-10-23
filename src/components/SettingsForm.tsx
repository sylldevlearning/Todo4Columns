import React, { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { CATEGORY_BY_KEY } from "../constants/categories";
import { formatDue } from "../format";
import { t } from "../i18n";
import { PermissionState } from "../notifications/setup";
import {
  DELEGATE_FOLLOW_UP_OPTIONS,
  DO_NAG_OPTIONS,
  PLAN_REMINDER_OPTIONS,
  ReminderOption,
} from "../reminders";
import { Settings } from "../settings";
import { colors, fonts, TOUCH_SIZE } from "../theme";
import { Task } from "../types";
import InfoButton, { InfoKey } from "./InfoButton";
import OptionPills from "./OptionPills";
import TimeField from "./TimeField";

// Dans les réglages, la relance par défaut de « Faire » ne peut pas être « Jamais »
const DEFAULT_NAG_OPTIONS = DO_NAG_OPTIONS.filter((o) => o.value !== null);
const MAX_NAGS_OPTIONS: ReminderOption[] = [2, 3, 5].map((n) => ({ label: String(n), value: n }));

const PERMISSION_LABELS: Record<PermissionState, string> = t.settings.permission;

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  permission: PermissionState | null;
  onRequestPermission: () => void;
  onOpenSystemSettings: () => void;
  archivedTasks: Task[];
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onShowOnboarding?: () => void; // « Revoir la présentation »
}

function Section({ title, info, children }: { title: string; info?: InfoKey; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {info && <InfoButton info={info} />}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Field({
  label,
  color,
  info,
  children,
}: {
  label: string;
  color?: string;
  info?: InfoKey;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.fieldLabel, color ? { color } : null]}>{label}</Text>
        {info && <InfoButton info={info} />}
      </View>
      {children}
    </View>
  );
}

function TextButton({ label, onPress, color = colors.text }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
      <Text style={[styles.textButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Contenu de l'écran Réglages
export default function SettingsForm({
  settings,
  onChange,
  permission,
  onRequestPermission,
  onOpenSystemSettings,
  archivedTasks,
  onRestore,
  onDeleteForever,
  onShowOnboarding,
}: Props) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });
  const doIt = CATEGORY_BY_KEY.UI;
  const plan = CATEGORY_BY_KEY.INU;
  const delegate = CATEGORY_BY_KEY.UDI;
  const pills = (c: typeof doIt) => ({ color: c.color, onColor: c.onColor });

  return (
    <View style={styles.container}>
      <Section title={t.settings.defaults}>
        <Field label={t.settings.doField} color={doIt.textColor} info="nag">
          <OptionPills
            options={DEFAULT_NAG_OPTIONS}
            value={settings.doNagInterval}
            onChange={(v) => v !== null && set("doNagInterval", v)}
            {...pills(doIt)}
          />
        </Field>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t.settings.repeatUntilDone}</Text>
          <InfoButton info="repeat" />
          <Switch
            accessibilityLabel={t.settings.repeatUntilDone}
            value={settings.nagRepeat}
            onValueChange={(v) => set("nagRepeat", v)}
            trackColor={{ false: colors.border, true: doIt.color }}
            thumbColor={colors.white}
          />
        </View>
        <Field label={t.settings.maxNags}>
          <OptionPills
            options={MAX_NAGS_OPTIONS}
            value={settings.maxNags}
            onChange={(v) => v !== null && set("maxNags", v)}
            {...pills(doIt)}
          />
        </Field>
        <Field label={t.settings.planField} color={plan.textColor} info="reminder">
          <OptionPills
            options={PLAN_REMINDER_OPTIONS}
            value={settings.planReminderOffset}
            onChange={(v) => v !== null && set("planReminderOffset", v)}
            {...pills(plan)}
          />
        </Field>
        <Field label={t.settings.delegateField} color={delegate.textColor} info="followUp">
          <OptionPills
            options={DELEGATE_FOLLOW_UP_OPTIONS}
            value={settings.delegateFollowUp}
            onChange={(v) => v !== null && set("delegateFollowUp", v)}
            {...pills(delegate)}
          />
        </Field>
      </Section>

      <Section title={t.settings.quietHours} info="quietHours">
        <Text style={styles.hint}>{t.settings.quietHoursHint}</Text>
        <TimeField
          label={t.settings.start}
          value={settings.quietHoursStart}
          onChange={(v) => set("quietHoursStart", v)}
        />
        <View style={styles.separator} />
        <TimeField
          label={t.settings.end}
          value={settings.quietHoursEnd}
          onChange={(v) => set("quietHoursEnd", v)}
        />
      </Section>

      <Section title={t.settings.notifications}>
        <Text style={styles.status}>
          {permission === null ? "…" : PERMISSION_LABELS[permission]}
        </Text>
        {permission === "undetermined" && (
          <TextButton label={t.settings.allowNotifications} onPress={onRequestPermission} />
        )}
        <TextButton label={t.common.openPhoneSettings} onPress={onOpenSystemSettings} />
      </Section>

      <Section title={t.settings.animations}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>{t.settings.celebrations}</Text>
            <Text style={styles.hint}>{t.settings.celebrationsHint}</Text>
          </View>
          <InfoButton info="celebrations" />
          <Switch
            accessibilityLabel={t.settings.celebrations}
            value={settings.celebrations}
            onValueChange={(v) => set("celebrations", v)}
            trackColor={{ false: colors.border, true: doIt.color }}
            thumbColor={colors.white}
          />
        </View>
      </Section>

      <Section title={t.settings.archives(archivedTasks.length)}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t.settings.autoArchive}</Text>
          <InfoButton info="autoArchive" />
          <Switch
            accessibilityLabel={t.settings.autoArchive}
            value={settings.autoArchive}
            onValueChange={(v) => set("autoArchive", v)}
            trackColor={{ false: colors.border, true: CATEGORY_BY_KEY.NDNI.color }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.separator} />
        {archivedTasks.length === 0 ? (
          <Text style={styles.hint}>{t.settings.archivesHint}</Text>
        ) : (
          archivedTasks.map((task, i) => (
            <View key={task.id} style={[styles.archived, i > 0 && styles.archivedBorder]}>
              <Text style={styles.archivedTitle}>{task.title}</Text>
              <Text style={styles.archivedDate}>{t.settings.archivedOn(formatDue(task.archivedAt!))}</Text>
              <View style={styles.archivedActions}>
                <TextButton label={t.settings.restore} onPress={() => onRestore(task.id)} />
                <TextButton
                  label={t.settings.deleteForever}
                  color={colors.danger}
                  onPress={() => onDeleteForever(task.id)}
                />
              </View>
            </View>
          ))
        )}
      </Section>

      {onShowOnboarding && (
        <Section title={t.settings.help}>
          <TextButton label={t.onboarding.replay} onPress={onShowOnboarding} />
        </Section>
      )}

      {Platform.OS === "android" && (
        <Text style={styles.footnote}>{t.settings.androidDelay}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: TOUCH_SIZE,
    gap: 12,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  status: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  textButton: {
    minHeight: TOUCH_SIZE,
    justifyContent: "center",
  },
  textButtonLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  archived: {
    gap: 2,
  },
  archivedBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  archivedTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  archivedDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  archivedActions: {
    flexDirection: "row",
    gap: 20,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
});
