import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { getGoals, getSessions } from '../storage';

const SCREEN_W = Dimensions.get('window').width;
const TABS = ['Day', 'Week', 'Month', 'Year'];

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

function buildPoints(tab) {
  const now = new Date();
  const points = [];
  if (tab === 'Day') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      points.push({ label: d.getDate().toString(), start, end: start + 86400000 });
    }
  } else if (tab === 'Week') {
    for (let i = 7; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - now.getDay() - i * 7);
      d.setHours(0, 0, 0, 0);
      const start = d.getTime();
      points.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, start, end: start + 7 * 86400000 });
    }
  } else if (tab === 'Month') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      points.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), start, end });
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      points.push({ label: String(y), start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime() });
    }
  }
  return points;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

function buildChartData(tab, sessions, goals) {
  const points = buildPoints(tab);

  const datasets = goals.map(goal => {
    const { r, g, b } = hexToRgb(goal.color);
    const data = points.map(p => {
      let total = 0;
      sessions.forEach(sess => {
        if (sess.goalId !== goal.id || !sess.endTime) return;
        if (sess.endTime < p.start || sess.startTime > p.end) return;
        const cs = Math.max(sess.startTime, p.start);
        const ce = Math.min(sess.endTime, p.end);
        total += Math.floor((ce - cs) / 1000);
      });
      return Math.round((total / 3600) * 10) / 10;
    });
    return {
      data,
      color: (opacity = 1) => `rgba(${r}, ${g}, ${b}, ${opacity})`,
      strokeWidth: 2,
    };
  });

  const hasData = datasets.some(ds => ds.data.some(v => v > 0));
  return { labels: points.map(p => p.label), datasets, hasData, goals };
}

function calcOverview(sessions) {
  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let today = 0, week = 0, month = 0, total = 0;
  sessions.forEach(sess => {
    if (!sess.endTime) return;
    const dur = Math.floor((sess.endTime - sess.startTime) / 1000);
    total += dur;
    if (sess.startTime >= monthStart.getTime()) month += dur;
    if (sess.startTime >= weekStart.getTime()) week += dur;
    if (sess.startTime >= todayStart.getTime()) today += dur;
  });
  return { today, week, month, total };
}

export default function StatsScreen() {
  const [activeTab, setActiveTab] = useState('Day');
  const [stats, setStats] = useState([]);
  const [totalTracked, setTotalTracked] = useState(0);
  const [periodInfo, setPeriodInfo] = useState(getPeriodInfo('Day'));
  const [chartData, setChartData] = useState(null);
  const [overview, setOverview] = useState({ today: 0, week: 0, month: 0, total: 0 });
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) loadStats(activeTab);
  }, [isFocused, activeTab]);

  async function loadStats(tab) {
    const [goals, sessions] = await Promise.all([getGoals(), getSessions()]);
    const info = getPeriodInfo(tab);
    setPeriodInfo(info);
    setOverview(calcOverview(sessions));
    setChartData(buildChartData(tab, sessions, goals));

    const sums = {};
    goals.forEach(g => { sums[g.id] = 0; });
    sessions.forEach(sess => {
      if (!sess.endTime) return;
      if (sess.endTime < info.start || sess.startTime > info.end) return;
      const cs = Math.max(sess.startTime, info.start);
      const ce = Math.min(sess.endTime, info.end);
      const dur = Math.floor((ce - cs) / 1000);
      if (sess.goalId in sums) sums[sess.goalId] += dur;
    });

    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    setTotalTracked(total);

    const rows = goals
      .map(g => ({ ...g, seconds: sums[g.id] || 0, pctOfTotal: info.totalSeconds > 0 ? ((sums[g.id] || 0) / info.totalSeconds) * 100 : 0 }))
      .sort((a, b) => b.seconds - a.seconds);
    setStats(rows);
  }

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
          <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)} activeOpacity={0.8}>
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{t}</Text>
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

        {chartData && chartData.hasData && (
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
            <LineChart
              data={{ labels: chartData.labels, datasets: chartData.datasets }}
              width={SCREEN_W - 48}
              height={200}
              yAxisSuffix="h"
              chartConfig={{
                backgroundColor: '#141414',
                backgroundGradientFrom: '#141414',
                backgroundGradientTo: '#141414',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
                labelColor: () => '#555',
                propsForDotProps: { r: '3' },
                propsForBackgroundLines: { stroke: '#1e1e1e', strokeDasharray: '5,5' },
                propsForLabels: { fontSize: 10 },
              }}
              withDots={true}
              withShadow={false}
              withInnerLines={true}
              withOuterLines={false}
              bezier
              style={{ borderRadius: 8, marginLeft: -10 }}
            />
          </View>
        )}

        <Text style={[s.sectionLabel, { marginTop: 8 }]}>BREAKDOWN</Text>

        {stats.map(g => (
          <View key={g.id} style={s.goalCard}>
            <View style={s.goalCardHeader}>
              <View style={[s.goalDot, { backgroundColor: g.color }]} />
              <Text style={s.goalCardName}>{g.name}</Text>
              <Text style={s.goalCardTime}>{fmtDuration(g.seconds)}</Text>
              <Text style={[s.goalCardPct, { color: g.color }]}>{fmtPct(g.pctOfTotal)}</Text>
            </View>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.min(100, g.pctOfTotal)}%`, backgroundColor: g.color }]} />
            </View>
          </View>
        ))}

        <View style={[s.goalCard, { opacity: 0.6 }]}>
          <View style={s.goalCardHeader}>
            <View style={[s.goalDot, { backgroundColor: '#3a3a3a' }]} />
            <Text style={[s.goalCardName, { color: '#555' }]}>Untracked</Text>
            <Text style={[s.goalCardTime, { color: '#444' }]}>{fmtDuration(untrackedSecs)}</Text>
            <Text style={[s.goalCardPct, { color: '#444' }]}>{fmtPct(untrackedPct)}</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.min(100, untrackedPct)}%`, backgroundColor: '#333' }]} />
          </View>
        </View>

        <Text style={s.footnote}>Period total: {fmtDuration(periodInfo.totalSeconds)}</Text>
      </ScrollView>
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
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5, marginBottom: 10, marginLeft: 2 },
  goalCard: { backgroundColor: '#141414', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1e1e1e' },
  goalCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  goalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  goalCardName: { flex: 1, color: '#e0e0e0', fontSize: 14, fontWeight: '700' },
  goalCardTime: { color: '#666', fontSize: 13, marginRight: 10 },
  goalCardPct: { fontSize: 13, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  barTrack: { height: 6, backgroundColor: '#1e1e1e', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  footnote: { textAlign: 'center', color: '#2a2a2a', fontSize: 12, marginTop: 20 },
});