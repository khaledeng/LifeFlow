import {
  getActiveSession as getStoredActiveSession,
  getGoals,
  getSessions,
  saveActiveSession,
  saveSessions,
} from './storage';

const listeners = new Set();
let mutationQueue = Promise.resolve();

function buildFinishedSession(active, endTime = Date.now()) {
  return {
    id: `${endTime}_${active.goalId}`,
    goalId: active.goalId,
    startTime: active.startTime,
    endTime,
    duration: Math.floor((endTime - active.startTime) / 1000),
  };
}

function buildSnapshot(goals, sessions, activeSession) {
  const activeGoal = activeSession
    ? goals.find(goal => goal.id === activeSession.goalId) || null
    : null;

  return {
    goals,
    sessions,
    activeSession,
    activeGoal,
  };
}

async function loadSnapshot() {
  const [goals, sessions, activeSession] = await Promise.all([
    getGoals(),
    getSessions(),
    getStoredActiveSession(),
  ]);

  return buildSnapshot(goals, sessions, activeSession);
}

async function notifyTrackingListeners(snapshot) {
  await Promise.all(
    [...listeners].map(listener =>
      Promise.resolve(listener(snapshot)).catch(error => {
        console.warn('Tracking listener failed', error);
      })
    )
  );
}

async function runMutation(operation) {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.catch(() => {});
  return run;
}

async function startGoalFromSnapshot(snapshot, goalId) {
  const targetGoal = snapshot.goals.find(goal => goal.id === goalId);
  if (!targetGoal) return snapshot;

  let updatedSessions = [...snapshot.sessions];

  const activeSession = {
    goalId,
    startTime: Date.now(),
  };

  // Write new activeSession first. If we crash after this but before saveSessions,
  // the old session is orphaned (no endTime) rather than duplicated.
  await saveActiveSession(activeSession);

  if (snapshot.activeSession) {
    updatedSessions = [
      ...updatedSessions,
      buildFinishedSession(snapshot.activeSession),
    ];
    await saveSessions(updatedSessions);
  }

  return buildSnapshot(snapshot.goals, updatedSessions, activeSession);
}

export function subscribeTrackingChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function getTrackingSnapshot() {
  return loadSnapshot();
}

export async function getActiveSession() {
  return getStoredActiveSession();
}

export async function startGoal(goalId) {
  return runMutation(async () => {
    const snapshot = await loadSnapshot();
    const updatedSnapshot = await startGoalFromSnapshot(snapshot, goalId);
    await notifyTrackingListeners(updatedSnapshot);
    return updatedSnapshot;
  });
}

export async function stopGoal() {
  return runMutation(async () => {
    const snapshot = await loadSnapshot();

    if (!snapshot.activeSession) {
      await notifyTrackingListeners(snapshot);
      return snapshot;
    }

    const updatedSessions = [
      ...snapshot.sessions,
      buildFinishedSession(snapshot.activeSession),
    ];

    await saveSessions(updatedSessions);
    await saveActiveSession(null);

    const updatedSnapshot = buildSnapshot(snapshot.goals, updatedSessions, null);
    await notifyTrackingListeners(updatedSnapshot);
    return updatedSnapshot;
  });
}

export async function switchToNextGoal() {
  return runMutation(async () => {
    const snapshot = await loadSnapshot();
    if (snapshot.goals.length === 0) {
      await notifyTrackingListeners(snapshot);
      return snapshot;
    }

    const currentIndex = snapshot.activeSession
      ? snapshot.goals.findIndex(goal => goal.id === snapshot.activeSession.goalId)
      : -1;
    const nextIndex = currentIndex >= 0
      ? (currentIndex + 1) % snapshot.goals.length
      : 0;

    const updatedSnapshot = await startGoalFromSnapshot(snapshot, snapshot.goals[nextIndex].id);
    await notifyTrackingListeners(updatedSnapshot);
    return updatedSnapshot;
  });
}

export async function switchToPrevGoal() {
  return runMutation(async () => {
    const snapshot = await loadSnapshot();
    if (snapshot.goals.length === 0) {
      await notifyTrackingListeners(snapshot);
      return snapshot;
    }

    const currentIndex = snapshot.activeSession
      ? snapshot.goals.findIndex(goal => goal.id === snapshot.activeSession.goalId)
      : -1;
    const prevIndex = currentIndex >= 0
      ? (currentIndex - 1 + snapshot.goals.length) % snapshot.goals.length
      : snapshot.goals.length - 1;

    const updatedSnapshot = await startGoalFromSnapshot(snapshot, snapshot.goals[prevIndex].id);
    await notifyTrackingListeners(updatedSnapshot);
    return updatedSnapshot;
  });
}
