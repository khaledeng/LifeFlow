import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  AppState,
} from 'react-native';
import {
  getTodayStart,
} from '../storage';
import {
  getTrackingSnapshot,
  startGoal as startTrackingGoal,
  stopGoal as stopTrackingGoal,
  subscribeTrackingChanges,
} from '../trackingService';

// ─── Utilities ────────────────────────────────────────────────────────────────

const pad = n => String(Math.max(0, n)).padStart(2, '0');

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Compute total seconds logged TODAY for each goal (from completed sessions).
 * Does NOT include the currently active session; that's added live via currentElapsed.
 */
function computeTodayTotals(sessions, goals) {
  const todayMs = getTodayStart();
  const totals = {};
  goals.forEach(g => { totals[g.id] = 0; });

  sessions.forEach(s => {
    if (!s.endTime || s.endTime < todayMs) return;
    const clampedStart = Math.max(s.startTime, todayMs);
    const dur = Math.floor((s.endTime - clampedStart) / 1000);
    if (s.goalId in totals) totals[s.goalId] += dur;
  });

  return totals;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrackerScreen({ isActive = true }) {
  const [goals,           setGoals]           = useState([]);
  const [sessions,        setSessions]        = useState([]);
  const [activeSession,   setActiveSession]   = useState(null);
  const [todayTotals,     setTodayTotals]     = useState({});
  const [currentElapsed,  setCurrentElapsed]  = useState(0);

  // Refs so closures (interval, AppState handler) always see latest values
  const activeSessionRef = useRef(null);
  const intervalRef      = useRef(null);
  const appStateRef      = useRef(AppState.currentState);

  // Keep refs in sync with state
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  const applyTrackingSnapshot = useCallback((snapshot) => {
    setGoals(snapshot.goals);
    setSessions(snapshot.sessions);
    setActiveSession(snapshot.activeSession);
    setTodayTotals(computeTodayTotals(snapshot.sessions, snapshot.goals));
    setCurrentElapsed(
      snapshot.activeSession
        ? Math.floor((Date.now() - snapshot.activeSession.startTime) / 1000)
        : 0
    );
  }, []);

  const loadAll = useCallback(async () => {
    applyTrackingSnapshot(await getTrackingSnapshot());
  }, [applyTrackingSnapshot]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => subscribeTrackingChanges(applyTrackingSnapshot), [applyTrackingSnapshot]);

  // Reload goals+sessions every time the screen comes back into focus
  useEffect(() => {
    if (isActive) loadAll();
  }, [isActive, loadAll]);

  useEffect(() => {
    // ── AppState: recalculate when returning to foreground ────────────────
    const sub = AppState.addEventListener('change', nextState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        // Reload persisted state after background notification actions.
        loadAll();
      }
      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, [loadAll]);

  // ── Live interval (display only — source of truth is the timestamp) ───────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeSession) {
      intervalRef.current = setInterval(() => {
        const active = activeSessionRef.current;
        if (active) {
          setCurrentElapsed(Math.floor((Date.now() - active.startTime) / 1000));
        }
      }, 1000);
    } else {
      setCurrentElapsed(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSession]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startGoal = async (goalId) => {
    await startTrackingGoal(goalId);
  };

  const stopGoal = async () => {
    await stopTrackingGoal();
  };

  // ── Display helpers ───────────────────────────────────────────────────────

  const getDisplaySeconds = (goalId) => {
    const base = todayTotals[goalId] || 0;
    if (activeSession?.goalId === goalId) return base + currentElapsed;
    return base;
  };

  const totalTrackedToday = () => {
    const base = Object.values(todayTotals).reduce((a, b) => a + b, 0);
    if (activeSession) return base + currentElapsed;
    return base;
  };

  // ── Render card ───────────────────────────────────────────────────────────

  const renderCard = ({ item }) => {
    const isActive = activeSession?.goalId === item.id;
    const secs     = getDisplaySeconds(item.id);

    return (
      <View
        style={[
          s.card,
          isActive && {
            borderColor:     item.color,
            borderWidth:     2,
            backgroundColor: item.color + '18',
            elevation:       10,
            shadowColor:     item.color,
            shadowOffset:    { width: 0, height: 0 },
            shadowOpacity:   0.45,
            shadowRadius:    14,
          },
        ]}
      >
        {/* Left side */}
        <View style={s.cardLeft}>
          <View style={[s.dot, { backgroundColor: item.color }]} />
          <View>
            <Text style={s.cardName}>{item.name}</Text>
            <Text
              style={[s.cardTimer, isActive && { color: item.color }]}
            >
              {formatHMS(secs)}
            </Text>
          </View>
        </View>

        {/* Action button */}
        <TouchableOpacity
          style={[
            s.actionBtn,
            isActive
              ? { backgroundColor: item.color }
              : { backgroundColor: '#1e1e1e', borderColor: item.color + '55', borderWidth: 1 },
          ]}
          onPress={() => (isActive ? stopGoal() : startGoal(item.id))}
          activeOpacity={0.8}
        >
          <Text
            style={[
              s.actionBtnText,
              isActive ? { color: '#0a1a0a' } : { color: item.color },
            ]}
          >
            {isActive ? '■  Stop' : '▶  Start'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Date header ───────────────────────────────────────────────────────────

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  });
  const totalStr = formatHMS(totalTrackedToday());

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Today</Text>
          <Text style={s.dateText}>{dateStr}</Text>
        </View>
        <View style={s.totalBadge}>
          <Text style={s.totalLabel}>TRACKED</Text>
          <Text style={s.totalValue}>{totalStr}</Text>
        </View>
      </View>

      {/* ── Cards ── */}
      {goals.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No goals found.</Text>
          <Text style={s.emptyHint}>Restart the app to set them up.</Text>
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },

  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    paddingHorizontal: 22,
    paddingTop:      18,
    paddingBottom:   10,
  },
  title:     { fontSize: 32, fontWeight: '800', color: '#f0f0f0', letterSpacing: -1 },
  dateText:  { fontSize: 13, color: '#444', marginTop: 2 },

  totalBadge: { alignItems: 'flex-end' },
  totalLabel: { fontSize: 10, fontWeight: '700', color: '#3a3a3a', letterSpacing: 1.5 },
  totalValue: { fontSize: 22, fontWeight: '700', color: '#555', letterSpacing: 1, marginTop: 2 },

  list:  { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  card: {
    backgroundColor: '#1a1a1a',
    borderRadius:    20,
    padding:         18,
    marginBottom:    12,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    borderWidth:     2,
    borderColor:     'transparent',
  },
  cardLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot:       { width: 10, height: 10, borderRadius: 5, marginRight: 14 },
  cardName:  { color: '#f0f0f0', fontSize: 16, fontWeight: '700', marginBottom: 5 },
  cardTimer: {
    color:        '#3a3a3a',
    fontSize:     26,
    fontWeight:   '700',
    letterSpacing: 1,
    fontVariant:  ['tabular-nums'],
  },

  actionBtn: {
    paddingHorizontal: 18,
    paddingVertical:   11,
    borderRadius:      12,
    minWidth:          95,
    alignItems:        'center',
  },
  actionBtnText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#444', fontSize: 18, fontWeight: '600' },
  emptyHint: { color: '#333', fontSize: 13, marginTop: 8 },
});
