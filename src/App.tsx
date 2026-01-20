import { useState, ReactNode } from 'react';
import { AuthContext, useAuthProvider, useAuth } from './hooks/useAuth';
import { useRoster } from './hooks/useRoster';
import { usePlayers } from './hooks/usePlayers';
import { useMultiWeekStandings } from './hooks/useScoring';
import { useCurrentWeek } from './hooks/useCurrentWeek';
import { GoogleSignIn } from './components/auth/GoogleSignIn';
import { Layout } from './components/layout/Layout';
import { RosterBuilder } from './components/roster/RosterBuilder';
import { Scoreboard } from './components/scoring/Scoreboard';
import { LiveStats } from './components/scoring/LiveStats';
import { WeeklyPlayerStats } from './components/scoring/WeeklyPlayerStats';
import { AdminSync } from './components/admin/AdminSync';
import { AdminStats } from './components/admin/AdminStats';
import { AdminScoringRules } from './components/admin/AdminScoringRules';
import { AdminWeek } from './components/admin/AdminWeek';
import { AdminRosterLock } from './components/admin/AdminRosterLock';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminLiveStats } from './components/admin/AdminLiveStats';
import { AdminScoreboardTab } from './components/admin/AdminScoreboardTab';
import { AdminWeeklySummary } from './components/admin/AdminWeeklySummary';
import { AdminInjuryReport } from './components/admin/AdminInjuryReport';
import { AdminMissingLineups } from './components/admin/AdminMissingLineups';
import { Analysis } from './components/analysis/Analysis';
import type { TabType } from './components/layout/TabNav';

// Admin email addresses
const ADMIN_EMAILS = ['william.f.parker@gmail.com'];

// Auth Provider wrapper
function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthProvider();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// Main app content (when authenticated)
function AppContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('roster');
  const { week: currentWeek, weekName, loading: weekLoading } = useCurrentWeek();

  const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email));

  // Load players for the current week
  const {
    players,
    loading: playersLoading,
    getPlayerById,
  } = usePlayers(currentWeek);

  // Load user's roster
  const {
    roster,
    usedPlayers,
    loading: rosterLoading,
    error: rosterError,
    setPlayerForSlot,
    saveCurrentRoster,
  } = useRoster(user?.uid || null, currentWeek);

  // Load scoreboard (multi-week standings)
  const {
    standings,
    loading: scoresLoading,
    error: scoresError,
    refresh: refreshScores,
  } = useMultiWeekStandings(getPlayerById);

  return (
    <Layout
      currentWeek={currentWeek}
      weekName={weekName}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      showAdmin={isAdmin}
    >
      {activeTab === 'roster' ? (
        <RosterBuilder
          roster={roster}
          players={players}
          usedPlayers={usedPlayers}
          loading={rosterLoading || playersLoading || weekLoading}
          error={rosterError}
          currentWeek={currentWeek}
          getPlayerById={getPlayerById}
          onSetPlayer={setPlayerForSlot}
          onSave={saveCurrentRoster}
        />
      ) : activeTab === 'previous-stats' ? (
        <WeeklyPlayerStats currentWeek={currentWeek} />
      ) : activeTab === 'live' ? (
        <LiveStats currentWeek={currentWeek} />
      ) : activeTab === 'scores' ? (
        <Scoreboard
          standings={standings}
          loading={scoresLoading}
          error={scoresError}
          onRefresh={refreshScores}
          currentUserId={user?.uid}
        />
      ) : activeTab === 'analysis' ? (
        <Analysis />
      ) : (
        <div className="space-y-6">
          <AdminWeek />
          <AdminRosterLock />
          <AdminMissingLineups />
          <AdminInjuryReport />
          <AdminLiveStats currentWeek={currentWeek} />
          <AdminScoreboardTab />
          <AdminWeeklySummary />
          <AdminUsers />
          <AdminScoringRules />
          <AdminStats />
          <AdminSync />
        </div>
      )}
    </Layout>
  );
}

// App wrapper with auth check
function AppWithAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-900">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <GoogleSignIn />;
  }

  return <AppContent />;
}

// Root App component
export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}
