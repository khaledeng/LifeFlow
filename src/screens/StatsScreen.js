import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,

} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line, Text as SvgText, Circle ,Rect} from 'react-native-svg';
import { getActiveSession, getGoals, getSessions, saveSessions } from '../storage';
const SCREEN_W = Dimensions.get('window').width;
const TABS = ['Day', 'Week', 'Month', 'Year'];
const CHART_HEIGHT = 200;
const CHART_VISIBLE_PERIODS = {
  Day: 10,
  Week: 14,
  Month: 6,
  Year: 5,
};
const CHART_POINT_WIDTH = {
  Day: 55,
  Week: 95,
  Month: 75,
  Year: 90,
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function fmtDuration(secs) {
  if (secs <= 0) return '0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function fmtPct(n) {
  return n < 0.1 ? '< 0.1%' : `${n.toFixed(1)}%`;
}

function getPeriodInfo(tab) {
  const now = new Date();
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  switch (tab) {
    case 'Day':
      return { start: from.getTime(), end: now.getTime(), totalSeconds: 86400, label: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) };
    case 'Week': {
      from.setDate(from.getDate() - from.getDay());
      return { start: from.getTime(), end: now.getTime(), totalSeconds: 7 * 86400, label: `Week of ${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` };
    }
    case 'Month': {
      from.setDate(1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return { start: from.getTime(), end: now.getTime(), totalSeconds: daysInMonth * 86400, label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) };
    }
    case 'Year': {
      from.setMonth(0, 1);
      const y = now.getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return { start: from.getTime(), end: now.getTime(), totalSeconds: (isLeap ? 366 : 365) * 86400, label: String(y) };
    }
    default:
      return { start: 0, end: Date.now(), totalSeconds: 86400, label: '' };
  }
}

function getVisiblePeriodCount(tab) {
  return CHART_VISIBLE_PERIODS[tab] || CHART_VISIBLE_PERIODS.Day;
}

function getPointWidth(tab, viewportWidth) {
  const minWidth = CHART_POINT_WIDTH[tab] || CHART_POINT_WIDTH.Day;
  return Math.max(minWidth, viewportWidth / getVisiblePeriodCount(tab));
}

function getFuturePeriodCount(tab) {
  return Math.floor(getVisiblePeriodCount(tab) / 2);
}

function getPastPaddingPeriodCount(tab) {
  return Math.floor(getVisiblePeriodCount(tab) / 2);
}

function startOfPeriod(tab, time) {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);

  if (tab === 'Day') {
    return d.getTime();
  }

  if (tab === 'Week') {
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
  }

  if (tab === 'Month') {
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  return new Date(d.getFullYear(), 0, 1).getTime();
}

function addPeriods(tab, startMs, amount) {
  const d = new Date(startMs);

  if (tab === 'Day') {
    d.setDate(d.getDate() + amount);
    return d.getTime();
  }

  if (tab === 'Week') {
    d.setDate(d.getDate() + amount * 7);
    return d.getTime();
  }

  if (tab === 'Month') {
    return new Date(d.getFullYear(), d.getMonth() + amount, 1).getTime();
  }

  return new Date(d.getFullYear() + amount, 0, 1).getTime();
}

function countPeriods(tab, firstStart, latestStart) {
  let count = 0;
  let cursor = firstStart;

  while (cursor <= latestStart) {
    count += 1;
    cursor = addPeriods(tab, cursor, 1);
  }

  return Math.max(1, count);
}

function getEarliestSessionTime(sessions) {
  const times = sessions
    .flatMap(sess => [sess.startTime, sess.endTime])
    .filter(time => typeof time === 'number' && Number.isFinite(time));

  return times.length ? Math.min(...times) : Date.now();
}

function buildHistoricalRange(tab, sessions) {
  const nowMs = Date.now();
  const firstSessionStart = startOfPeriod(tab, getEarliestSessionTime(sessions));
  const currentStart = startOfPeriod(tab, nowMs);
  const paddedStart = addPeriods(tab, currentStart, -getPastPaddingPeriodCount(tab));
  const firstStart = Math.min(firstSessionStart, paddedStart);
  const endStart = addPeriods(tab, currentStart, getFuturePeriodCount(tab));

  return {
    tab,
    start: firstStart,
    now: nowMs,
    currentIndex: countPeriods(tab, firstStart, currentStart) - 1,
    totalPeriods: countPeriods(tab, firstStart, endStart),
    visiblePeriods: getVisiblePeriodCount(tab),
  };
}

function buildPeriodPoint(tab, range, index) {
  const start = addPeriods(tab, range.start, index);
  const end = addPeriods(tab, start, 1);
  const d = new Date(start);

  if (tab === 'Day') {
    return { index, label: d.getDate().toString(), start, end: Math.min(end, range.now) };
  }

  if (tab === 'Week') {
    return {
      index,
      label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      start,
      end: Math.min(end, range.now),
    };
  }

  if (tab === 'Month') {
    return {
      index,
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      start,
      end: Math.min(end, range.now),
    };
  }

  return { index, label: String(d.getFullYear()), start, end: Math.min(end, range.now) };
}

function buildPoints(tab, range, startIndex, count) {
  const points = [];
  const safeStart = Math.max(0, startIndex);
  const safeEnd = Math.min(range.totalPeriods, safeStart + Math.max(1, count));

  for (let index = safeStart; index < safeEnd; index++) {
    points.push(buildPeriodPoint(tab, range, index));
  }

  return points;
}

function getChartWindow(tab, range, scrollX, viewportWidth) {
  if (!range || viewportWidth <= 0) {
    return { startIndex: 0, count: getVisiblePeriodCount(tab), left: 0, width: viewportWidth };
  }

  const visiblePeriods = range.visiblePeriods;
  const periodWidth = getPointWidth(tab, viewportWidth);
  const firstVisibleIndex = Math.floor(Math.max(0, scrollX) / periodWidth);
  const buffer = visiblePeriods;
  const startIndex = Math.max(0, firstVisibleIndex - buffer);
  const endIndex = Math.min(range.totalPeriods, firstVisibleIndex + visiblePeriods + buffer);
  const count = Math.max(1, endIndex - startIndex);

  return {
    startIndex,
    count,
    left: startIndex * periodWidth,
    width: Math.max(viewportWidth, count * periodWidth),
  };
}

function getChartContentWidth(range, viewportWidth) {
  if (!range || viewportWidth <= 0) return viewportWidth;
  const periodWidth = getPointWidth(range.tab, viewportWidth);
  return Math.max(viewportWidth, range.totalPeriods * periodWidth);
}

function getLatestChartOffset(range, viewportWidth) {
  return Math.max(0, getChartContentWidth(range, viewportWidth) - viewportWidth);
}

function getInitialChartOffset(range, viewportWidth) {
  if (!range || viewportWidth <= 0) return 0;

  const periodWidth = getPointWidth(range.tab, viewportWidth);
  const currentCenterX = range.currentIndex * periodWidth + periodWidth / 2;
  const maxOffset = getLatestChartOffset(range, viewportWidth);

  return clamp(currentCenterX - viewportWidth / 2, 0, maxOffset);
}

function buildChartData(tab, sessions, goals, range, startIndex = 0, count = getVisiblePeriodCount(tab)) {
  if (!range) {
    return { labels: [], datasets: [], goals, unit: 'm' };
  }

  const points = buildPoints(tab, range, startIndex, count);

  const rawDatasets = goals.map(goal => {
    const data = points.map(p => {
      if (p.start > range.now) return null;

      let total = 0;
      sessions.forEach(sess => {
        if (sess.goalId !== goal.id || !sess.endTime) return;
        if (sess.endTime <= p.start || sess.startTime >= p.end) return;
        // Manual sessions store ground-truth duration; use it directly,
        // same as loadStats does. Computing from timestamps clips the value
        // to the elapsed portion of the period window (critical for Day tab).
        if (sess.id?.startsWith('manual_')) {
          total += sess.duration ?? 0;
          return;
        }
        const cs = Math.max(sess.startTime, p.start);
        const ce = Math.min(sess.endTime, p.end);
        total += Math.floor((ce - cs) / 1000);
      });
      return total;
    });
    return { goal, data };
  });

  const realValues = rawDatasets
    .flatMap(ds => ds.data)
    .filter(value => typeof value === 'number');
  const maxSeconds = Math.max(0, ...realValues);
  const useMinutes = maxSeconds < 3600;
  const unit = useMinutes ? 'm' : 'h';
  const divisor = useMinutes ? 60 : 3600;

  const datasets = rawDatasets.map(({ goal, data }) => ({
    data: data.map(total => (
      total == null
        ? null
        : Math.max(0, Math.round((total / divisor) * 10) / 10)
    )),
    color: goal.color,
  }));

  return {
    labels: points.map(p => p.label),
    labelIndexes: points.map(p => p.index),
    datasets,
    goals,
    tab,
    unit,
  };
}

// ─── Lightweight SVG Line Chart (Linear, Work-only, neon glow) ───────────────

// ─── Tooltip + Interactive SVG Line Chart ────────────────────────────────────

function SvgLineChart({ data, width, height, onPointSelect, selectedPoint }) {
  const pad = { top: 14, right: 12, bottom: 42, left: 46 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  if (!data || !data.datasets.length) return null;

  const allValues = data.datasets
    .flatMap(ds => ds.data)
    .filter(value => typeof value === 'number');
  const rawMax = Math.max(...allValues, 0);

  // FIXED: smooth niceMax that never causes discrete rescale jumps
const niceMax = rawMax <= 0 ? 1 : (() => {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  const niceNorm = normalized <= 1 ? 1
    : normalized <= 2 ? 2
    : normalized <= 5 ? 5
    : 10;
  const computed = niceNorm * magnitude;
  // Always ensure niceMax is strictly above rawMax with breathing room
  return computed <= rawMax ? computed * 2 : computed;
})();

  const gridSteps = 5;
  const scaleX = (i) => pad.left + (i / Math.max(data.labels.length - 1, 1)) * chartW;
  const scaleY = (v) => pad.top + chartH - (Math.max(0, v) / niceMax) * chartH;

  // ── Tooltip dimensions ──────────────────────────────────────────────────────
  const TT_W = 130;
  const TT_H = 52;
  const TT_R = 8;
  const TT_PAD = 8;

  function getTooltipX(cx) {
    let tx = cx - TT_W / 2;
    if (tx < pad.left) tx = pad.left;
    if (tx + TT_W > width - pad.right) tx = width - pad.right - TT_W;
    return tx;
  }

  function getTooltipY(cy) {
    const above = cy - TT_H - 10;
    return above < 2 ? cy + 14 : above;
  }

  function fmtTooltip(val) {
    if (val <= 0) return '0m';
    if (data.unit === 'h') {
      const h = Math.floor(val);
      const m = Math.round((val - h) * 60);
      if (h > 0 && m > 0) return `${h}h ${m}m`;
      if (h > 0) return `${h}h`;
      return `${m}m`;
    }
    // unit === 'm'
    const totalM = Math.round(val);
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  return (
    <Svg width={width} height={height}>
      {/* Grid lines + Y labels */}
      {Array.from({ length: gridSteps + 1 }, (_, i) => {
        const y = pad.top + (i / gridSteps) * chartH;
        const val = ((gridSteps - i) / gridSteps) * niceMax;
        const label = val % 1 === 0 ? `${val}` : val.toFixed(1);
        return (
          <React.Fragment key={`grid-${i}`}>
            <Line
              x1={pad.left} y1={y}
              x2={width - pad.right} y2={y}
              stroke="#1e1e1e" strokeWidth={1} strokeDasharray="5,5"
            />
            <SvgText
              x={pad.left - 6} y={y + 4}
              fontSize={10} fill="#555" textAnchor="end">
              {label}{data.unit}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Data lines */}
      {data.datasets.map((ds, di) => {
        const pts = ds.data.map((v, i) => (
          v == null ? null : { x: scaleX(i), y: scaleY(v), v, i }
        ));
        const realPts = pts.filter(Boolean);
        if (!pts.length) return null;

        let d = '';
        let segmentOpen = false;
        pts.forEach((p) => {
          if (!p) {
            segmentOpen = false;
            return;
          }

          d += `${d ? ' ' : ''}${segmentOpen ? 'L' : 'M'} ${p.x},${p.y}`;
          segmentOpen = true;
        });

        if (!realPts.length) {
          return null;
        }

        return (
          <React.Fragment key={`ds-${di}`}>
            {/* Glow */}
            <Path d={d} fill="none" stroke={ds.color}
              strokeWidth={8} strokeOpacity={0.15}
              strokeLinecap="round" strokeLinejoin="round" />
            <Path d={d} fill="none" stroke={ds.color}
              strokeWidth={5} strokeOpacity={0.25}
              strokeLinecap="round" strokeLinejoin="round" />
            {/* Main line */}
            <Path d={d} fill="none" stroke={ds.color}
              strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round" />
            {/* Dots */}
            {realPts.map((p) => {
              const isSelected =
                selectedPoint?.dsIndex === di &&
                selectedPoint?.ptIndex === p.i;
              return (
                <React.Fragment key={`dot-${di}-${p.i}`}>
                  <Circle cx={p.x} cy={p.y} r={isSelected ? 12 : 8}
                    fill={ds.color} fillOpacity={isSelected ? 0.22 : 0.12} />
                  <Circle cx={p.x} cy={p.y} r={isSelected ? 7 : 5}
                    fill="#141414" stroke={ds.color}
                    strokeWidth={isSelected ? 3 : 2.5} />
                  <Circle cx={p.x} cy={p.y} r={isSelected ? 3.5 : 2.5}
                    fill={ds.color} />
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}

      {/* X labels */}
      {data.labels.map((label, i) => {
        const pointSpacing = chartW / Math.max(data.labels.length - 1, 1);
        const originalIndex = data.labelIndexes?.[i] ?? i;
        if (data.tab === 'Week' && pointSpacing < 105 && originalIndex % 2 !== 0) {
          return null;
        }

        return (
          <SvgText key={`lbl-${i}`}
            x={scaleX(i)} y={height - 10}
            fontSize={10} fill="#555" textAnchor="middle">
            {label}
          </SvgText>
        );
      })}

      {/* Invisible touch zones — on top of everything */}
      {data.datasets.flatMap((ds, di) =>
        ds.data.map((v, i) => {
          if (v == null) return null;

          const cx = scaleX(i);
          const cy = scaleY(v);
          const ZONE = 22;
          return (
            <Rect
              key={`touch-${di}-${i}`}
              x={cx - ZONE} y={cy - ZONE}
              width={ZONE * 2} height={ZONE * 2}
              fill="rgba(0,0,0,0.01)"
              onPress={() => {
                const isAlreadySelected =
                  selectedPoint?.dsIndex === di &&
                  selectedPoint?.ptIndex === i;
                onPointSelect(
                  isAlreadySelected
                    ? null
                    : { dsIndex: di, ptIndex: i, cx, cy, value: v, label: data.labels[i] }
                );
              }}
            />
          );
        })
      )}

      {/* Tooltip */}
      {selectedPoint && (() => {
        const ds = data.datasets[selectedPoint.dsIndex];
        const goal = data.goals[selectedPoint.dsIndex];
        const tx = getTooltipX(selectedPoint.cx);
        const ty = getTooltipY(selectedPoint.cy);
        const timeStr = fmtTooltip(selectedPoint.value);
        const goalName = goal?.name ?? 'Unknown';

        return (
          <React.Fragment>
            {/* Shadow layer */}
            <Rect
              x={tx + 1} y={ty + 2}
              width={TT_W} height={TT_H}
              rx={TT_R} ry={TT_R}
              fill="#000" fillOpacity={0.35}
            />
            {/* Background */}
            <Rect
              x={tx} y={ty}
              width={TT_W} height={TT_H}
              rx={TT_R} ry={TT_R}
              fill="#1c1c1c"
              stroke={ds.color}
              strokeWidth={1.2}
              strokeOpacity={0.7}
            />
            {/* Color accent bar */}
            <Rect
              x={tx} y={ty}
              width={4} height={TT_H}
              rx={TT_R} ry={TT_R}
              fill={ds.color}
            />
            {/* Goal name */}
            <SvgText
              x={tx + TT_PAD + 8} y={ty + 19}
              fontSize={11} fill="#aaa"
              fontWeight="600">
              {goalName.length > 14 ? goalName.slice(0, 13) + '…' : goalName}
            </SvgText>
            {/* Time value */}
            <SvgText
              x={tx + TT_PAD + 8} y={ty + 37}
              fontSize={15} fill="#f0f0f0"
              fontWeight="800">
              {timeStr}
            </SvgText>
            {/* Period label */}
            <SvgText
              x={tx + TT_W - TT_PAD} y={ty + 37}
              fontSize={10} fill="#555"
              textAnchor="end">
              {selectedPoint.label}
            </SvgText>
          </React.Fragment>
        );
      })()}
    </Svg>
  );
}

function calcOverview(sessions) {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const weekStart = new Date(); weekStart.setDate(todayStart.getDate() - todayStart.getDay()); weekStart.setHours(0, 0, 0, 0);
  const weekStartMs = weekStart.getTime();
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthStartMs = monthStart.getTime();

  let today = 0, week = 0, month = 0, total = 0;

  sessions.forEach(sess => {
    if (!sess.endTime) return;
    const sessStart = sess.startTime;
    const sessEnd = Math.min(sess.endTime, now);
    if (sessEnd <= sessStart) return;

    const dur = Math.floor((sessEnd - sessStart) / 1000);
    total += dur;

    // Clamp to period start so cross-midnight/cross-week sessions are counted correctly
    if (sessEnd > monthStartMs) {
      month += Math.floor((sessEnd - Math.max(sessStart, monthStartMs)) / 1000);
    }
    if (sessEnd > weekStartMs) {
      week += Math.floor((sessEnd - Math.max(sessStart, weekStartMs)) / 1000);
    }
    if (sessEnd > todayStartMs) {
      today += Math.floor((sessEnd - Math.max(sessStart, todayStartMs)) / 1000);
    }
  });

  return { today, week, month, total };
}

function includeActiveSession(sessions, activeSession) {
  if (!activeSession) return sessions;

  const now = Date.now();
  return [
    ...sessions,
    {
      id: `active_${activeSession.goalId}`,
      goalId: activeSession.goalId,
      startTime: activeSession.startTime,
      endTime: now,
      duration: Math.floor((now - activeSession.startTime) / 1000),
    },
  ];
}

function EditTimeModal({ visible, goal, currentSeconds, maxSeconds, periodInfo, onSave, onClose }) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && goal) {
      setHours(String(Math.floor(currentSeconds / 3600)));
      setMinutes(String(Math.floor((currentSeconds % 3600) / 60)));
      setError('');
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }),
        Animated.timing(opacAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacAnim.setValue(0);
    }
  }, [visible, goal, currentSeconds, scaleAnim, opacAnim]);

  if (!goal) return null;

const previewSecs = (parseInt(hours || '0', 10) * 3600) + (parseInt(minutes || '0', 10) * 60);
  const hardMax = Math.min(maxSeconds, periodInfo.totalSeconds);
  const hardMaxH = Math.floor(hardMax / 3600);
  const hardMaxM = Math.floor((hardMax % 3600) / 60);
  const hardMaxStr = hardMaxM > 0 ? `${hardMaxH}h ${hardMaxM}m` : `${hardMaxH}h`;

  const handleSave = () => {
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    if (Number.isNaN(h) || Number.isNaN(m)) { setError('Enter valid numbers.'); return; }
    if (h < 0 || m < 0) { setError("Values can't be negative."); return; }
    if (m > 59) { setError('Minutes must be 0-59.'); return; }
    const total = h * 3600 + m * 60;
    // Cap against what this goal is actually allowed given other goals' usage.
    // maxSeconds = periodCapacity - sum(other goals). Never exceed period total either.
    const hardMax = Math.min(maxSeconds, periodInfo.totalSeconds);
    if (total > hardMax) {
      const capH = Math.floor(hardMax / 3600);
      const capM = Math.floor((hardMax % 3600) / 60);
      const capStr = capM > 0 ? `${capH}h ${capM}m` : `${capH}h`;
      setError(`Max for this goal is ${capStr} (other goals use the rest).`);
      return;
    }
    onSave(goal.id, total);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={m.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        style={m.centerer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View style={[m.card, { transform: [{ scale: scaleAnim }], opacity: opacAnim }]}>
          <View style={m.header}>
            <View style={[m.dot, { backgroundColor: goal.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={m.goalName}>{goal.name}</Text>
              <Text style={m.currentTxt}>Current: {fmtDuration(currentSeconds)}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={m.closeTxt}>x</Text>
            </TouchableOpacity>
          </View>

          <View style={m.divider} />
          <Text style={m.label}>SET NEW TOTAL TIME</Text>

          <View style={m.inputRow}>
            <View style={m.inputBlock}>
              <TextInput
                style={[m.input, { borderColor: goal.color + '60' }]} 
                value={hours}
                onChangeText={v => { setHours(v.replace(/[^0-9]/g, '')); setError(''); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#2e2e2e"
                maxLength={4}
                selectTextOnFocus
              />
              <Text style={m.unitLabel}>hours</Text>
            </View>

            <Text style={m.colon}>:</Text>

            <View style={m.inputBlock}>
              <TextInput
                style={[m.input, { borderColor: goal.color + '60' }]} 
                value={minutes}
                onChangeText={v => { setMinutes(v.replace(/[^0-9]/g, '')); setError(''); }}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#2e2e2e"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={m.unitLabel}>min</Text>
            </View>
          </View>

          <View style={[m.preview, { backgroundColor: goal.color + '12', borderColor: goal.color + '28' }]}>
            <Text style={[m.previewLabel, { color: goal.color + 'aa' }]}>NEW TOTAL</Text>
            <Text style={[m.previewValue, { color: goal.color }]}> {fmtDuration(previewSecs)}</Text>
          </View>

          {!!error && <Text style={m.error}>{error}</Text>}

          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, { backgroundColor: goal.color }]} 
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={m.saveTxt}>Save</Text>
            </TouchableOpacity>
          </View>

          <Text style={m.hint}>
            Max: {hardMaxStr} · Replaces all sessions for "{goal.name}" in this period.
          </Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function StatsScreen({ isActive = true }) {
  const [activeTab, setActiveTab] = useState('Day');
  const [stats, setStats] = useState([]);
  const [totalTracked, setTotalTracked] = useState(0);
  const [periodInfo, setPeriodInfo] = useState(getPeriodInfo('Day'));
  const [chartSource, setChartSource] = useState({ sessions: [], goals: [] });
  const [chartRange, setChartRange] = useState(null);
  const [chartScrollX, setChartScrollX] = useState(0);
  const [chartViewportWidth, setChartViewportWidth] = useState(SCREEN_W - 64);
  const [overview, setOverview] = useState({ today: 0, week: 0, month: 0, total: 0 });
  const [editGoal, setEditGoal] = useState(null);
  const [editSeconds, setEditSeconds] = useState(0);
  const [editMaxSeconds, setEditMaxSeconds] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChartPoint, setSelectedChartPoint] = useState(null);
  const chartScrollRef = useRef(null);
  const latestScrollKeyRef = useRef(null);

  const chartWindow = useMemo(
    () => getChartWindow(activeTab, chartRange, chartScrollX, chartViewportWidth),
    [activeTab, chartRange, chartScrollX, chartViewportWidth],
  );

  const chartContentWidth = useMemo(
    () => getChartContentWidth(chartRange, chartViewportWidth),
    [chartRange, chartViewportWidth],
  );

  const chartData = useMemo(
    () => buildChartData(
      activeTab,
      chartSource.sessions,
      chartSource.goals,
      chartRange,
      chartWindow.startIndex,
      chartWindow.count,
    ),
    [activeTab, chartSource, chartRange, chartWindow.startIndex, chartWindow.count],
  );


  useEffect(() => {
    if (!isActive) return undefined;

    loadStats(activeTab);
    const timer = setInterval(() => loadStats(activeTab), 1000);
    return () => clearInterval(timer);
  }, [isActive, activeTab]);

  useEffect(() => {
    setSelectedChartPoint(null);
  }, [activeTab, chartWindow.startIndex]);

  useEffect(() => {
    if (!chartRange || chartViewportWidth <= 0) return;

    const key = `${activeTab}:${chartRange.start}:${chartRange.totalPeriods}:${chartViewportWidth}`;
    if (latestScrollKeyRef.current === key) return;
    latestScrollKeyRef.current = key;

    const initialOffset = getInitialChartOffset(chartRange, chartViewportWidth);
    setChartScrollX(initialOffset);
    requestAnimationFrame(() => {
      chartScrollRef.current?.scrollTo({ x: initialOffset, animated: false });
    });
  }, [activeTab, chartRange, chartViewportWidth]);

  async function loadStats(tab) {
    const [goals, savedSessions, activeSession] = await Promise.all([
      getGoals(),
      getSessions(),
      getActiveSession(),
    ]);
    const sessions = includeActiveSession(savedSessions, activeSession);
    const info = getPeriodInfo(tab);
    setPeriodInfo(info);
    setOverview(calcOverview(sessions));
    setChartSource({ sessions, goals });
    setChartRange(buildHistoricalRange(tab, sessions));

    const sums = {};
    goals.forEach(g => { sums[g.id] = 0; });
    sessions.forEach(sess => {
      if (!sess.endTime) return;
      if (sess.endTime < info.start || sess.startTime > info.end) return;
      const cs = Math.max(sess.startTime, info.start);
      const ce = Math.min(sess.endTime, info.end);
      // For manual sessions (created by the edit-time feature), the stored
      // duration is the ground truth. Recomputing from (ce - cs) would clip
      // the duration to the elapsed portion of the current period, which is
      // wrong when the edit happens early in the day/week/month.
      // For all other sessions, derive duration from timestamps as before.
      const dur = sess.id?.startsWith('manual_')
        ? sess.duration
        : Math.floor((ce - cs) / 1000);
      if (sess.goalId in sums) sums[sess.goalId] += dur;
    });

    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    setTotalTracked(total);

    const rows = goals
      .map(g => ({ ...g, seconds: sums[g.id] || 0, pctOfTotal: info.totalSeconds > 0 ? ((sums[g.id] || 0) / info.totalSeconds) * 100 : 0 }))
      .sort((a, b) => b.seconds - a.seconds);
    setStats(rows);
  }

 const openEdit = (goal) => {
    // Compute how many seconds other goals are already consuming this period.
    // The max this goal can be set to = periodCapacity - otherGoalsTotal.
    const otherGoalsSeconds = stats
      .filter(g => g.id !== goal.id)
      .reduce((sum, g) => sum + g.seconds, 0);
    setEditGoal(goal);
    setEditSeconds(goal.seconds);
    setEditMaxSeconds(periodInfo.totalSeconds - otherGoalsSeconds);
    setModalVisible(true);
  };

const handleSaveTime = async (goalId, newTotalSeconds) => {
    setModalVisible(false);
    const [sessions, activeSession] = await Promise.all([getSessions(), getActiveSession()]);
    const info = getPeriodInfo(activeTab); // always fresh, not stale state

    // If zeroing out a goal that is currently active, stop it first
    if (newTotalSeconds === 0 && activeSession?.goalId === goalId) {
      const { stopGoal } = require('../trackingService');
      await stopGoal();
    }

    const kept = sessions.filter(sess => {
      if (sess.goalId !== goalId) return true;
      if (sess.endTime == null) return true; // never drop sessions without endTime
      return sess.endTime < info.start || sess.startTime > info.end;
    });

    if (newTotalSeconds > 0) {
      // Anchor the synthetic session inside the period so the filter in
      // loadStats doesn't discard it. We use info.start as the anchor
      // and set endTime to info.start + duration. For the current period
      // (e.g. Day tab at 01:00 AM), endTime may be in the "future" relative
      // to Date.now(), but loadStats reads sess.duration directly for manual
      // sessions so the timestamp window clipping never applies.
      const startTime = info.start;
      const endTime = info.start + newTotalSeconds * 1000;
      kept.push({
        id: `manual_${goalId}_${Date.now()}`,
        goalId,
        startTime,
        endTime,
        duration: newTotalSeconds,
      });
    }

    await saveSessions(kept);
    await loadStats(activeTab);
  };

  const untrackedSecs = Math.max(0, periodInfo.totalSeconds - totalTracked);
  const untrackedPct = periodInfo.totalSeconds > 0 ? (untrackedSecs / periodInfo.totalSeconds) * 100 : 100;
  const trackedPct = periodInfo.totalSeconds > 0 ? (totalTracked / periodInfo.totalSeconds) * 100 : 0;
  const weekNum = Math.ceil(new Date().getDate() / 7);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />

      <View style={s.header}>
        <Text style={s.title}>Statistics</Text>
        <Text style={s.periodLabel}>{periodInfo.label}</Text>
      </View>

      <View style={s.overviewRow}>
        <View style={s.overviewItem}>
          <Text style={s.overviewVal}>{fmtDuration(overview.today)}</Text>
          <Text style={s.overviewLabel}>Today</Text>
        </View>
        <View style={s.overviewDivider} />
        <View style={s.overviewItem}>
          <Text style={s.overviewVal}>{fmtDuration(overview.week)}</Text>
          <Text style={s.overviewLabel}>Week {weekNum}</Text>
        </View>
        <View style={s.overviewDivider} />
        <View style={s.overviewItem}>
          <Text style={s.overviewVal}>{fmtDuration(overview.month)}</Text>
          <Text style={s.overviewLabel}>{new Date().toLocaleDateString('en-US', { month: 'short' })}</Text>
        </View>
        <View style={s.overviewDivider} />
        <View style={s.overviewItem}>
          <Text style={s.overviewVal}>{fmtDuration(overview.total)}</Text>
          <Text style={s.overviewLabel}>Total</Text>
        </View>
      </View>

      <View style={s.tabRow}>
  {TABS.map(t => (
    <TouchableOpacity
      key={t}
      style={[s.tab, activeTab === t && s.tabActive]}
      onPress={() => {
        setActiveTab(t);
        setSelectedChartPoint(null);
      }}
      activeOpacity={0.8}
    >
      <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>
        {t}
      </Text>
    </TouchableOpacity>
  ))}
  </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <View style={s.summaryBlock}>
              <Text style={s.summaryMeta}>TRACKED</Text>
              <Text style={s.summaryBig}>{fmtDuration(totalTracked)}</Text>
            </View>
            <View style={[s.summaryBlock, { alignItems: 'flex-end' }]}>
              <Text style={s.summaryMeta}>COVERAGE</Text>
              <Text style={[s.summaryBig, { color: '#4ade80' }]}>{fmtPct(trackedPct)}</Text>
            </View>
          </View>
          <View style={s.stackedBar}>
            {stats.filter(g => g.seconds > 0).map(g => (
              <View key={g.id} style={[s.stackSegment, { flex: g.seconds, backgroundColor: g.color }]} />
            ))}
            {untrackedSecs > 0 && <View style={[s.stackSegment, { flex: untrackedSecs, backgroundColor: '#232323' }]} />}
          </View>
          <View style={s.legendWrap}>
            {stats.filter(g => g.seconds > 0).map(g => (
              <View key={g.id} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: g.color }]} />
                <Text style={s.legendName}>{g.name}</Text>
              </View>
            ))}
            {untrackedSecs > 0 && (
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: '#3a3a3a' }]} />
                <Text style={[s.legendName, { color: '#444' }]}>Untracked</Text>
              </View>
            )}
          </View>
        </View>

        {chartData && chartData.datasets.length > 0 && (
          <View style={s.chartCard}>
            <Text style={s.sectionLabel}>HISTORY</Text>
            <View style={s.chartLegend}>
              {chartData.goals.map(g => (
                <View key={g.id} style={s.chartLegendItem}>
                  <View style={[s.chartLegendLine, { backgroundColor: g.color }]} />
                  <Text style={s.chartLegendText}>{g.name}</Text>
                </View>
              ))}
            </View>
            <ScrollView
              ref={chartScrollRef}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onLayout={(event) => {
                const nextWidth = event.nativeEvent.layout.width;
                if (nextWidth > 0 && Math.abs(nextWidth - chartViewportWidth) > 1) {
                  setChartViewportWidth(nextWidth);
                }
              }}
              onScroll={(event) => {
                setChartScrollX(event.nativeEvent.contentOffset.x);
              }}
            >
              <View style={[s.chartCanvas, { width: chartContentWidth }]}>
                <View
                  style={[
                    s.chartWindow,
                    {
                      left: chartWindow.left,
                      width: chartWindow.width,
                    },
                  ]}
                >
                  <SvgLineChart
                    data={chartData}
                    width={chartWindow.width}
                    height={CHART_HEIGHT}
                    selectedPoint={selectedChartPoint}
                    onPointSelect={setSelectedChartPoint}
                  />
                </View>
              </View>
            </ScrollView>
      </View>
        )}

        <View style={s.sectionRow}>
          <Text style={s.sectionRowLabel}>BREAKDOWN</Text>
          <Text style={s.tapHint}>tap to edit</Text>
        </View>

        {stats.map(g => (
          <TouchableOpacity key={g.id} style={s.goalCard} onPress={() => openEdit(g)} activeOpacity={0.72}>
            <View style={s.goalCardHeader}>
              <View style={[s.goalDot, { backgroundColor: g.color }]} />
              <Text style={s.goalCardName}>{g.name}</Text>
              <Text style={s.goalCardTime}>{fmtDuration(g.seconds)}</Text>
              <Text style={[s.goalCardPct, { color: g.color }]}>{fmtPct(g.pctOfTotal)}</Text>
              <Text style={[s.editHint, { color: g.color }]}>Edit</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, g.pctOfTotal))}%`, backgroundColor: g.color }]} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={[s.goalCard, { opacity: 0.6 }]}>
          <View style={s.goalCardHeader}>
            <View style={[s.goalDot, { backgroundColor: '#3a3a3a' }]} />
            <Text style={[s.goalCardName, { color: '#555' }]}>Untracked</Text>
            <Text style={[s.goalCardTime, { color: '#444' }]}>{fmtDuration(untrackedSecs)}</Text>
            <Text style={[s.goalCardPct, { color: '#444' }]}>{fmtPct(untrackedPct)}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, untrackedPct))}%`, backgroundColor: '#333' }]} />
          </View>
        </View>

        <Text style={s.footnote}>Period total: {fmtDuration(periodInfo.totalSeconds)}</Text>
      </ScrollView>

      <EditTimeModal
        visible={modalVisible}
        goal={editGoal}
        currentSeconds={editSeconds}
        maxSeconds={editMaxSeconds}
        periodInfo={periodInfo}
        onSave={handleSaveTime}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 4 },
  title: { fontSize: 32, fontWeight: '800', color: '#f0f0f0', letterSpacing: -1 },
  periodLabel: { fontSize: 13, color: '#444', marginTop: 3 },
  overviewRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#111', marginHorizontal: 16, borderRadius: 16, marginTop: 12, marginBottom: 4 },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewVal: { fontSize: 13, fontWeight: '800', color: '#4ade80' },
  overviewLabel: { fontSize: 10, color: '#555', marginTop: 3 },
  overviewDivider: { width: 1, backgroundColor: '#222' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#141414' },
  tabActive: { backgroundColor: '#252525' },
  tabText: { color: '#3a3a3a', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#f0f0f0' },
  scroll: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  summaryCard: { backgroundColor: '#141414', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  summaryBlock: {},
  summaryMeta: { fontSize: 10, fontWeight: '700', color: '#3a3a3a', letterSpacing: 1.5 },
  summaryBig: { fontSize: 28, fontWeight: '800', color: '#f0f0f0', marginTop: 4, letterSpacing: -0.5 },
  stackedBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1a1a1a', marginBottom: 14 },
  stackSegment: { height: '100%' },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendName: { fontSize: 12, color: '#666' },
  chartCard: { backgroundColor: '#141414', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e1e' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartLegendLine: { width: 18, height: 2, borderRadius: 1 },
  chartLegendText: { fontSize: 11, color: '#666' },
  chartCanvas: { height: CHART_HEIGHT, position: 'relative' },
  chartWindow: { position: 'absolute', top: 0, height: CHART_HEIGHT },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 10, marginLeft: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5, marginBottom: 10, marginLeft: 2 },
  sectionRowLabel: { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5 },
  tapHint: { fontSize: 10, color: '#2a2a2a', marginLeft: 8 },
  goalCard: { backgroundColor: '#141414', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e1e1e' },
  goalCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  goalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  goalCardName: { flex: 1, color: '#e0e0e0', fontSize: 14, fontWeight: '700' },
  goalCardTime: { color: '#666', fontSize: 13, marginRight: 8 },
  goalCardPct: { fontSize: 13, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  editHint: { fontSize: 11, marginLeft: 8, fontWeight: '700', opacity: 0.55 },
  barTrack: { height: 6, backgroundColor: '#1e1e1e', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  footnote: { textAlign: 'center', color: '#2a2a2a', fontSize: 12, marginTop: 20 },
});

const m = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000cc' },
  centerer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },

  card: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#242424',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
  },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  goalName: { fontSize: 18, fontWeight: '800', color: '#f0f0f0', letterSpacing: -0.3 },
  currentTxt: { fontSize: 12, color: '#444', marginTop: 2 },
  closeTxt: { fontSize: 20, color: '#3a3a3a', fontWeight: '700', paddingLeft: 8 },

  divider: { height: 1, backgroundColor: '#1e1e1e', marginBottom: 18 },
  label: { fontSize: 10, fontWeight: '700', color: '#3a3a3a', letterSpacing: 1.5, marginBottom: 14 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  inputBlock: { flex: 1, alignItems: 'center', gap: 6 },
  input: {
    width: '100%',
    backgroundColor: '#1c1c1c',
    color: '#f0f0f0',
    fontSize: 36,
    fontWeight: '700',
    textAlign: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 2,
    letterSpacing: 1,
  },
  unitLabel: { fontSize: 11, color: '#3a3a3a', fontWeight: '700', letterSpacing: 0.8 },
  colon: { fontSize: 30, color: '#2a2a2a', fontWeight: '800', marginBottom: 22 },

  preview: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
  },
  previewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  previewValue: { fontSize: 18, fontWeight: '800' },
  error: { color: '#f87171', fontSize: 12, textAlign: 'center', marginBottom: 10 },

  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn: { flex: 1, backgroundColor: '#1e1e1e', borderRadius: 14, padding: 16, alignItems: 'center' },
  cancelTxt: { color: '#555', fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 2, borderRadius: 14, padding: 16, alignItems: 'center' },
  saveTxt: { color: '#050f05', fontWeight: '800', fontSize: 15 },
  hint: { fontSize: 11, color: '#252525', textAlign: 'center', marginTop: 14, lineHeight: 16 },
});
