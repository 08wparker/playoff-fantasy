import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  arrayUnion,
  onSnapshot,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import type { User, WeeklyRoster, UsedPlayers, Player, PlayerStats, PlayoffWeekName, NFLTeam, InjuryStatus } from '../types';

// Firebase configuration - Replace with your own config from Firebase Console
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Auth functions
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Save/update user in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    }, { merge: true });

    // Initialize usedPlayers if doesn't exist
    const usedPlayersRef = doc(db, 'usedPlayers', user.uid);
    const usedPlayersSnap = await getDoc(usedPlayersRef);
    if (!usedPlayersSnap.exists()) {
      await setDoc(usedPlayersRef, { players: [] });
    }

    return {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    return null;
  }
}

// Email/password sign up
export async function signUpWithEmail(email: string, password: string, displayName: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Set display name
    await updateProfile(user, { displayName });

    // Save user in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      displayName,
      email: user.email,
      photoURL: null,
    }, { merge: true });

    // Initialize usedPlayers
    const usedPlayersRef = doc(db, 'usedPlayers', user.uid);
    const usedPlayersSnap = await getDoc(usedPlayersRef);
    if (!usedPlayersSnap.exists()) {
      await setDoc(usedPlayersRef, { players: [] });
    }

    return {
      user: {
        uid: user.uid,
        displayName,
        email: user.email,
        photoURL: null,
      },
      error: null,
    };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    let errorMessage = 'Failed to create account';
    if (firebaseError.code === 'auth/email-already-in-use') {
      errorMessage = 'Email already in use';
    } else if (firebaseError.code === 'auth/weak-password') {
      errorMessage = 'Password must be at least 6 characters';
    } else if (firebaseError.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    }
    console.error('Error signing up:', error);
    return { user: null, error: errorMessage };
  }
}

// Email/password sign in
export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Update user in Firestore (in case displayName changed)
    await setDoc(doc(db, 'users', user.uid), {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    }, { merge: true });

    // Initialize usedPlayers if doesn't exist
    const usedPlayersRef = doc(db, 'usedPlayers', user.uid);
    const usedPlayersSnap = await getDoc(usedPlayersRef);
    if (!usedPlayersSnap.exists()) {
      await setDoc(usedPlayersRef, { players: [] });
    }

    return {
      user: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      },
      error: null,
    };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    let errorMessage = 'Failed to sign in';
    if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password' || firebaseError.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid email or password';
    } else if (firebaseError.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    }
    console.error('Error signing in:', error);
    return { user: null, error: errorMessage };
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      callback({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      });
    } else {
      callback(null);
    }
  });
}

// Roster functions
export async function getRoster(userId: string, week: number): Promise<WeeklyRoster | null> {
  try {
    const rosterRef = doc(db, 'rosters', userId, 'weeks', week.toString());
    const rosterSnap = await getDoc(rosterRef);

    if (rosterSnap.exists()) {
      return rosterSnap.data() as WeeklyRoster;
    }
    return null;
  } catch (error) {
    console.error('Error getting roster:', error);
    return null;
  }
}

export async function saveRoster(roster: WeeklyRoster): Promise<boolean> {
  try {
    const rosterRef = doc(db, 'rosters', roster.odId, 'weeks', roster.week.toString());
    await setDoc(rosterRef, roster);
    return true;
  } catch (error) {
    console.error('Error saving roster:', error);
    return false;
  }
}

export async function lockRoster(userId: string, week: number): Promise<boolean> {
  try {
    const rosterRef = doc(db, 'rosters', userId, 'weeks', week.toString());
    await updateDoc(rosterRef, { locked: true });
    return true;
  } catch (error) {
    console.error('Error locking roster:', error);
    return false;
  }
}

// Admin function to lock all rosters for a week
export async function lockAllRostersForWeek(week: number): Promise<{ locked: number; errors: number }> {
  const results = { locked: 0, errors: 0 };

  try {
    const rosters = await getAllRostersForWeek(week);

    for (const roster of rosters) {
      if (roster.locked) {
        results.locked++; // Already locked
        continue;
      }

      try {
        // Lock the roster
        await lockRoster(roster.odId, week);

        // Get all player IDs from the roster
        const playerIds = [
          roster.qb, roster.rb1, roster.rb2,
          roster.wr1, roster.wr2, roster.wr3,
          roster.te, roster.dst, roster.k,
        ].filter((id): id is string => id !== null);

        // Add players to used list
        if (playerIds.length > 0) {
          await addUsedPlayers(roster.odId, playerIds);
        }

        results.locked++;
      } catch (err) {
        console.error(`Error locking roster for ${roster.odId}:`, err);
        results.errors++;
      }
    }
  } catch (error) {
    console.error('Error locking all rosters:', error);
  }

  return results;
}

// Used players functions
export async function getUsedPlayers(userId: string): Promise<string[]> {
  try {
    const usedRef = doc(db, 'usedPlayers', userId);
    const usedSnap = await getDoc(usedRef);

    if (usedSnap.exists()) {
      return (usedSnap.data() as UsedPlayers).players;
    }
    return [];
  } catch (error) {
    console.error('Error getting used players:', error);
    return [];
  }
}

export async function addUsedPlayers(userId: string, playerIds: string[]): Promise<boolean> {
  try {
    const usedRef = doc(db, 'usedPlayers', userId);
    await updateDoc(usedRef, {
      players: arrayUnion(...playerIds),
    });
    return true;
  } catch (error) {
    console.error('Error adding used players:', error);
    return false;
  }
}

// Reset a user's usedPlayers list to empty
export async function resetUsedPlayers(userId: string): Promise<boolean> {
  try {
    const usedRef = doc(db, 'usedPlayers', userId);
    await setDoc(usedRef, { players: [] });
    console.log(`Reset usedPlayers for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error resetting used players:', error);
    return false;
  }
}

// Sync a user's roster for a specific week to their usedPlayers list
export async function syncRosterToUsedPlayers(userId: string, week: number): Promise<{ success: boolean; playerIds: string[] }> {
  try {
    const roster = await getRoster(userId, week);
    if (!roster) {
      console.log(`No roster found for user ${userId} week ${week}`);
      return { success: false, playerIds: [] };
    }

    const playerIds = [
      roster.qb, roster.rb1, roster.rb2,
      roster.wr1, roster.wr2, roster.wr3,
      roster.te, roster.dst, roster.k,
    ].filter((id): id is string => id !== null);

    if (playerIds.length === 0) {
      console.log(`No players in roster for user ${userId} week ${week}`);
      return { success: false, playerIds: [] };
    }

    // Ensure usedPlayers doc exists
    const usedRef = doc(db, 'usedPlayers', userId);
    const usedSnap = await getDoc(usedRef);
    if (!usedSnap.exists()) {
      await setDoc(usedRef, { players: [] });
    }

    // Add players to used list
    await updateDoc(usedRef, {
      players: arrayUnion(...playerIds),
    });

    console.log(`Synced ${playerIds.length} players to usedPlayers for user ${userId} week ${week}`);
    return { success: true, playerIds };
  } catch (error) {
    console.error('Error syncing roster to used players:', error);
    return { success: false, playerIds: [] };
  }
}

// Get all users for scoreboard
export async function getAllUsers(): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    return usersSnap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    })) as User[];
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

// Update user payment status
export async function updateUserPaymentStatus(userId: string, hasPaid: boolean): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { hasPaid });
    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}

// Get all rosters for a week
export async function getAllRostersForWeek(week: number): Promise<WeeklyRoster[]> {
  try {
    const users = await getAllUsers();
    const rosters: WeeklyRoster[] = [];

    for (const user of users) {
      const roster = await getRoster(user.uid, week);
      if (roster) {
        rosters.push(roster);
      }
    }

    return rosters;
  } catch (error) {
    console.error('Error getting all rosters for week:', error);
    return [];
  }
}

// Real-time roster subscription
export function subscribeToRoster(
  userId: string,
  week: number,
  callback: (roster: WeeklyRoster | null) => void
): () => void {
  const rosterRef = doc(db, 'rosters', userId, 'weeks', week.toString());
  return onSnapshot(rosterRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as WeeklyRoster);
    } else {
      callback(null);
    }
  });
}

// Player cache functions
export async function getCachedPlayers(): Promise<Player[]> {
  try {
    const playersRef = collection(db, 'players');
    const playersSnap = await getDocs(playersRef);

    return playersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Player[];
  } catch (error) {
    console.error('Error getting cached players:', error);
    return [];
  }
}

export async function cachePlayer(player: Player): Promise<void> {
  try {
    await setDoc(doc(db, 'players', player.id), player);
  } catch (error) {
    console.error('Error caching player:', error);
  }
}

// Update specific fields on a player
export async function updatePlayer(
  playerId: string,
  updates: Partial<Player>
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'players', playerId);
    await updateDoc(playerRef, updates);
    console.log(`Updated player ${playerId}:`, updates);
    return true;
  } catch (error) {
    console.error('Error updating player:', error);
    return false;
  }
}

// Check if a player ID is used by any user
export async function checkPlayerUsage(playerId: string): Promise<{
  usedByUsers: string[];
  inRosters: { odId: string; week: number }[];
}> {
  const result = {
    usedByUsers: [] as string[],
    inRosters: [] as { odId: string; week: number }[],
  };

  try {
    // Check usedPlayers collection
    const usedPlayersRef = collection(db, 'usedPlayers');
    const usedSnapshot = await getDocs(usedPlayersRef);

    for (const docSnap of usedSnapshot.docs) {
      const data = docSnap.data() as UsedPlayers;
      if (data.players?.includes(playerId)) {
        result.usedByUsers.push(docSnap.id);
      }
    }

    // Check all rosters
    const rostersRef = collection(db, 'rosters');
    const rostersSnapshot = await getDocs(rostersRef);

    for (const rosterDoc of rostersSnapshot.docs) {
      const weeksRef = collection(db, 'rosters', rosterDoc.id, 'weeks');
      const weeksSnapshot = await getDocs(weeksRef);

      for (const weekDoc of weeksSnapshot.docs) {
        const roster = weekDoc.data() as WeeklyRoster;
        // Check each slot in the roster
        const rosterPlayerIds = [
          roster.qb, roster.rb1, roster.rb2,
          roster.wr1, roster.wr2, roster.wr3,
          roster.te, roster.dst, roster.k
        ].filter(Boolean);
        if (rosterPlayerIds.includes(playerId)) {
          result.inRosters.push({
            odId: rosterDoc.id,
            week: roster.week,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking player usage:', error);
  }

  return result;
}

export async function cachePlayers(players: Player[]): Promise<void> {
  try {
    for (const player of players) {
      await cachePlayer(player);
    }
  } catch (error) {
    console.error('Error caching players:', error);
  }
}

// Clear all players from Firestore
export async function clearAllPlayers(): Promise<void> {
  try {
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);

    const deletePromises = snapshot.docs.map(doc =>
      import('firebase/firestore').then(({ deleteDoc }) => deleteDoc(doc.ref))
    );

    await Promise.all(deletePromises);
    console.log(`Deleted ${snapshot.docs.length} players from Firestore`);
  } catch (error) {
    console.error('Error clearing players:', error);
    throw error;
  }
}

// Delete specific players by ID
export async function deletePlayersByIds(playerIds: string[]): Promise<number> {
  let deleted = 0;
  for (const playerId of playerIds) {
    try {
      await deleteDoc(doc(db, 'players', playerId));
      deleted++;
      console.log(`Deleted player: ${playerId}`);
    } catch (error) {
      console.error(`Error deleting player ${playerId}:`, error);
    }
  }
  return deleted;
}

// NFL team logo URLs (using ESPN CDN)
const NFL_TEAM_LOGOS: Record<string, string> = {
  ARI: 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
  ATL: 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
  BAL: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
  BUF: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  CAR: 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
  CHI: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
  CIN: 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
  CLE: 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
  DAL: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
  DEN: 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
  DET: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
  GB: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
  HOU: 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
  IND: 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
  JAX: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
  KC: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
  LAC: 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  LAR: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
  LV: 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
  MIA: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
  MIN: 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
  NE: 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
  NO: 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
  NYG: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
  NYJ: 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
  PHI: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
  PIT: 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
  SEA: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
  SF: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
  TB: 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
  TEN: 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
  WAS: 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
};

// Sync players from CSV to Firestore with ESPN headshots
// Note: rank is NOT stored with player - it's stored separately per week in playerRanks collection
export async function syncPlayersToFirestore(
  players: Player[],
  espnPlayerMap: Map<string, { espnId: string; imageUrl?: string }>
): Promise<{ synced: number; notFound: string[]; byPosition: Record<string, number>; playerIdMap: Map<string, string> }> {
  const notFound: string[] = [];
  let synced = 0;
  const byPosition: Record<string, number> = {};
  const playerIdMap = new Map<string, string>(); // Maps CSV player name -> Firebase doc ID

  // NOTE: We do NOT clear existing players - we need to keep players from previous weeks
  // for historical scoring. Players are filtered by week's playoffConfig teams in usePlayers hook.
  console.log(`Syncing ${players.length} players from CSV (adding/updating, not clearing)...`);

  // Then add new players
  for (const player of players) {
    const nameLower = player.name.toLowerCase().trim();
    const espnData = espnPlayerMap.get(nameLower);

    // Determine image URL: ESPN headshot, or team logo for DST/K
    let imageUrl = espnData?.imageUrl;
    if (!imageUrl && (player.position === 'DST' || player.position === 'K')) {
      imageUrl = NFL_TEAM_LOGOS[player.team] || undefined;
    }

    // Use ESPN ID if found, otherwise use the CSV-generated ID
    const docId = espnData?.espnId || player.id;

    // Save player WITHOUT rank (rank is stored separately per week)
    const playerToSave = {
      id: docId,
      name: player.name,
      team: player.team,
      position: player.position,
      imageUrl,
    };

    try {
      await setDoc(doc(db, 'players', docId), playerToSave);
      synced++;
      byPosition[player.position] = (byPosition[player.position] || 0) + 1;
      playerIdMap.set(player.name, docId);
    } catch (error) {
      console.error(`Error saving player ${player.name} (${player.position}):`, error);
    }

    if (!espnData) {
      notFound.push(player.name);
    }
  }

  console.log(`Synced ${synced} players by position:`, byPosition);
  console.log(`${notFound.length} players not found in ESPN`);
  return { synced, notFound, byPosition, playerIdMap };
}

// Player stats functions - stored by week name (wildcard, divisional, etc.)

// Get stats for a specific player in a specific week
export async function getPlayerStats(
  weekName: PlayoffWeekName,
  playerId: string
): Promise<PlayerStats | null> {
  try {
    const statsRef = doc(db, 'playerStats', weekName, 'players', playerId);
    const statsSnap = await getDoc(statsRef);

    if (statsSnap.exists()) {
      return statsSnap.data() as PlayerStats;
    }
    return null;
  } catch (error) {
    console.error('Error getting player stats:', error);
    return null;
  }
}

// Save stats for a player in a specific week
export async function savePlayerStats(
  weekName: PlayoffWeekName,
  playerId: string,
  stats: Omit<PlayerStats, 'playerId' | 'week'>
): Promise<boolean> {
  try {
    const weekNumber = { wildcard: 1, divisional: 2, championship: 3, superbowl: 4 }[weekName];
    const statsRef = doc(db, 'playerStats', weekName, 'players', playerId);
    await setDoc(statsRef, {
      ...stats,
      playerId,
      week: weekNumber,
    });
    return true;
  } catch (error) {
    console.error('Error saving player stats:', error);
    return false;
  }
}

// Batch save stats for multiple players (reduces Firebase writes)
export async function batchSavePlayerStats(
  weekName: PlayoffWeekName,
  statsArray: { playerId: string; stats: Omit<PlayerStats, 'playerId' | 'week'> }[]
): Promise<number> {
  if (statsArray.length === 0) return 0;

  const weekNumber = { wildcard: 1, divisional: 2, championship: 3, superbowl: 4 }[weekName];
  let saved = 0;

  // Firestore batch limit is 500, so chunk if needed
  const chunkSize = 500;
  for (let i = 0; i < statsArray.length; i += chunkSize) {
    const chunk = statsArray.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const { playerId, stats } of chunk) {
      const statsRef = doc(db, 'playerStats', weekName, 'players', playerId);
      batch.set(statsRef, {
        ...stats,
        playerId,
        week: weekNumber,
      });
    }

    try {
      await batch.commit();
      saved += chunk.length;
    } catch (error) {
      console.error('Error in batch save:', error);
    }
  }

  return saved;
}

// Get all player stats for a specific week
export async function getAllPlayerStatsForWeek(
  weekName: PlayoffWeekName
): Promise<PlayerStats[]> {
  try {
    const statsRef = collection(db, 'playerStats', weekName, 'players');
    const statsSnap = await getDocs(statsRef);

    return statsSnap.docs.map(doc => doc.data() as PlayerStats);
  } catch (error) {
    console.error('Error getting all player stats for week:', error);
    return [];
  }
}

// Clear all player stats for a specific week
export async function clearAllPlayerStatsForWeek(
  weekName: PlayoffWeekName
): Promise<number> {
  try {
    const statsRef = collection(db, 'playerStats', weekName, 'players');
    const statsSnap = await getDocs(statsRef);

    let deleted = 0;
    for (const docSnap of statsSnap.docs) {
      await deleteDoc(docSnap.ref);
      deleted++;
    }

    console.log(`Cleared ${deleted} player stats for ${weekName}`);
    return deleted;
  } catch (error) {
    console.error('Error clearing player stats for week:', error);
    return 0;
  }
}

// Subscribe to player stats for a week (real-time updates)
export function subscribeToWeekStats(
  weekName: PlayoffWeekName,
  callback: (stats: PlayerStats[]) => void
): () => void {
  const statsRef = collection(db, 'playerStats', weekName, 'players');
  return onSnapshot(statsRef, (snapshot) => {
    const stats = snapshot.docs.map(doc => doc.data() as PlayerStats);
    callback(stats);
  });
}

// ============================================
// Playoff Config functions (teams per week)
// ============================================

// Save playoff config for a week (teams playing that week)
export async function savePlayoffConfig(
  weekName: PlayoffWeekName,
  teams: NFLTeam[]
): Promise<boolean> {
  try {
    const configRef = doc(db, 'playoffConfig', weekName);
    await setDoc(configRef, {
      weekName,
      teams,
      updatedAt: new Date(),
    });
    console.log(`Saved playoff config for ${weekName}: ${teams.length} teams`);
    return true;
  } catch (error) {
    console.error('Error saving playoff config:', error);
    return false;
  }
}

// Get playoff config for a week
export async function getPlayoffConfig(weekName: PlayoffWeekName): Promise<NFLTeam[]> {
  try {
    const configRef = doc(db, 'playoffConfig', weekName);
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data().teams as NFLTeam[];
    }
    return [];
  } catch (error) {
    console.error('Error getting playoff config:', error);
    return [];
  }
}

// ============================================
// Player Ranks functions (ranks per week)
// ============================================

// Save player ranks for a week
export async function savePlayerRanks(
  weekName: PlayoffWeekName,
  ranks: Map<string, number>
): Promise<boolean> {
  try {
    // Save each player's rank as a separate document
    const promises: Promise<void>[] = [];
    ranks.forEach((rank, playerId) => {
      const rankRef = doc(db, 'playerRanks', weekName, 'players', playerId);
      promises.push(setDoc(rankRef, { playerId, rank }));
    });
    await Promise.all(promises);
    console.log(`Saved ${ranks.size} player ranks for ${weekName}`);
    return true;
  } catch (error) {
    console.error('Error saving player ranks:', error);
    return false;
  }
}

// Get all player ranks for a week
export async function getPlayerRanks(weekName: PlayoffWeekName): Promise<Map<string, number>> {
  try {
    const ranksRef = collection(db, 'playerRanks', weekName, 'players');
    const ranksSnap = await getDocs(ranksRef);

    const ranks = new Map<string, number>();
    ranksSnap.docs.forEach(doc => {
      const data = doc.data();
      ranks.set(data.playerId, data.rank);
    });
    return ranks;
  } catch (error) {
    console.error('Error getting player ranks:', error);
    return new Map();
  }
}

// ============================================
// Scoring Rules functions
// ============================================

import type { ScoringRules } from './scoring';
import { PPR_SCORING } from './scoring';

// Save scoring rules to Firebase
export async function saveScoringRules(rules: ScoringRules): Promise<boolean> {
  try {
    const rulesRef = doc(db, 'config', 'scoringRules');
    await setDoc(rulesRef, {
      ...rules,
      updatedAt: new Date(),
    });
    console.log('Saved scoring rules to Firebase');
    return true;
  } catch (error) {
    console.error('Error saving scoring rules:', error);
    return false;
  }
}

// Get scoring rules from Firebase (falls back to default PPR if not set)
export async function getScoringRules(): Promise<ScoringRules> {
  try {
    const rulesRef = doc(db, 'config', 'scoringRules');
    const rulesSnap = await getDoc(rulesRef);

    if (rulesSnap.exists()) {
      const data = rulesSnap.data();
      // Remove updatedAt field and return the rest as ScoringRules
      const { updatedAt, ...rules } = data;
      return rules as ScoringRules;
    }
    // Return default PPR scoring if not configured
    return PPR_SCORING;
  } catch (error) {
    console.error('Error getting scoring rules:', error);
    return PPR_SCORING;
  }
}

// Subscribe to scoring rules changes (real-time)
export function subscribeToScoringRules(
  callback: (rules: ScoringRules) => void
): () => void {
  const rulesRef = doc(db, 'config', 'scoringRules');
  return onSnapshot(rulesRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const { updatedAt, ...rules } = data;
      callback(rules as ScoringRules);
    } else {
      callback(PPR_SCORING);
    }
  });
}

// ============================================
// Current Week Override functions
// ============================================

// Save current week override (null means use date-based logic)
export async function saveCurrentWeekOverride(week: number | null): Promise<boolean> {
  try {
    const configRef = doc(db, 'config', 'currentWeek');
    await setDoc(configRef, {
      week,
      updatedAt: new Date(),
    });
    console.log(`Saved current week override: ${week === null ? 'auto (date-based)' : `Week ${week}`}`);
    return true;
  } catch (error) {
    console.error('Error saving current week override:', error);
    return false;
  }
}

// Get current week override (returns null if not set or set to auto)
export async function getCurrentWeekOverride(): Promise<number | null> {
  try {
    const configRef = doc(db, 'config', 'currentWeek');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data().week as number | null;
    }
    return null;
  } catch (error) {
    console.error('Error getting current week override:', error);
    return null;
  }
}

// Subscribe to current week override changes (real-time)
export function subscribeToCurrentWeek(
  callback: (week: number | null) => void
): () => void {
  const configRef = doc(db, 'config', 'currentWeek');
  return onSnapshot(configRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data().week as number | null);
    } else {
      callback(null);
    }
  });
}

// ============================================
// Live Stats Config functions
// ============================================

export interface LiveStatsConfig {
  enabled: boolean;
  updatedAt?: Date;
}

// Save live stats enabled/disabled state
export async function setLiveStatsEnabled(enabled: boolean): Promise<boolean> {
  try {
    const configRef = doc(db, 'config', 'liveStats');
    await setDoc(configRef, {
      enabled,
      updatedAt: new Date(),
    });
    console.log(`Live stats ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error) {
    console.error('Error setting live stats config:', error);
    return false;
  }
}

// Get live stats config
export async function getLiveStatsConfig(): Promise<LiveStatsConfig> {
  try {
    const configRef = doc(db, 'config', 'liveStats');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data() as LiveStatsConfig;
    }
    // Default to disabled
    return { enabled: false };
  } catch (error) {
    console.error('Error getting live stats config:', error);
    return { enabled: false };
  }
}

// Subscribe to live stats config changes (real-time)
export function subscribeToLiveStatsConfig(
  callback: (config: LiveStatsConfig) => void
): () => void {
  const configRef = doc(db, 'config', 'liveStats');
  return onSnapshot(configRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data() as LiveStatsConfig);
    } else {
      callback({ enabled: false });
    }
  });
}

// ============================================
// Scoreboard Default Tab functions
// ============================================

export type ScoreboardTab = 'overall' | 'wildcard' | 'divisional' | 'championship' | 'superbowl';

// Save default scoreboard tab
export async function setDefaultScoreboardTab(tab: ScoreboardTab): Promise<boolean> {
  try {
    const configRef = doc(db, 'config', 'scoreboardTab');
    await setDoc(configRef, {
      tab,
      updatedAt: new Date(),
    });
    console.log(`Set default scoreboard tab to: ${tab}`);
    return true;
  } catch (error) {
    console.error('Error setting default scoreboard tab:', error);
    return false;
  }
}

// Get default scoreboard tab
export async function getDefaultScoreboardTab(): Promise<ScoreboardTab> {
  try {
    const configRef = doc(db, 'config', 'scoreboardTab');
    const configSnap = await getDoc(configRef);

    if (configSnap.exists()) {
      return configSnap.data().tab as ScoreboardTab;
    }
    return 'overall';
  } catch (error) {
    console.error('Error getting default scoreboard tab:', error);
    return 'overall';
  }
}

// ============================================
// Weekly Summary functions
// ============================================

export interface WeeklySummary {
  weekName: PlayoffWeekName;
  summary: string;
  generatedAt: Date;
}

// Save weekly summary
export async function saveWeeklySummary(weekName: PlayoffWeekName, summary: string): Promise<boolean> {
  try {
    const summaryRef = doc(db, 'weeklySummaries', weekName);
    await setDoc(summaryRef, {
      weekName,
      summary,
      generatedAt: new Date(),
    });
    console.log(`Saved summary for ${weekName}`);
    return true;
  } catch (error) {
    console.error('Error saving weekly summary:', error);
    return false;
  }
}

// Get weekly summary
export async function getWeeklySummary(weekName: PlayoffWeekName): Promise<WeeklySummary | null> {
  try {
    const summaryRef = doc(db, 'weeklySummaries', weekName);
    const summarySnap = await getDoc(summaryRef);

    if (summarySnap.exists()) {
      return summarySnap.data() as WeeklySummary;
    }
    return null;
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    return null;
  }
}

// ============================================
// Injury Report functions
// ============================================

// Update a player's injury status
export async function setPlayerInjuryStatus(
  playerId: string,
  status: InjuryStatus | null
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'players', playerId);
    if (status === null) {
      // Remove injury status by setting to deleteField would require import
      // Instead, set to undefined which Firestore will not store
      await updateDoc(playerRef, { injuryStatus: null });
    } else {
      await updateDoc(playerRef, { injuryStatus: status });
    }
    console.log(`Set injury status for ${playerId}: ${status || 'cleared'}`);
    return true;
  } catch (error) {
    console.error('Error setting player injury status:', error);
    return false;
  }
}

// Get all players with injury status
export async function getInjuredPlayers(): Promise<Player[]> {
  try {
    const players = await getCachedPlayers();
    return players.filter(p => p.injuryStatus);
  } catch (error) {
    console.error('Error getting injured players:', error);
    return [];
  }
}

// Clear all injury statuses
export async function clearAllInjuryStatuses(): Promise<number> {
  let cleared = 0;
  try {
    const players = await getCachedPlayers();
    for (const player of players) {
      if (player.injuryStatus) {
        await setPlayerInjuryStatus(player.id, null);
        cleared++;
      }
    }
    console.log(`Cleared ${cleared} injury statuses`);
  } catch (error) {
    console.error('Error clearing injury statuses:', error);
  }
  return cleared;
}
