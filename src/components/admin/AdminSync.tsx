import { useState } from 'react';
import { syncPlayersToFirestore } from '../../services/firebase';
import { fetchESPNPlayersForTeams } from '../../services/espnApi';
import { PLAYOFF_TEAMS, WEEK_CSV_FILES } from '../../data/players';
import type { Player, Position, NFLTeam } from '../../types';

// Parse CSV text into Player objects
function parseCSV(csvText: string): Player[] {
  const lines = csvText.trim().split('\n');
  const players: Player[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length >= 4) {
      const name = parts[0].trim();
      const position = parts[1].trim() as Position;
      const team = parts[2].trim() as NFLTeam;
      const rank = parseInt(parts[3].trim(), 10) || undefined;

      const id = `${position.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      players.push({
        id,
        name,
        position,
        team,
        rank,
      });
    }
  }

  return players;
}

export function AdminSync() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced: number; notFound: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      // 1. Load CSV
      const csvPath = WEEK_CSV_FILES[1]; // wildcard.csv
      const response = await fetch(csvPath);
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.status}`);
      }
      const csvText = await response.text();
      const players = parseCSV(csvText);

      console.log(`Loaded ${players.length} players from CSV`);

      // 2. Fetch ESPN player data for headshots
      console.log('Fetching ESPN data for teams:', PLAYOFF_TEAMS);
      const espnPlayerMap = await fetchESPNPlayersForTeams(PLAYOFF_TEAMS);
      console.log(`Fetched ${espnPlayerMap.size} players from ESPN`);

      // 3. Sync to Firestore
      const syncResult = await syncPlayersToFirestore(players, espnPlayerMap);
      setResult(syncResult);

    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Admin: Sync Players to Firebase</h2>

      <p className="text-gray-600 mb-4">
        This will clear all existing players in Firebase and sync them from the CSV file,
        matching with ESPN headshots where possible.
      </p>

      <button
        onClick={handleSync}
        disabled={syncing}
        className={`px-4 py-2 rounded-lg font-medium ${
          syncing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {syncing ? 'Syncing...' : 'Sync Players'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-lg">
          <p className="font-medium">Sync complete!</p>
          <p>Synced {result.synced} players</p>
          {result.notFound.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">
                {result.notFound.length} players not found in ESPN (using default icons)
              </summary>
              <ul className="mt-2 text-sm text-gray-600 max-h-40 overflow-y-auto">
                {result.notFound.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
