import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
} from 'firebase/firestore';
import type { User, WeeklyRoster, UsedPlayers, Player } from '../types';

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

// Sync players from CSV to Firestore with ESPN headshots
export async function syncPlayersToFirestore(
  players: Player[],
  espnPlayerMap: Map<string, { espnId: string; imageUrl?: string }>
): Promise<{ synced: number; notFound: string[] }> {
  const notFound: string[] = [];
  let synced = 0;

  // First clear existing players
  await clearAllPlayers();

  // Then add new players
  for (const player of players) {
    const nameLower = player.name.toLowerCase().trim();
    const espnData = espnPlayerMap.get(nameLower);

    const playerToSave: Player = {
      ...player,
      imageUrl: espnData?.imageUrl || player.imageUrl,
    };

    // Use ESPN ID if found, otherwise use the CSV-generated ID
    const docId = espnData?.espnId || player.id;

    try {
      await setDoc(doc(db, 'players', docId), {
        ...playerToSave,
        id: docId,
      });
      synced++;
    } catch (error) {
      console.error(`Error saving player ${player.name}:`, error);
    }

    if (!espnData) {
      notFound.push(player.name);
    }
  }

  console.log(`Synced ${synced} players, ${notFound.length} not found in ESPN`);
  return { synced, notFound };
}
