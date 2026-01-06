import { useState } from 'react';
import { syncPlayersToFirestore, savePlayoffConfig, savePlayerRanks } from '../../services/firebase';
import { fetchESPNPlayersForTeams } from '../../services/espnApi';
import { WEEK_CSV_FILES } from '../../data/players';
import type { Player, Position, NFLTeam, PlayoffWeekName } from '../../types';
import { PLAYOFF_WEEK_DISPLAY_NAMES } from '../../types';

const WEEKS: PlayoffWeekName[] = ['wildcard', 'divisional', 'championship', 'superbowl'];
const WEEK_NUMBERS: Record<PlayoffWeekName, number> = {
  wildcard: 1,
  divisional: 2,
  championship: 3,
  superbowl: 4,
};

// Parse CSV text into Player objects with ranks
function parseCSV(csvText: string): { players: Player[]; ranks: Map<string, number> } {
  const lines = csvText.trim().split('\n');
  const players: Player[] = [];
  const ranks = new Map<string, number>();

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
      });

      if (rank !== undefined) {
        ranks.set(id, rank);
      }
    }
  }

  return { players, ranks };
}

// Extract unique teams from players
function extractTeams(players: Player[]): NFLTeam[] {
  const teams = new Set<NFLTeam>();
  players.forEach(p => teams.add(p.team));
  return Array.from(teams).sort();
}

export function AdminSync() {
  const [selectedWeek, setSelectedWeek] = useState<PlayoffWeekName>('wildcard');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    synced: number;
    notFound: string[];
    byPosition?: Record<string, number>;
    teams?: NFLTeam[];
    ranksCount?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      // 1. Load CSV for selected week
      const weekNumber = WEEK_NUMBERS[selectedWeek];
      const csvPath = WEEK_CSV_FILES[weekNumber];

      console.log(`Loading CSV for ${selectedWeek} from ${csvPath}`);
      const response = await fetch(csvPath);
      if (!response.ok) {
        throw new Error(`Failed to load CSV for ${selectedWeek}: ${response.status}. Make sure ${csvPath} exists.`);
      }

      const csvText = await response.text();
      const { players, ranks } = parseCSV(csvText);

      // Debug: log position breakdown from CSV
      const positionCounts = players.reduce((acc, p) => {
        acc[p.position] = (acc[p.position] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`Loaded ${players.length} players from CSV, by position:`, positionCounts);

      // 2. Extract unique teams from CSV
      const teams = extractTeams(players);
      console.log(`Found ${teams.length} teams:`, teams);

      // 3. Save playoff config (teams for this week)
      await savePlayoffConfig(selectedWeek, teams);

      // 4. Fetch ESPN player data for headshots
      console.log('Fetching ESPN data for teams:', teams);
      const espnPlayerMap = await fetchESPNPlayersForTeams(teams);
      console.log(`Fetched ${espnPlayerMap.size} players from ESPN`);

      // 5. Sync players to Firestore (without ranks)
      const syncResult = await syncPlayersToFirestore(players, espnPlayerMap);

      // 6. Save player ranks for this week
      // Map CSV player IDs to Firebase doc IDs for ranks
      const firebaseRanks = new Map<string, number>();
      ranks.forEach((rank, csvPlayerId) => {
        const firebaseId = syncResult.playerIdMap.get(
          players.find(p => p.id === csvPlayerId)?.name || ''
        ) || csvPlayerId;
        firebaseRanks.set(firebaseId, rank);
      });
      await savePlayerRanks(selectedWeek, firebaseRanks);

      setResult({
        ...syncResult,
        teams,
        ranksCount: firebaseRanks.size,
      });

    } catch (err) {
      console.error('Sync error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Sync Players & Config to Firebase</h2>

      <p className="text-gray-600 mb-4">
        Select a playoff week and sync players from its CSV file. This will:
      </p>
      <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
        <li>Save the teams playing that week to <code>playoffConfig/{'{week}'}</code></li>
        <li>Save player ranks for that week to <code>playerRanks/{'{week}'}</code></li>
        <li>Sync all players to the <code>players</code> collection with ESPN headshots</li>
      </ul>

      {/* Week selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Week to Sync</label>
        <div className="flex gap-2">
          {WEEKS.map(week => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                selectedWeek === week
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {PLAYOFF_WEEK_DISPLAY_NAMES[week]}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          CSV file: <code>{WEEK_CSV_FILES[WEEK_NUMBERS[selectedWeek]]}</code>
        </p>
      </div>

      <button
        onClick={handleSync}
        disabled={syncing}
        className={`px-4 py-2 rounded-lg font-medium ${
          syncing
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
        {syncing ? 'Syncing...' : `Sync ${PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]}`}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-100 text-green-700 rounded-lg">
          <p className="font-medium">Sync complete for {PLAYOFF_WEEK_DISPLAY_NAMES[selectedWeek]}!</p>

          {result.teams && (
            <div className="mt-2 text-sm">
              <p className="font-medium">Teams ({result.teams.length}):</p>
              <p className="font-mono text-xs">{result.teams.join(', ')}</p>
            </div>
          )}

          <p className="mt-2">Synced {result.synced} players</p>

          {result.byPosition && (
            <div className="text-sm">
              <p className="font-medium">By position:</p>
              <p>
                {Object.entries(result.byPosition)
                  .map(([pos, count]) => `${pos}: ${count}`)
                  .join(' | ')}
              </p>
            </div>
          )}

          {result.ranksCount !== undefined && (
            <p className="text-sm mt-1">Saved {result.ranksCount} player ranks</p>
          )}

          {result.notFound.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm">
                {result.notFound.length} players not found in ESPN (using team logos for DST/K)
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
