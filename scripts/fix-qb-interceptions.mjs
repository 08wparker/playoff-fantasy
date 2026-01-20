#!/usr/bin/env node
// One-time script to fix QB interceptions in Firebase
// Run with: node scripts/fix-qb-interceptions.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

// Firebase config (same as app)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'playoff-fantasy-173e1',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// QB Interception corrections
const corrections = {
  wildcard: [
    { name: 'Matthew Stafford', team: 'LAR', interceptions: 1 },
    { name: 'Bryce Young', team: 'CAR', interceptions: 1 },
    { name: 'Caleb Williams', team: 'CHI', interceptions: 2 },
    { name: 'Trevor Lawrence', team: 'JAX', interceptions: 2 },
    { name: 'Brock Purdy', team: 'SF', interceptions: 2 },
    { name: 'Drake Maye', team: 'NE', interceptions: 1 },
    { name: 'C.J. Stroud', team: 'HOU', interceptions: 1 },
    { name: 'Aaron Rodgers', team: 'PIT', interceptions: 1 },
  ],
  divisional: [
    { name: 'Josh Allen', team: 'BUF', interceptions: 2 },
    { name: 'Bo Nix', team: 'DEN', interceptions: 1 },
    { name: 'Brock Purdy', team: 'SF', interceptions: 1 },
    { name: 'Sam Darnold', team: 'SEA', interceptions: 0 },
    { name: 'C.J. Stroud', team: 'HOU', interceptions: 4 },
    { name: 'Drake Maye', team: 'NE', interceptions: 1 },
    { name: 'Matthew Stafford', team: 'LAR', interceptions: 0 },
    { name: 'Caleb Williams', team: 'CHI', interceptions: 3 },
  ],
};

// Player ID mapping (we need to match names to Firebase player IDs)
// These would be fetched from Firebase 'players' collection
async function getPlayerIdByName(name, team) {
  // For simplicity, construct the expected ID format
  // In the actual app, IDs might be ESPN player IDs
  // We'll need to look these up from the players collection

  // Common ID patterns - adjust based on your data
  const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
  return null; // Will need to be looked up
}

async function updateInterceptions(weekName, playerName, team, interceptions) {
  console.log(`Updating ${playerName} (${team}) in ${weekName}: ${interceptions} INT`);

  // The stats are stored at: playerStats/{weekName}/players/{playerId}
  // We need to find the playerId first

  // For now, let's output the curl commands to update via REST API
  console.log(`  -> Need player ID lookup for ${playerName}`);
}

async function main() {
  console.log('=== QB Interception Fix Script ===\n');

  console.log('Wild Card corrections needed:');
  for (const { name, team, interceptions } of corrections.wildcard) {
    console.log(`  ${name} (${team}): ${interceptions} INT`);
  }

  console.log('\nDivisional corrections needed:');
  for (const { name, team, interceptions } of corrections.divisional) {
    console.log(`  ${name} (${team}): ${interceptions} INT`);
  }

  console.log('\n\nTo fix these manually:');
  console.log('1. Go to Admin > Stats tab');
  console.log('2. Select the week (Wild Card or Divisional)');
  console.log('3. Find each QB and update their INT column');
  console.log('\nOr use the Live Stats re-sync (now that the code is fixed)');
}

main().catch(console.error);
