import { useState, useEffect } from 'react';
import { subscribeToCurrentWeek } from '../services/firebase';
import { getCurrentPlayoffWeek, getPlayoffWeekName } from '../services/espnApi';

interface CurrentWeekState {
  week: number;
  weekName: string;
  isOverride: boolean;
  loading: boolean;
}

export function useCurrentWeek(): CurrentWeekState {
  const [override, setOverride] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToCurrentWeek((week) => {
      setOverride(week);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Use override if set, otherwise fall back to date-based logic
  const week = override ?? getCurrentPlayoffWeek();
  const weekName = getPlayoffWeekName(week);
  const isOverride = override !== null;

  return { week, weekName, isOverride, loading };
}
