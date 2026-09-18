import { createContext, useContext } from 'react';
import * as aligner from './edit-times-repository';
import type { retainerCorrections } from '@/features/retainer/retainer-corrections';
export const TimelineContext = createContext<ReturnType<typeof retainerCorrections> | null>(null);
export function useTimelineRepository() { return useContext(TimelineContext) ?? aligner; }

export const TimelineScopeContext = createContext<{ timeline: string; periodId?: number }>({ timeline: "treatment" });
export function useTimelineScope() { return useContext(TimelineScopeContext); }
