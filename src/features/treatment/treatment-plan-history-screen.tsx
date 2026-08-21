import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import {
  createTreatmentPlanHistoryReadModel,
  formatPrescribedMinutes,
  type TreatmentPlanHistoryItem,
} from '@/features/treatment/treatment-plan-history-model';
import { getTreatmentPlanHistory } from '@/features/treatment/treatment-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const effectiveDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  hour12: true,
  timeStyle: 'short',
});

function PlanValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <AppText muted style={styles.valueLabel}>{label}</AppText>
      <AppText style={styles.value}>{value}</AppText>
    </View>
  );
}

function PlanVersionCard({ version }: { version: TreatmentPlanHistoryItem }) {
  const theme = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeading}>
        <AppText style={styles.effectiveDate}>
          Effective {effectiveDateFormatter.format(version.effectiveAt)}
        </AppText>
        {version.isCurrent ? (
          <View
            accessibilityLabel="Current treatment plan version"
            style={[styles.currentBadge, { backgroundColor: theme.primary }]}>
            <AppText style={[styles.currentBadgeText, { color: theme.onPrimary }]} variant="caption">
              Current
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.values}>
        <PlanValue label="Total trays" value={String(version.totalTrays)} />
        <PlanValue label="Days per tray" value={String(version.daysPerTray)} />
        <PlanValue
          label="Prescribed hours per day"
          value={formatPrescribedMinutes(version.dailyWearGoalMinutes)}
        />
      </View>
    </View>
  );
}

export function TreatmentPlanHistoryScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [history, setHistory] = useState<TreatmentPlanHistoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const versions = await getTreatmentPlanHistory(db);
    return createTreatmentPlanHistoryReadModel(versions);
  }, [db]);

  const refreshHistory = useCallback(async () => {
    setIsLoading(true);

    try {
      setHistory(await loadHistory());
      setError(null);
    } catch {
      setError('Treatment plan history could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadHistory()
        .then((readModel) => {
          if (active) {
            setHistory(readModel);
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('Treatment plan history could not be loaded. Please try again.');
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [loadHistory]),
  );

  if (history === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading plan history…" />;
    }

    return (
      <AppScreen scrollable>
        <View style={styles.message}>
          <AppText variant="heading">Plan history unavailable</AppText>
          <AppText muted>{error ?? 'No treatment plan history was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshHistory()}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: pressed ? theme.border : theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <AppText>Try again</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable>
      <AppText muted>Review the saved settings for this treatment.</AppText>

      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <AppText variant="heading">No plan history</AppText>
          <AppText muted>No treatment plan versions were found.</AppText>
        </View>
      ) : (
        <View style={styles.history}>
          {history.map((version) => (
            <PlanVersionCard key={version.id} version={version} />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.md,
  },
  cardHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  currentBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  currentBadgeText: {
    fontWeight: '700',
  },
  effectiveDate: {
    flex: 1,
    fontWeight: '700',
  },
  emptyState: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  history: {
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  value: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    textAlign: 'right',
  },
  valueLabel: {
    flex: 1,
  },
  valueRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  values: {
    gap: spacing.xs,
  },
});
