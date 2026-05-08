import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  GOALS: '@tt_goals',
  SESSIONS: '@tt_sessions',
  ACTIVE_SESSION: '@tt_active_session',
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export async function getGoals() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.GOALS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveGoals(goals) {
  await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(goals));
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function getSessions() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveSessions(sessions) {
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

// ─── Active Session ───────────────────────────────────────────────────────────

export async function getActiveSession() {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ACTIVE_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveActiveSession(session) {
  if (session === null) {
    await AsyncStorage.removeItem(KEYS.ACTIVE_SESSION);
  } else {
    await AsyncStorage.setItem(KEYS.ACTIVE_SESSION, JSON.stringify(session));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getTodayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
