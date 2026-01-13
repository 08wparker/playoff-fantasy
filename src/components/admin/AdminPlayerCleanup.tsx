import { useState } from 'react';
import { checkPlayerUsage, updatePlayer, deletePlayersByIds, getCachedPlayers } from '../../services/firebase';

export function AdminPlayerCleanup() {
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [usageInfo, setUsageInfo] = useState<{
    buffaloKicker: { usedBy: number; inRosters: number } | null;
    mattPrater: { usedBy: number; inRosters: number; id: string } | null;
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

      // Check usage for duplicate Matt Prater
      let praterUsage = null;
      let praterId = '';
      if (mattPrater) {
        praterId = mattPrater.id;
        praterUsage = await checkPlayerUsage(mattPrater.id);
      }

      setUsageInfo({
        buffaloKicker: buffaloKicker ? {
          usedBy: buffaloUsage.usedByUsers.length,
          inRosters: buffaloUsage.inRosters.length,
        } : null,
        mattPrater: mattPrater ? {
          usedBy: praterUsage?.usedByUsers.length || 0,
          inRosters: praterUsage?.inRosters.length || 0,
          id: praterId,
        } : null,
      });

      let msg = '';
      if (buffaloKicker) {
        msg += `"Buffalo Kicker" (k-buffalo-kicker): Used by ${buffaloUsage.usedByUsers.length} users, in ${buffaloUsage.inRosters.length} rosters\n`;
      } else {
        msg += `"Buffalo Kicker" not found in players collection\n`;
      }

      if (mattPrater) {
        msg += `"Matt Prater" (${praterId}): Used by ${praterUsage?.usedByUsers.length || 0} users, in ${praterUsage?.inRosters.length || 0} rosters`;
      } else {
        msg += `Duplicate "Matt Prater" not found`;
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

    if (usageInfo.mattPrater.usedBy > 0 || usageInfo.mattPrater.inRosters > 0) {
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
        setResult('Error updating Buffalo Kicker');
        return;
      }

      // Step 2: Delete duplicate Matt Prater
      const deleted = await deletePlayersByIds([usageInfo.mattPrater.id]);

      setResult(`Success! Updated "Buffalo Kicker" to "Matt Prater" and deleted duplicate (${deleted} player removed)`);

      // Reset usage info
      setUsageInfo({ buffaloKicker: null, mattPrater: null });
    } catch (err) {
      setResult(`Error during cleanup: ${err}`);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Player Cleanup: Buffalo Kicker → Matt Prater</h2>

      <p className="text-gray-600 mb-4 text-sm">
        This will rename "Buffalo Kicker" (k-buffalo-kicker) to "Matt Prater" and delete the duplicate Matt Prater entry.
        All users who used "Buffalo Kicker" will now see "Matt Prater" in their roster history.
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
          disabled={updating || !usageInfo.mattPrater || usageInfo.mattPrater.usedBy > 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
        >
          {updating ? 'Updating...' : '2. Perform Cleanup'}
        </button>
      </div>

      {usageInfo.buffaloKicker !== null && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
          <p><strong>Buffalo Kicker (k-buffalo-kicker):</strong></p>
          <p>Used by {usageInfo.buffaloKicker.usedBy} users, in {usageInfo.buffaloKicker.inRosters} rosters</p>

          {usageInfo.mattPrater && (
            <>
              <p className="mt-2"><strong>Duplicate Matt Prater ({usageInfo.mattPrater.id}):</strong></p>
              <p>Used by {usageInfo.mattPrater.usedBy} users, in {usageInfo.mattPrater.inRosters} rosters</p>

              {usageInfo.mattPrater.usedBy === 0 && usageInfo.mattPrater.inRosters === 0 ? (
                <p className="mt-2 text-green-700 font-medium">Safe to delete duplicate!</p>
              ) : (
                <p className="mt-2 text-red-700 font-medium">WARNING: Duplicate is in use - cannot auto-delete!</p>
              )}
            </>
          )}
        </div>
      )}

      {result && (
        <div className={`p-4 rounded-lg whitespace-pre-wrap text-sm ${
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
