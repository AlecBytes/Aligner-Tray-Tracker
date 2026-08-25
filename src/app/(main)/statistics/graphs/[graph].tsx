import { Stack, useLocalSearchParams } from 'expo-router';

import { getStatisticsGraphDefinition, parseStatisticsGraphKind } from '@/features/statistics/statistics-graph-config';
import { StatisticsGraphDetailScreen } from '@/features/statistics/statistics-graph-detail-screen';

export default function StatisticsGraphRoute() {
  const { graph: graphParameter } = useLocalSearchParams<{ graph: string | string[] }>();
  const graph = parseStatisticsGraphKind(graphParameter);
  const title = graph ? getStatisticsGraphDefinition(graph).title : 'Graph';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <StatisticsGraphDetailScreen graph={graph} />
    </>
  );
}
