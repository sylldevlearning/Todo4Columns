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
// Jours de la revue, du lundi au dimanche (0 = dimanche)
const REVIEW_DAY_OPTIONS: ReminderOption[] = [1, 2, 3, 4, 5, 6, 0].map((day) => ({
  label: t.settings.weekdays[day],
  value: day,
}));

const PERMISSION_LABELS: Record<PermissionState, string> = t.settings.permission;

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  permission: PermissionState | null;
  canAskPermission?: boolean; // faux : fenêtre système plus disponible, seuls les réglages du téléphone
  onRequestPermission: () => void;
  onOpenSystemSettings: () => void;
  archivedTasks: Task[];
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onShowOnboarding?: () => void; // « Revoir la présentation »
  onOpenHowTo?: () => void; // page « Comment ça marche »
  onOpenReview?: () => void; // revue de la semaine
  onExport?: () => void; // « Exporter mes données »
  onImport?: () => void; // « Importer une sauvegarde »
  onUndoImport?: () => void; // « Annuler le dernier import » (seulement après un import)
  onQuietHoursLayout?: (y: number) => void; // position de la section, pour y faire défiler
  about?: {
    version: string; // version de l'app
    onRate: () => void; // « Noter DoFirst »
    onShare: () => void; // « Partager DoFirst »
    onFeedback: () => void; // « Suggérer une idée / signaler un problème »
  };
}

function Section({
  title,
  info,
  onLayout,
  children,
}: {
  title: string;
  info?: InfoKey;
  onLayout?: (y: number) => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} onLayout={onLayout && ((e) => onLayout(e.nativeEvent.layout.y))}>
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
  canAskPermission = true,
  onRequestPermission,
  onOpenSystemSettings,
  archivedTasks,
  onRestore,
  onDeleteForever,
  onShowOnboarding,
  onOpenHowTo,
  onOpenReview,
  onExport,
  onImport,
  onUndoImport,
  onQuietHoursLayout,
  about,
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
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t.settings.autoEscalate}</Text>
          <InfoButton info="autoEscalate" />
          <Switch
            accessibilityLabel={t.settings.autoEscalate}
            value={settings.autoEscalate}
            onValueChange={(v) => set("autoEscalate", v)}
            trackColor={{ false: colors.border, true: doIt.color }}
            thumbColor={colors.white}
          />
        </View>
        <Field label={t.settings.delegateField} color={delegate.textColor} info="followUp">
          <OptionPills
            options={DELEGATE_FOLLOW_UP_OPTIONS}
            value={settings.delegateFollowUp}
            onChange={(v) => v !== null && set("delegateFollowUp", v)}
            {...pills(delegate)}
          />
        </Field>
      </Section>

      <Section title={t.settings.quietHours} info="quietHours" onLayout={onQuietHoursLayout}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t.settings.quietHoursToggle}</Text>
          <Switch
            accessibilityLabel={t.settings.quietHoursToggle}
            value={settings.quietHoursEnabled}
            onValueChange={(v) => set("quietHoursEnabled", v)}
            trackColor={{ false: colors.border, true: doIt.color }}
            thumbColor={colors.white}
          />
        </View>
        {/* Horaires seulement quand la plage est activée */}
        {settings.quietHoursEnabled && (
          <>
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
          </>
        )}
      </Section>

      {onOpenReview && (
        <Section title={t.settings.review} info="review">
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t.settings.weeklyReminder}</Text>
            <InfoButton info="reviewReminder" />
            <Switch
              accessibilityLabel={t.settings.weeklyReminder}
              value={settings.weeklyReview}
              onValueChange={(v) => {
                set("weeklyReview", v);
                // Revue activée : elle a besoin des notifications
                if (v) onRequestPermission();
              }}
              trackColor={{ false: colors.border, true: plan.color }}
              thumbColor={colors.white}
            />
          </View>
          {settings.weeklyReview && (
            <>
              <Field label={t.settings.reviewDay}>
                <OptionPills
                  options={REVIEW_DAY_OPTIONS}
                  value={settings.weeklyReviewDay}
                  onChange={(v) => v !== null && set("weeklyReviewDay", v)}
                  {...pills(plan)}
                />
              </Field>
              <TimeField
                label={t.settings.reviewTime}
                value={settings.weeklyReviewTime}
                onChange={(v) => set("weeklyReviewTime", v)}
              />
            </>
          )}
          <View style={styles.separator} />
          <TextButton label={t.review.openNow} onPress={onOpenReview} />
        </Section>
      )}

      <Section title={t.settings.notifications}>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {permission === null
            ? "…"
            : permission === "granted"
            ? t.settings.notificationsOn
            : t.settings.notificationsOff}
        </Text>
        {permission !== null && permission !== "granted" && (
          <Text style={styles.hint}>{PERMISSION_LABELS[permission]}</Text>
        )}
        {/* Fenêtre système si elle peut s'afficher, sinon les réglages du téléphone */}
        {permission !== null && permission !== "granted" && canAskPermission && (
          <TextButton label={t.settings.allowNotifications} onPress={onRequestPermission} />
        )}
        {permission === "denied" && !canAskPermission && (
          <TextButton label={t.permissionCard.openSettings} onPress={onOpenSystemSettings} />
        )}
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

      {onExport && onImport && (
        <Section title={t.backup.section} info="backup">
          <TextButton label={t.backup.export} onPress={onExport} />
          <TextButton label={t.backup.import} onPress={onImport} />
          {onUndoImport && <TextButton label={t.backup.undoImport} onPress={onUndoImport} />}
        </Section>
      )}

      {(onOpenHowTo || onShowOnboarding) && (
        <Section title={t.settings.help}>
          {onOpenHowTo && <TextButton label={t.howTo.title} onPress={onOpenHowTo} />}
          {onShowOnboarding && (
            <TextButton label={t.onboarding.replay} onPress={onShowOnboarding} />
          )}
        </Section>
      )}

      {about && (
        <Section title={t.about.section}>
          <TextButton label={t.about.rate} onPress={about.onRate} />
          <TextButton label={t.about.share} onPress={about.onShare} />
          <TextButton label={t.about.feedback} onPress={about.onFeedback} />
          <Text style={styles.hint}>{t.about.version(about.version)}</Text>
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
