export type TabType = 'roster' | 'wildcard-stats' | 'live' | 'scores' | 'admin';

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  showAdmin?: boolean;
  weekName?: string;
  currentWeek?: number;
}

export function TabNav({ activeTab, onTabChange, showAdmin = false, weekName, currentWeek = 1 }: TabNavProps) {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-8 overflow-x-auto">
          <button
            onClick={() => onTabChange('roster')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'roster'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Set Roster {weekName ? `(${weekName})` : ''}
          </button>
          {/* Show Wild Card Stats tab after wildcard week */}
          {currentWeek > 1 && (
            <button
              onClick={() => onTabChange('wildcard-stats')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'wildcard-stats'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Wild Card Stats
            </button>
          )}
          <button
            onClick={() => onTabChange('live')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'live'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Live Stats
          </button>
          <button
            onClick={() => onTabChange('scores')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === 'scores'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Scoreboard
          </button>
          {showAdmin && (
            <button
              onClick={() => onTabChange('admin')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'admin'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Admin
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
