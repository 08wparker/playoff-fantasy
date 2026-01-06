import { useState, useEffect } from 'react';
import type { ScoringRules } from '../../services/scoring';
import { PPR_SCORING } from '../../services/scoring';
import { getScoringRules, saveScoringRules } from '../../services/firebase';

export function AdminScoringRules() {
  const [rules, setRules] = useState<ScoringRules>(PPR_SCORING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load current rules from Firebase
  useEffect(() => {
    async function loadRules() {
      setLoading(true);
      try {
        const currentRules = await getScoringRules();
        setRules(currentRules);
      } catch (error) {
        console.error('Error loading scoring rules:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  // Handle input change
  const handleChange = (field: keyof ScoringRules, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRules(prev => ({ ...prev, [field]: numValue }));
  };

  // Save rules to Firebase
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const success = await saveScoringRules(rules);
      if (success) {
        setMessage({ type: 'success', text: 'Scoring rules saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save scoring rules' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving scoring rules' });
    } finally {
      setSaving(false);
    }
  };

  // Reset to default PPR
  const handleReset = () => {
    setRules(PPR_SCORING);
    setMessage({ type: 'success', text: 'Reset to default PPR scoring' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Scoring Rules</h2>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Passing */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Passing</h3>
          <RuleInput
            label="Yards per Point"
            value={rules.passingYardsPerPoint}
            onChange={(v) => handleChange('passingYardsPerPoint', v)}
            hint="e.g., 25 = 1 pt per 25 yds"
          />
          <RuleInput
            label="Passing TD"
            value={rules.passingTD}
            onChange={(v) => handleChange('passingTD', v)}
          />
          <RuleInput
            label="Interception"
            value={rules.interception}
            onChange={(v) => handleChange('interception', v)}
          />
        </div>

        {/* Rushing */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Rushing</h3>
          <RuleInput
            label="Yards per Point"
            value={rules.rushingYardsPerPoint}
            onChange={(v) => handleChange('rushingYardsPerPoint', v)}
            hint="e.g., 10 = 1 pt per 10 yds"
          />
          <RuleInput
            label="Rushing TD"
            value={rules.rushingTD}
            onChange={(v) => handleChange('rushingTD', v)}
          />
        </div>

        {/* Receiving */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Receiving</h3>
          <RuleInput
            label="Yards per Point"
            value={rules.receivingYardsPerPoint}
            onChange={(v) => handleChange('receivingYardsPerPoint', v)}
            hint="e.g., 10 = 1 pt per 10 yds"
          />
          <RuleInput
            label="Receiving TD"
            value={rules.receivingTD}
            onChange={(v) => handleChange('receivingTD', v)}
          />
          <RuleInput
            label="Reception (PPR)"
            value={rules.reception}
            onChange={(v) => handleChange('reception', v)}
          />
        </div>

        {/* Kicking - Field Goals */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Field Goals</h3>
          <RuleInput
            label="FG 0-39 yards"
            value={rules.fg0_39}
            onChange={(v) => handleChange('fg0_39', v)}
          />
          <RuleInput
            label="FG 40-49 yards"
            value={rules.fg40_49}
            onChange={(v) => handleChange('fg40_49', v)}
          />
          <RuleInput
            label="FG 50+ yards"
            value={rules.fg50Plus}
            onChange={(v) => handleChange('fg50Plus', v)}
          />
          <RuleInput
            label="FG Missed"
            value={rules.fgMissed}
            onChange={(v) => handleChange('fgMissed', v)}
          />
        </div>

        {/* Kicking - Extra Points */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Extra Points</h3>
          <RuleInput
            label="XP Made"
            value={rules.extraPoint}
            onChange={(v) => handleChange('extraPoint', v)}
          />
          <RuleInput
            label="XP Missed"
            value={rules.xpMissed}
            onChange={(v) => handleChange('xpMissed', v)}
          />
        </div>

        {/* Defense - Points Allowed */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Defense - Points Allowed</h3>
          <RuleInput
            label="Shutout (0 pts)"
            value={rules.shutout}
            onChange={(v) => handleChange('shutout', v)}
          />
          <RuleInput
            label="1-6 Points"
            value={rules.under7}
            onChange={(v) => handleChange('under7', v)}
          />
          <RuleInput
            label="7-13 Points"
            value={rules.under14}
            onChange={(v) => handleChange('under14', v)}
          />
          <RuleInput
            label="14-20 Points"
            value={rules.under21}
            onChange={(v) => handleChange('under21', v)}
          />
          <RuleInput
            label="21-27 Points"
            value={rules.under28}
            onChange={(v) => handleChange('under28', v)}
          />
          <RuleInput
            label="28-34 Points"
            value={rules.under35}
            onChange={(v) => handleChange('under35', v)}
          />
          <RuleInput
            label="35+ Points"
            value={rules.over35}
            onChange={(v) => handleChange('over35', v)}
          />
        </div>

        {/* Defense - Turnovers/TDs */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Defense - Plays</h3>
          <RuleInput
            label="Sack"
            value={rules.sack}
            onChange={(v) => handleChange('sack', v)}
          />
          <RuleInput
            label="Interception"
            value={rules.defensiveInterception}
            onChange={(v) => handleChange('defensiveInterception', v)}
          />
          <RuleInput
            label="Fumble Recovery"
            value={rules.fumbleRecovery}
            onChange={(v) => handleChange('fumbleRecovery', v)}
          />
          <RuleInput
            label="Defensive TD"
            value={rules.defensiveTD}
            onChange={(v) => handleChange('defensiveTD', v)}
          />
        </div>
      </div>
    </div>
  );
}

// Reusable input component
function RuleInput({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
