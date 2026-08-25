import {
  STATISTICS_GRAPH_KINDS,
  type StatisticsGraphKind,
} from '@/features/statistics/statistics-model';

export type StatisticsGraphDefinition = {
  description: string;
  kind: StatisticsGraphKind;
  title: string;
};

export const STATISTICS_GRAPHS: readonly StatisticsGraphDefinition[] = [
  {
    description: 'Daily wear hours compared with your prescribed goal.',
    kind: 'wear-time',
    title: 'Wear Time',
  },
  {
    description: 'How far each day is above or below your prescribed goal.',
    kind: 'goal-progress',
    title: 'Goal Progress',
  },
  {
    description: 'Time spent in each distinct tray period.',
    kind: 'tray-progress',
    title: 'Tray Progress',
  },
];

export function parseStatisticsGraphKind(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return STATISTICS_GRAPH_KINDS.find((kind) => kind === candidate) ?? null;
}

export function getStatisticsGraphDefinition(kind: StatisticsGraphKind) {
  const definition = STATISTICS_GRAPHS.find((graph) => graph.kind === kind);

  if (!definition) {
    throw new Error(`Unknown statistics graph: ${kind}`);
  }

  return definition;
}
