import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  getTrackingSnapshot,
  startGoal,
  stopGoal,
} from './trackingService';
import { getTodayStart } from './storage';

export const notificationId = 'timetracker-active-goal-notification';

const CHANNEL_ID = 'tracker-channel';
const CATEGORY_ID = 'tracker-controls';
const NOTIFICATION_ACTION_TASK = 'tracker-notification-actions';
const NOTIFICATION_REFRESH_TASK = 'tracker-notification-refresh';
const NOTIFICATION_STATE_KEY = '@tt_notification_state';
const LAST_ACTION_KEY = '@tt_last_notification_action';
const ACTION_DEDUPE_MS = 800;

const ACTIONS = {
  PREVIOUS: 'tracker_previous_goal',
  STOP: 'tracker_stop',
  RESUME: 'tracker_resume',
  NEXT: 'tracker_next_goal',
};

let ticker = null;
let appStateSubscription = null;
let responseSubscription = null;
let registered = false;
let lastHandledAction = null;
let notificationSetupPromise = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const pad = value => String(Math.max(0, value)).padStart(2, '0');

function formatHMS(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function getActiveElapsedSeconds(activeSession) {
  if (!activeSession?.startTime) return 0;
  return Math.floor((Date.now() - activeSession.startTime) / 1000);
}

function getActiveElapsedTodaySeconds(activeSession) {
  if (!activeSession?.startTime) return 0;
  return Math.floor((Date.now() - Math.max(activeSession.startTime, getTodayStart())) / 1000);
}

function getSessionDurationSeconds(session) {
  if (!session) return 0;
  if (typeof session.duration === 'number') return session.duration;
  if (session.endTime && session.startTime) {
    return Math.floor((session.endTime - session.startTime) / 1000);
  }
  return 0;
}

function getLastCompletedSession(sessions) {
  return [...sessions]
    .filter(session => session.endTime)
    .sort((a, b) => b.endTime - a.endTime)[0] || null;
}

function getGoalName(goals, goalId) {
  return goals.find(goal => goal.id === goalId)?.name || 'LifeFlow';
}

function getGoalTodaySeconds(sessions, goalId, activeSession = null) {
  const todayStart = getTodayStart();
  let totalSeconds = 0;

  sessions.forEach(session => {
    if (session.goalId !== goalId || !session.endTime || session.endTime < todayStart) {
      return;
    }

    const startTime = Math.max(session.startTime, todayStart);
    totalSeconds += Math.floor((session.endTime - startTime) / 1000);
  });

  if (activeSession?.goalId === goalId) {
    totalSeconds += getActiveElapsedTodaySeconds(activeSession);
  }

  return Math.max(0, totalSeconds);
}

function formatDayPercent(seconds) {
  const percent = (Math.max(0, seconds) / 86400) * 100;
  if (percent > 0 && percent < 0.1) return '<0.1%';
  return `${percent.toFixed(1)}%`;
}

function formatNotificationBody(displayState) {
  const todaySeconds = displayState.todaySeconds ?? displayState.elapsedSeconds ?? 0;
  return `Today: ${formatHMS(todaySeconds)} - ${formatDayPercent(todaySeconds)} of day`;
}

function buildDisplayState(snapshot, fallbackState = null) {
  if (snapshot.activeSession) {
    const goalId = snapshot.activeSession.goalId;
    const todaySeconds = getGoalTodaySeconds(snapshot.sessions, goalId, snapshot.activeSession);

    return {
      goalId,
      goalName: getGoalName(snapshot.goals, goalId),
      elapsedSeconds: getActiveElapsedSeconds(snapshot.activeSession),
      todaySeconds,
      dayPercent: formatDayPercent(todaySeconds),
      isRunning: true,
      updatedAt: Date.now(),
    };
  }

  const lastSession = getLastCompletedSession(snapshot.sessions);
  if (lastSession) {
    const todaySeconds = getGoalTodaySeconds(snapshot.sessions, lastSession.goalId);

    return {
      goalId: lastSession.goalId,
      goalName: getGoalName(snapshot.goals, lastSession.goalId),
      elapsedSeconds: getSessionDurationSeconds(lastSession),
      todaySeconds,
      dayPercent: formatDayPercent(todaySeconds),
      isRunning: false,
      updatedAt: Date.now(),
    };
  }

  return fallbackState;
}

async function getSavedDisplayState() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveDisplayState(state) {
  if (!state) return;
  await AsyncStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state));
}

async function ensureNotificationSetup() {
  if (Platform.OS !== 'android') return false;

  if (!notificationSetupPromise) {
    notificationSetupPromise = (async () => {
      const existingChannel = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
      if (
        existingChannel &&
        existingChannel.importance < Notifications.AndroidImportance.HIGH
      ) {
        await Notifications.deleteNotificationChannelAsync(CHANNEL_ID);
      }

      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Goal timer',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: false,
        sound: null,
      });

      await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
        {
          identifier: ACTIONS.PREVIOUS,
          buttonTitle: 'Previous Goal',
          options: { opensAppToForeground: false },
        },
        {
          identifier: ACTIONS.STOP,
          buttonTitle: 'Stop',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
        {
          identifier: ACTIONS.RESUME,
          buttonTitle: 'Resume',
          options: { opensAppToForeground: false },
        },
        {
          identifier: ACTIONS.NEXT,
          buttonTitle: 'Next Goal',
          options: { opensAppToForeground: false },
        },
      ]);

      const current = await Notifications.getPermissionsAsync();
      const finalStatus = current.granted
        ? current
        : await Notifications.requestPermissionsAsync();

      return finalStatus.granted;
    })();
  }

  return notificationSetupPromise;
}

async function shouldHandleAction(actionIdentifier) {
  const now = Date.now();

  if (
    lastHandledAction?.id === actionIdentifier &&
    now - lastHandledAction.handledAt < ACTION_DEDUPE_MS
  ) {
    return false;
  }

  lastHandledAction = { id: actionIdentifier, handledAt: now };

  try {
    const raw = await AsyncStorage.getItem(LAST_ACTION_KEY);
    const stored = raw ? JSON.parse(raw) : null;

    if (
      stored?.id === actionIdentifier &&
      now - stored.handledAt < ACTION_DEDUPE_MS
    ) {
      return false;
    }

    await AsyncStorage.setItem(
      LAST_ACTION_KEY,
      JSON.stringify({ id: actionIdentifier, handledAt: now })
    );
  } catch {
    // The in-memory guard still handles the normal foreground/background path.
  }

  return true;
}

async function updateNotification(displayState) {
  if (!displayState) return null;

  const canNotify = await ensureNotificationSetup();
  if (!canNotify) return null;

  await saveDisplayState(displayState);

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: displayState.goalName,
      body: formatNotificationBody(displayState),
      data: {
        type: 'tracker',
        goalId: displayState.goalId,
        isRunning: displayState.isRunning,
        todaySeconds: displayState.todaySeconds,
        dayPercent: displayState.dayPercent,
      },
      categoryIdentifier: CATEGORY_ID,
      autoDismiss: false,
      sticky: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#4ade80',
    },
    trigger: { channelId: CHANNEL_ID },
  });

  if (displayState.isRunning) {
    startNotificationTicker();
  } else {
    stopNotificationTicker();
  }

  return displayState;
}

export async function showNotification(snapshot) {
  if (Platform.OS !== 'android') return null;

  try {
    const currentSnapshot = snapshot || await getTrackingSnapshot();
    const fallbackState = await getSavedDisplayState();
    const displayState = buildDisplayState(currentSnapshot, fallbackState);
    return updateNotification(displayState);
  } catch (error) {
    console.warn('Unable to show tracker notification', error);
    return null;
  }
}

export async function dismissNotification() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Unable to dismiss tracker notification', error);
  }
}

function getBaseGoalId(snapshot, savedState) {
  if (snapshot.activeSession?.goalId) return snapshot.activeSession.goalId;
  if (savedState?.goalId) return savedState.goalId;
  return getLastCompletedSession(snapshot.sessions)?.goalId || null;
}

async function startRelativeGoal(direction) {
  const snapshot = await getTrackingSnapshot();
  if (snapshot.goals.length === 0) {
    await showNotification(snapshot);
    return snapshot;
  }

  const savedState = await getSavedDisplayState();
  const baseGoalId = getBaseGoalId(snapshot, savedState);
  const baseIndex = snapshot.goals.findIndex(goal => goal.id === baseGoalId);
  const currentIndex = baseIndex >= 0 ? baseIndex : 0;
  const nextIndex = direction === 'next'
    ? (currentIndex + 1) % snapshot.goals.length
    : (currentIndex - 1 + snapshot.goals.length) % snapshot.goals.length;

  const updatedSnapshot = await startGoal(snapshot.goals[nextIndex].id);
  await showNotification(updatedSnapshot);
  return updatedSnapshot;
}

async function resumeGoal() {
  const snapshot = await getTrackingSnapshot();
  if (snapshot.activeSession) {
    await showNotification(snapshot);
    return snapshot;
  }

  if (snapshot.goals.length === 0) {
    await showNotification(snapshot);
    return snapshot;
  }

  const savedState = await getSavedDisplayState();
  const lastSession = getLastCompletedSession(snapshot.sessions);
  const goalId = savedState?.goalId || lastSession?.goalId || snapshot.goals[0].id;
  const goalExists = snapshot.goals.some(goal => goal.id === goalId);
  const updatedSnapshot = await startGoal(goalExists ? goalId : snapshot.goals[0].id);

  await showNotification(updatedSnapshot);
  return updatedSnapshot;
}

export async function handleNotificationAction(actionIdentifier) {
  if (!Object.values(ACTIONS).includes(actionIdentifier)) return;
  if (!(await shouldHandleAction(actionIdentifier))) return;

  if (actionIdentifier === ACTIONS.PREVIOUS) {
    await startRelativeGoal('previous');
    return;
  }

  if (actionIdentifier === ACTIONS.NEXT) {
    await startRelativeGoal('next');
    return;
  }

  if (actionIdentifier === ACTIONS.RESUME) {
    await resumeGoal();
    return;
  }

  if (actionIdentifier === ACTIONS.STOP) {
    const snapshot = await stopGoal();
    await showNotification(snapshot);
  }
}

function startNotificationTicker() {
  if (ticker || Platform.OS !== 'android') return;

  ticker = setInterval(() => {
    showNotification();
  }, 1000);
}

function stopNotificationTicker() {
  if (!ticker) return;
  clearInterval(ticker);
  ticker = null;
}

if (!TaskManager.isTaskDefined(NOTIFICATION_ACTION_TASK)) {
  TaskManager.defineTask(NOTIFICATION_ACTION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('Tracker notification action task failed', error);
      return;
    }

    if (data && 'actionIdentifier' in data) {
      await handleNotificationAction(data.actionIdentifier);
    }
  });
}

if (!TaskManager.isTaskDefined(NOTIFICATION_REFRESH_TASK)) {
  TaskManager.defineTask(NOTIFICATION_REFRESH_TASK, async () => {
    try {
      await showNotification();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerNotificationHandlers() {
  if (Platform.OS !== 'android' || registered) return;
  registered = true;

  await ensureNotificationSetup();

  Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK).catch(error => {
    console.warn('Unable to register tracker notification action task', error);
  });

  BackgroundFetch.registerTaskAsync(NOTIFICATION_REFRESH_TASK, {
    minimumInterval: 60,
    stopOnTerminate: false,
    startOnBoot: true,
  }).catch(error => {
    console.warn('Unable to register tracker notification refresh task', error);
  });

  if (!responseSubscription) {
    responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationAction(response.actionIdentifier);
    });
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        showNotification();
      }
    });
  }

  await showNotification();
}
