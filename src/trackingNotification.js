import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  getTrackingSnapshot,
  stopGoal,
  subscribeTrackingChanges,
  switchToNextGoal,
  switchToPrevGoal,
} from './trackingService';

export const TRACKING_NOTIFICATION_ACTIONS = {
  PREVIOUS: 'lifeflow_tracking_previous',
  STOP: 'lifeflow_tracking_stop',
  NEXT: 'lifeflow_tracking_next',
};

const CHANNEL_ID = 'active-tracking';
const CATEGORY_ID = 'lifeflow_tracking_controls';
const ACTIVE_NOTIFICATION_ID = 'lifeflow-active-tracking-session';
const BACKGROUND_TASK_NAME = 'lifeflow-tracking-notification-actions';
const LAST_ACTION_KEY = '@tt_last_notification_action';
const ACTION_DEDUPE_MS = 800;

let notificationListenerSubscription = null;
let lastHandledAction = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureTrackingActionsRegistered() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: TRACKING_NOTIFICATION_ACTIONS.PREVIOUS,
      buttonTitle: 'Previous Goal',
      options: { opensAppToForeground: false },
    },
    {
      identifier: TRACKING_NOTIFICATION_ACTIONS.STOP,
      buttonTitle: 'Stop',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
    {
      identifier: TRACKING_NOTIFICATION_ACTIONS.NEXT,
      buttonTitle: 'Next Goal',
      options: { opensAppToForeground: false },
    },
  ]);
}

async function ensureTrackingNotificationsReady() {
  if (Platform.OS !== 'android') return false;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Active tracking',
    importance: Notifications.AndroidImportance.LOW,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
    sound: null,
  });
  await ensureTrackingActionsRegistered();

  const current = await Notifications.getPermissionsAsync();
  const finalStatus = current.granted
    ? current
    : await Notifications.requestPermissionsAsync();

  return finalStatus.granted;
}

async function markActionHandled(actionIdentifier) {
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
    // The in-memory guard still protects the normal foreground/background path.
  }

  return true;
}

export async function showActiveTrackingNotification(goalName, goalId) {
  if (Platform.OS !== 'android') return;

  try {
    const canNotify = await ensureTrackingNotificationsReady();
    if (!canNotify) return;

    await Notifications.cancelScheduledNotificationAsync(ACTIVE_NOTIFICATION_ID).catch(() => {});
    await Notifications.dismissNotificationAsync(ACTIVE_NOTIFICATION_ID).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: ACTIVE_NOTIFICATION_ID,
      content: {
        title: 'LifeFlow is tracking',
        body: goalName ? `Active session: ${goalName}` : 'An active session is running.',
        data: {
          type: 'active-tracking-session',
          goalId,
        },
        categoryIdentifier: CATEGORY_ID,
        autoDismiss: false,
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
        color: '#4ade80',
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (error) {
    console.warn('Unable to show active tracking notification', error);
  }
}

export async function hideActiveTrackingNotification() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(ACTIVE_NOTIFICATION_ID);
    await Notifications.dismissNotificationAsync(ACTIVE_NOTIFICATION_ID);
  } catch (error) {
    console.warn('Unable to hide active tracking notification', error);
  }
}

export async function syncActiveTrackingNotification(snapshot) {
  if (snapshot.activeSession) {
    await showActiveTrackingNotification(
      snapshot.activeGoal?.name,
      snapshot.activeSession.goalId
    );
  } else {
    await hideActiveTrackingNotification();
  }
}

export async function handleTrackingNotificationAction(actionIdentifier) {
  if (!Object.values(TRACKING_NOTIFICATION_ACTIONS).includes(actionIdentifier)) {
    return;
  }

  const shouldHandle = await markActionHandled(actionIdentifier);
  if (!shouldHandle) return;

  if (actionIdentifier === TRACKING_NOTIFICATION_ACTIONS.PREVIOUS) {
    await switchToPrevGoal();
    return;
  }

  if (actionIdentifier === TRACKING_NOTIFICATION_ACTIONS.NEXT) {
    await switchToNextGoal();
    return;
  }

  if (actionIdentifier === TRACKING_NOTIFICATION_ACTIONS.STOP) {
    await stopGoal();
  }
}

if (!TaskManager.isTaskDefined(BACKGROUND_TASK_NAME)) {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('Tracking notification task failed', error);
      return;
    }

    if (data && 'actionIdentifier' in data) {
      await handleTrackingNotificationAction(data.actionIdentifier);
    }
  });
}

subscribeTrackingChanges(syncActiveTrackingNotification);

export function registerTrackingNotificationHandlers() {
  if (Platform.OS !== 'android') return;

  ensureTrackingActionsRegistered().catch(error => {
    console.warn('Unable to register tracking notification actions', error);
  });

  Notifications.registerTaskAsync(BACKGROUND_TASK_NAME).catch(error => {
    console.warn('Unable to register tracking notification background task', error);
  });

  if (!notificationListenerSubscription) {
    notificationListenerSubscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        handleTrackingNotificationAction(response.actionIdentifier);
      }
    );
  }

  getTrackingSnapshot()
    .then(syncActiveTrackingNotification)
    .catch(error => {
      console.warn('Unable to restore tracking notification', error);
    });
}

registerTrackingNotificationHandlers();
