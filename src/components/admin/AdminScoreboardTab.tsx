import { useState, useEffect } from 'react';
import { getDefaultScoreboardTab, setDefaultScoreboardTab, type ScoreboardTab } from '../../services/firebase';

const TABS: { value: ScoreboardTab; label: string }[] = [
  { value: 'overall', label: 'Overall' },
  { value: 'wildcard', label: 'Wild Card' },
  { value: 'divisional', label: 'Divisional' },
  { value: 'championship', label: 'Championship' },
  { value: 'superbowl', label: 'Super Bowl' },
];

export function AdminScoreboardTab() {
  const [currentTab, setCurrentTab] = useState<ScoreboardTab>('overall');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDefaultScoreboardTab().then(setCurrentTab);
  }, []);

  async function handleChange(tab: ScoreboardTab) {
    setSaving(true);
    const success = await setDefaultScoreboardTab(tab);
    if (success) {
      setCurrentTab(tab);
    }
    setSaving(false);
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Scoreboard Default Tab</h2>
      <p className="text-gray-600 mb-4 text-sm">
        Select which tab users see by default when opening the Scoreboard.
      </p>

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            disabled={saving}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              currentTab === value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } ${saving ? 'opacity-50' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
