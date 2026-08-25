import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { createStatisticsGraphReadModel } from '@/features/statistics/statistics-calculations';
import type {
  StatisticsGraphRange,
  StatisticsSnapshot,
} from '@/features/statistics/statistics-model';
import { getStatisticsSnapshot } from '@/features/statistics/statistics-repository';

type LoadedStatisticsGraphSource = {
  readAt: number;
  snapshot: StatisticsSnapshot;
};

export function useStatisticsGraph(range: StatisticsGraphRange) {
  const db = useSQLiteContext();
  const [source, setSource] = useState<LoadedStatisticsGraphSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSource = useCallback(async () => {
    const readAt = Date.now();
    const snapshot = await getStatisticsSnapshot(db);

    if (snapshot === null) {
      throw new Error('No active treatment history exists.');
    }

    return { readAt, snapshot };
  }, [db]);

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      setSource(await loadSource());
      setError(null);
    } catch {
      setError('Graph data could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadSource]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadSource()
        .then((nextSource) => {
          if (active) {
            setSource(nextSource);
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('Graph data could not be loaded. Please try again.');
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
    }, [loadSource]),
  );

  const graph = useMemo(
    () =>
      source === null
        ? null
        : createStatisticsGraphReadModel(source.snapshot, range, source.readAt),
    [range, source],
  );

  return { error, graph, isLoading, refresh };
}
