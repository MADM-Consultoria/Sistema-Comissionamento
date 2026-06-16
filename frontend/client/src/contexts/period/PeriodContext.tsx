import { createContext, useContext } from 'react';

export type Period = 'Hoje' | 'Semana' | 'Mês' | 'Custom';

export interface PeriodContextType {
  period: Period;
  setPeriod: (period: Period) => void;
  customStartDate: string;
  customEndDate: string;
  setCustomDateRange: (start: string, end: string) => void;
  currentStartDate: string;
  currentEndDate: string;
}

export const PeriodContext = createContext<PeriodContextType | undefined>(undefined);

export function usePeriod(): PeriodContextType {
  const context = useContext(PeriodContext);
  if (!context) throw new Error('usePeriod must be used within a PeriodProvider');
  return context;
}