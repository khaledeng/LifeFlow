import { getGoals, getSessions, saveGoals, saveSessions, saveSetupDone } from './storage';

const DEMO_SESSION_PREFIX = 'demo_history_seed_';

const DEFAULT_GOALS = [
  { id: '1', name: 'Work', color: '#4ade80' },
  { id: '2', name: 'Sleep', color: '#818cf8' },
  { id: '3', name: 'Entertainment', color: '#60a5fa' },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dayMs = 24 * 60 * 60 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function findDefaultGoals(goals) {
  return DEFAULT_GOALS.map(defaultGoal => {
    const byId = goals.find(goal => goal.id === defaultGoal.id);
    if (byId?.name === defaultGoal.name) return byId;
    return goals.find(goal => goal.name === defaultGoal.name) || null;
  });
}

async function ensureDefaultGoals() {
  const goals = await getGoals();

  if (goals.length === 0) {
    await saveGoals(DEFAULT_GOALS);
    await saveSetupDone(true);
    return DEFAULT_GOALS;
  }

  const defaultGoals = findDefaultGoals(goals);
  if (defaultGoals.some(goal => !goal)) {
    throw new Error('Seed data requires the default goals: Work, Sleep, and Entertainment.');
  }

  return defaultGoals;
}

function addSession(sessions, goalId, dayStart, startHour, durationMinutes, suffix) {
  const duration = Math.round(durationMinutes * 60);
  if (duration <= 0) return;

  const startTime = dayStart + Math.round(startHour * 60 * 60 * 1000);
  if (startTime >= Date.now()) return;

  const endTime = Math.min(startTime + duration * 1000, Date.now());
  const safeDuration = Math.floor((endTime - startTime) / 1000);
  if (safeDuration <= 0) return;

  sessions.push({
    id: `${DEMO_SESSION_PREFIX}${dayStart}_${goalId}_${suffix}`,
    goalId,
    startTime,
    endTime,
    duration: safeDuration,
  });
}

function generateDemoSessions(defaultGoals) {
  const [workGoal, sleepGoal, entertainmentGoal] = defaultGoals;
  const todayStart = startOfToday();
  const firstDayStart = todayStart - 364 * dayMs;
  const sessions = [];
  const random = mulberry32(20260511);

  for (let dayIndex = 0; dayIndex < 365; dayIndex += 1) {
    const dayStart = firstDayStart + dayIndex * dayMs;
    const d = new Date(dayStart);
    const weekday = d.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const monthWave = Math.sin((dayIndex / 365) * Math.PI * 2);
    const quarterWave = Math.sin((dayIndex / 91) * Math.PI * 2);
    const weeklyWave = Math.sin((dayIndex / 7) * Math.PI * 2);
    const jitter = () => (random() - 0.5);

    const sleepMinutes = clamp(
      (isWeekend ? 500 : 455) + monthWave * 22 + weeklyWave * 18 + jitter() * 34,
      365,
      560,
    );
    addSession(sessions, sleepGoal.id, dayStart, isWeekend ? 0.35 : 0.15, sleepMinutes, 'sleep');

    if (!isWeekend) {
      const mondayBoost = weekday === 1 ? 34 : 0;
      const fridayDip = weekday === 5 ? -52 : 0;
      const summerDip = d.getMonth() >= 5 && d.getMonth() <= 7 ? -42 : 0;
      const workMinutes = clamp(
        385 + monthWave * 44 + quarterWave * 28 + mondayBoost + fridayDip + summerDip + jitter() * 70,
        210,
        540,
      );
      addSession(sessions, workGoal.id, dayStart, 9 + jitter() * 0.35, workMinutes, 'work-main');

      const hasFocusBlock = random() > 0.42;
      if (hasFocusBlock) {
        const focusMinutes = clamp(58 + quarterWave * 12 + jitter() * 26, 25, 105);
        addSession(sessions, workGoal.id, dayStart, 19 + jitter() * 0.4, focusMinutes, 'work-focus');
      }
    } else if (random() > 0.7) {
      const weekendWorkMinutes = clamp(52 + jitter() * 46, 20, 115);
      addSession(sessions, workGoal.id, dayStart, 11 + jitter() * 0.8, weekendWorkMinutes, 'work-weekend');
    }

    const entertainmentBase = isWeekend ? 170 : 92;
    const entertainmentMinutes = clamp(
      entertainmentBase + monthWave * 26 - quarterWave * 18 + jitter() * (isWeekend ? 96 : 58),
      25,
      isWeekend ? 320 : 190,
    );
    addSession(
      sessions,
      entertainmentGoal.id,
      dayStart,
      isWeekend ? 20 + jitter() * 1.5 : 21 + jitter(),
      entertainmentMinutes,
      'entertainment',
    );

    if (random() > (isWeekend ? 0.72 : 0.86)) {
      const extraMinutes = clamp(38 + jitter() * 36, 15, 85);
      addSession(sessions, entertainmentGoal.id, dayStart, 15 + jitter(), extraMinutes, 'entertainment-extra');
    }
  }

  return sessions;
}

export function isDemoSeedSession(session) {
  return typeof session?.id === 'string' && session.id.startsWith(DEMO_SESSION_PREFIX);
}

export async function seedHistoricalDemoData() {
  if (!__DEV__) {
    throw new Error('Demo history seeding is available only in development builds.');
  }

  const defaultGoals = await ensureDefaultGoals();
  const existingSessions = await getSessions();
  const userSessions = existingSessions.filter(session => !isDemoSeedSession(session));
  const demoSessions = generateDemoSessions(defaultGoals);

  await saveSessions([...userSessions, ...demoSessions].sort((a, b) => a.startTime - b.startTime));

  return {
    added: demoSessions.length,
    firstDate: demoSessions[0]?.startTime || null,
    lastDate: demoSessions[demoSessions.length - 1]?.startTime || null,
  };
}

export async function removeHistoricalDemoData() {
  if (!__DEV__) {
    throw new Error('Demo history removal is available only in development builds.');
  }

  const existingSessions = await getSessions();
  const keptSessions = existingSessions.filter(session => !isDemoSeedSession(session));
  const removed = existingSessions.length - keptSessions.length;

  await saveSessions(keptSessions);

  return { removed };
}
