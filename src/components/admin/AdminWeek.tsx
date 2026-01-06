import { useState, useEffect } from 'react';
import { getCurrentWeekOverride, saveCurrentWeekOverride } from '../../services/firebase';
import { getCurrentPlayoffWeek, getPlayoffWeekName } from '../../services/espnApi';

const WEEKS = [
  { value: 1, label: 'Wild Card' },
  { value: 2, label: 'Divisional' },
  { value: 3, label: 'Conference Championships' },
  { value: 4, label: 'Super Bowl' },
];

export function AdminWeek() {
  const [override, setOverride] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dateBasedWeek = getCurrentPlayoffWeek();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const currentOverride = await getCurrentWeekOverride();
        setOverride(currentOverride);
      } catch (error) {
        console.error('Error loading week override:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (week: number | null) => {
    setSaving(true);
    setMessage(null);
    try {
      const success = await saveCurrentWeekOverride(week);
      if (success) {
        setOverride(week);
        setMessage({
          type: 'success',
          text: week === null
            ? 'Set to auto (date-based)'
            : `Set to ${getPlayoffWeekName(week)}`,
        });
      } else {
        setMessage({ type: 'error', text: 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving' });
    } finally {
      setSaving(false);
    }
  };

  const activeWeek = override ?? dateBasedWeek;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Current Playoff Week</h2>
        {message && (
          <span className={`text-sm font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSave(null)}
          disabled={saving}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            override === null
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } disabled:opacity-50`}
        >
          Auto ({getPlayoffWeekName(dateBasedWeek)})
        </button>
        {WEEKS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleSave(value)}
            disabled={saving}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              override === value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 text-sm text-gray-500">
        Currently showing: <span className="font-medium text-gray-700">{getPlayoffWeekName(activeWeek)}</span>
        {override !== null && (
          <span className="ml-2 text-amber-600">(manual override)</span>
        )}
      </p>
    </div>
  );
}
