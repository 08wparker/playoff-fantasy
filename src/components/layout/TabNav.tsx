interface TabNavProps {
  activeTab: 'roster' | 'live' | 'scores' | 'admin';
  onTabChange: (tab: 'roster' | 'live' | 'scores' | 'admin') => void;
  showAdmin?: boolean;
  weekName?: string;
}

export function TabNav({ activeTab, onTabChange, showAdmin = false, weekName }: TabNavProps) {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex gap-8">
          <button
            onClick={() => onTabChange('roster')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'roster'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Set Roster {weekName ? `(${weekName})` : ''}
          </button>
          <button
            onClick={() => onTabChange('live')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'live'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Live Stats
          </button>
          <button
            onClick={() => onTabChange('scores')}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
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
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
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
