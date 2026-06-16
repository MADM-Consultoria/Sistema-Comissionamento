// src/contexts/period/PeriodProvider.tsx
import { ReactNode, useState, useMemo } from 'react';
import { Period, PeriodContext } from './PeriodContext';

function getDateRangeForPeriod(period: Period, customStart?: string, customEnd?: string): { start: string; end: string } {
  if (period === 'Custom' && customStart && customEnd) {
    const endDate = new Date(customEnd);
    endDate.setDate(endDate.getDate() + 1);
    return { start: customStart, end: endDate.toISOString().slice(0, 10) };
  }

  const now = new Date();
  let start: Date, end: Date;

  if (period === 'Hoje') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (period === 'Semana') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    start = monday;
    end = new Date(friday);
    end.setDate(friday.getDate() + 1);
  } else { // Mês
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<Period>('Mês');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  });

  const setPeriod = (newPeriod: Period) => {
    console.log('🔁 PeriodProvider.setPeriod:', newPeriod);
    if (newPeriod === 'Custom') {
      setPeriodState('Custom');
    } else {
      const { start, end } = getDateRangeForPeriod(newPeriod);
      console.log('📅 Datas calculadas:', { start, end });
      setCustomStartDate(start);
      setCustomEndDate(end);
      setPeriodState(newPeriod);
    }
  };

  const setCustomDateRange = (start: string, end: string) => {
    console.log('📅 setCustomDateRange:', { start, end });
    const endNext = new Date(end);
    endNext.setDate(endNext.getDate() + 1);
    setCustomStartDate(start);
    setCustomEndDate(endNext.toISOString().slice(0, 10));
    setPeriodState('Custom');
  };

  const { start: currentStartDate, end: currentEndDate } = useMemo(
    () => getDateRangeForPeriod(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate]
  );

  console.log('📅 Período atual:', { period, currentStartDate, currentEndDate });

  return (
    <PeriodContext.Provider
      value={{
        period,
        setPeriod,
        customStartDate,
        customEndDate,
        setCustomDateRange,
        currentStartDate,
        currentEndDate,
      }}
    >
      {children}
    </PeriodContext.Provider>
  );
}