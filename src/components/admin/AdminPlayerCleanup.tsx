import { useState } from 'react';
import { checkPlayerUsage, updatePlayer, deletePlayersByIds, getCachedPlayers, getPlayerStats } from '../../services/firebase';

interface UsageDetail {
  usedBy: string[];
  inRosters: { odId: string; week: number }[];
  hasWildcardStats: boolean;
}

export function AdminPlayerCleanup() {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<{
    buffaloKicker: UsageDetail | null;
    mattPrater: { detail: UsageDetail; id: string } | null;
  }>({ buffaloKicker: null, mattPrater: null });

  // Check current state
  async function handleCheck() {
    setChecking(true);
    setResult(null);

    try {
      // Get all players
      const allPlayers = await getCachedPlayers();

      // Find the relevant players
      const buffaloKicker = allPlayers.find(p => p.id === 'k-buffalo-kicker');
      const mattPrater = allPlayers.find(p =>
        p.name === 'Matt Prater' && p.id !== 'k-buffalo-kicker'
      );

      // Check usage for Buffalo Kicker
      const buffaloUsage = await checkPlayerUsage('k-buffalo-kicker');
      const buffaloStats = await getPlayerStats('wildcard', 'k-buffalo-kicker');

      // Check usage for duplicate Matt Prater
      let praterUsage = null;
      let praterId = '';
      let praterStats = null;
      if (mattPrater) {
        praterId = mattPrater.id;
        praterUsage = await checkPlayerUsage(mattPrater.id);
        praterStats = await getPlayerStats('wildcard', mattPrater.id);
      }

      setUsageInfo({
        buffaloKicker: buffaloKicker ? {
          usedBy: buffaloUsage.usedByUsers,
          inRosters: buffaloUsage.inRosters,
          hasWildcardStats: !!buffaloStats,
        } : null,
        mattPrater: mattPrater ? {
          detail: {
            usedBy: praterUsage?.usedByUsers || [],
            inRosters: praterUsage?.inRosters || [],
            hasWildcardStats: !!praterStats,
          },
          id: praterId,
        } : null,
      });

      // Build detailed result message
      let msg = '';
      if (buffaloKicker) {
        msg += `"Buffalo Kicker" (k-buffalo-kicker):\n`;
        msg += `  - In usedPlayers: ${buffaloUsage.usedByUsers.length} users (${buffaloUsage.usedByUsers.join(', ') || 'none'})\n`;
        msg += `  - In rosters: ${buffaloUsage.inRosters.length} (${buffaloUsage.inRosters.map(r => `${r.odId} week ${r.week}`).join(', ') || 'none'})\n`;
        msg += `  - Has wildcard stats: ${buffaloStats ? 'YES' : 'NO'}\n`;
      } else {
        msg += `"Buffalo Kicker" not found in players collection\n`;
      }

      msg += '\n';

      if (mattPrater) {
        msg += `"Matt Prater" (${praterId}):\n`;
        msg += `  - In usedPlayers: ${praterUsage?.usedByUsers.length || 0} users\n`;
        msg += `  - In rosters: ${praterUsage?.inRosters.length || 0}\n`;
        msg += `  - Has wildcard stats: ${praterStats ? 'YES' : 'NO'}`;
      } else {
        msg += `Duplicate "Matt Prater" not found in players collection`;
      }

      setResult(msg);
    } catch (err) {
      setResult(`Error: ${err}`);
    } finally {
      setChecking(false);
    }
  }

  // Perform the cleanup
  async function handleCleanup() {
    if (!usageInfo.mattPrater) {
      setResult('Error: No duplicate Matt Prater found to cleanup');
      return;
    }

    const { detail, id: praterId } = usageInfo.mattPrater;
    if (detail.usedBy.length > 0 || detail.inRosters.length > 0) {
      setResult('ERROR: Cannot delete duplicate Matt Prater - it is being used by users! Manual migration required.');
      return;
    }

    setUpdating(true);
    try {
      // Step 1: Update Buffalo Kicker to Matt Prater
      const success = await updatePlayer('k-buffalo-kicker', {
        name: 'Matt Prater',
        imageUrl: 'https://a.espncdn.com/i/headshots/nfl/players/full/11122.png',
      });

      if (!success) {
        setResult('Error updating Buffalo Kicker player record');
        return;
      }

      // Step 2: Delete duplicate Matt Prater
      const deleted = await deletePlayersByIds([praterId]);

      let msg = `Success!\n`;
      msg += `- Updated "Buffalo Kicker" to "Matt Prater" with headshot\n`;
      msg += `- Deleted duplicate player (${deleted} removed)\n\n`;
      msg += `Note: playerStats/wildcard/players/k-buffalo-kicker remains unchanged.\n`;
      msg += `The stats will still be correctly associated via the player ID.`;

      setResult(msg);

      // Reset usage info
      setUsageInfo({ buffaloKicker: null, mattPrater: null });
    } catch (err) {
      setResult(`Error during cleanup: ${err}`);
    } finally {
      setUpdating(false);
    }
  }

  const canCleanup = usageInfo.mattPrater &&
    usageInfo.mattPrater.detail.usedBy.length === 0 &&
    usageInfo.mattPrater.detail.inRosters.length === 0;

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Player Cleanup: Buffalo Kicker → Matt Prater</h2>

      <p className="text-gray-600 mb-4 text-sm">
        This will rename "Buffalo Kicker" (k-buffalo-kicker) to "Matt Prater" and delete the duplicate Matt Prater entry.
        The playerStats document ID stays the same, so wildcard stats will still be correctly associated.
      </p>

      <div className="flex gap-3 mb-4">
        <button
          onClick={handleCheck}
          disabled={checking}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
        >
          {checking ? 'Checking...' : '1. Check Current State'}
        </button>

        <button
          onClick={handleCleanup}
          disabled={updating || !canCleanup}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
        >
          {updating ? 'Updating...' : '2. Perform Cleanup'}
        </button>
      </div>

      {usageInfo.buffaloKicker !== null && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-sm space-y-2">
          <div>
            <p><strong>Buffalo Kicker (k-buffalo-kicker):</strong></p>
            <p>In usedPlayers: {usageInfo.buffaloKicker.usedBy.length} users</p>
            <p>In rosters: {usageInfo.buffaloKicker.inRosters.length}</p>
            <p>Has wildcard stats: {usageInfo.buffaloKicker.hasWildcardStats ? 'Yes' : 'No'}</p>
          </div>

          {usageInfo.mattPrater && (
            <div className="pt-2 border-t border-gray-300">
              <p><strong>Duplicate Matt Prater ({usageInfo.mattPrater.id}):</strong></p>
              <p>In usedPlayers: {usageInfo.mattPrater.detail.usedBy.length} users</p>
              <p>In rosters: {usageInfo.mattPrater.detail.inRosters.length}</p>
              <p>Has wildcard stats: {usageInfo.mattPrater.detail.hasWildcardStats ? 'Yes' : 'No'}</p>

              {canCleanup ? (
                <p className="mt-2 text-green-700 font-medium">Safe to delete duplicate!</p>
              ) : (
                <p className="mt-2 text-red-700 font-medium">WARNING: Duplicate is in use - cannot auto-delete!</p>
              )}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-lg whitespace-pre-wrap text-sm font-mono ${
          result.includes('Error') || result.includes('ERROR')
            ? 'bg-red-100 text-red-700'
            : result.includes('Success')
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
        }`}>
          {result}
        </div>
      )}
    </div>
  );
}
