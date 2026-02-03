/**
 * Admin Season Configuration Component
 *
 * Displays the current season configuration and provides guidance on updating it.
 * In a future iteration, this could allow editing the config directly in Firebase.
 */

import { useState } from 'react';
import {
  SEASON_YEAR,
  WEEK_LOCK_TIMES,
  ESPN_PLAYOFF_DATE_RANGES,
  INITIAL_PLAYOFF_TEAMS,
  ELIMINATED_TEAMS,
  GAME_RESULTS,
  SUPER_BOWL_TEAMS,
} from '../../config/season';
import { PLAYOFF_WEEKS } from '../../config/weeks';

export function AdminSeasonConfig() {
  const [expandedSection, setExpandedSection] = useState<string | null>('lockTimes');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Season Configuration</h2>
            <p className="text-sm text-gray-500">
              Current season: <span className="font-medium text-primary-600">{SEASON_YEAR}</span>
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            Code-based Config
          </span>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Season configuration is currently stored in code at{' '}
            <code className="bg-blue-100 px-1 rounded">src/config/season.ts</code>.
            Update this file for next season's playoffs.
          </p>
        </div>

        {/* Lock Times Section */}
        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            onClick={() => toggleSection('lockTimes')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">Roster Lock Times</span>
            <span className="text-gray-400">{expandedSection === 'lockTimes' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'lockTimes' && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {PLAYOFF_WEEKS.map(week => {
                  const lockTime = WEEK_LOCK_TIMES[week.number];
                  const isPast = lockTime && new Date() > lockTime;
                  return (
                    <div
                      key={week.number}
                      className={`flex items-center justify-between p-2 rounded ${
                        isPast ? 'bg-gray-100 text-gray-500' : 'bg-green-50'
                      }`}
                    >
                      <span className="font-medium">{week.label}</span>
                      <span className="text-sm">
                        {lockTime ? formatDate(lockTime) : 'Not set'}
                        {isPast && <span className="ml-2 text-xs">(Locked)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ESPN Date Ranges Section */}
        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            onClick={() => toggleSection('espnDates')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">ESPN API Date Ranges</span>
            <span className="text-gray-400">{expandedSection === 'espnDates' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'espnDates' && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {PLAYOFF_WEEKS.map(week => (
                  <div key={week.number} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="font-medium">{week.label}</span>
                    <code className="text-sm bg-gray-200 px-2 py-1 rounded">
                      {ESPN_PLAYOFF_DATE_RANGES[week.number] || 'Not set'}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Playoff Teams Section */}
        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            onClick={() => toggleSection('teams')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">Playoff Teams ({INITIAL_PLAYOFF_TEAMS.length})</span>
            <span className="text-gray-400">{expandedSection === 'teams' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'teams' && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {INITIAL_PLAYOFF_TEAMS.map(team => {
                  const isEliminated =
                    ELIMINATED_TEAMS.afterWildcard.has(team) ||
                    ELIMINATED_TEAMS.afterDivisional.has(team) ||
                    ELIMINATED_TEAMS.afterChampionship.has(team);
                  const inSuperBowl = team === SUPER_BOWL_TEAMS.afc || team === SUPER_BOWL_TEAMS.nfc;
                  return (
                    <span
                      key={team}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        inSuperBowl
                          ? 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-400'
                          : isEliminated
                          ? 'bg-gray-100 text-gray-400 line-through'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {team}
                    </span>
                  );
                })}
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Super Bowl:</span> {SUPER_BOWL_TEAMS.afc} vs {SUPER_BOWL_TEAMS.nfc}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Eliminated Teams Section */}
        <div className="border border-gray-200 rounded-lg mb-4">
          <button
            onClick={() => toggleSection('eliminated')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">Elimination Tracking</span>
            <span className="text-gray-400">{expandedSection === 'eliminated' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'eliminated' && (
            <div className="px-4 pb-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">After Wild Card:</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(ELIMINATED_TEAMS.afterWildcard).map(team => (
                    <span key={team} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      {team}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">After Divisional:</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(ELIMINATED_TEAMS.afterDivisional).map(team => (
                    <span key={team} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      {team}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">After Championship:</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(ELIMINATED_TEAMS.afterChampionship).map(team => (
                    <span key={team} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      {team}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Game Results Section */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => toggleSection('games')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">Game Results</span>
            <span className="text-gray-400">{expandedSection === 'games' ? '−' : '+'}</span>
          </button>
          {expandedSection === 'games' && (
            <div className="px-4 pb-4 space-y-4">
              {PLAYOFF_WEEKS.map(week => {
                const games = GAME_RESULTS[week.name];
                if (!games || games.length === 0) return null;
                return (
                  <div key={week.number}>
                    <p className="text-sm font-medium text-gray-700 mb-2">{week.label}:</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {games.map((game, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                        >
                          <span>{game.shortName}</span>
                          <span className="font-medium">
                            {game.awayScore} - {game.homeScore}
                            {game.isOT && <span className="ml-1 text-xs text-gray-500">(OT)</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Update Instructions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-3">Updating for Next Season</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>To update the app for the next season:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>
              Update <code className="bg-gray-100 px-1 rounded">src/config/season.ts</code> with new dates, teams, etc.
            </li>
            <li>
              Create new player CSV files in <code className="bg-gray-100 px-1 rounded">public/data/</code>
            </li>
            <li>
              Clear Firebase collections or create new ones for the new season
            </li>
            <li>
              Update <code className="bg-gray-100 px-1 rounded">CLAUDE.md</code> documentation
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
