import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  currentWeek: number;
  weekName: string;
}

export function Header({ currentWeek, weekName }: HeaderProps) {
  const { user, signOutUser } = useAuth();

  return (
    <header className="bg-primary-800 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏈</span>
            <div>
              <h1 className="text-xl font-bold">Playoff Fantasy</h1>
              <p className="text-primary-200 text-sm">
                Week {currentWeek}: {weekName}
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {user.photoURL && (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm hidden sm:block">
                  {user.displayName}
                </span>
              </div>
              <button
                onClick={signOutUser}
                className="text-primary-200 hover:text-white text-sm transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
