import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  StatusBar, ScrollView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGoals, getSessions, getActiveSession,
  saveGoals, saveSessions, saveActiveSession, saveSetupDone,
} from '../storage';

const BACKUP_VERSION = 1;
const IS_WEB = Platform.OS === 'web';
const BACKUP_APP_NAMES = ['LifeFlow', 'TimeTracker'];

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtHours(secs) {
  if (!secs) return '0h';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 100) return `${h}h`;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Platform export/import ───────────────────────────────────────────────────

async function doExport(json, fileName) {
  if (IS_WEB) {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return new Blob([json]).size;
  }
  const FS      = require('expo-file-system/legacy');
  const Sharing = require('expo-sharing');
  const uri     = FS.documentDirectory + fileName;
  await FS.writeAsStringAsync(uri, json);
  const info = await FS.getInfoAsync(uri);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing not available.');
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Save backup' });
  return info.size || 0;
}

function doImport() {
  if (IS_WEB) {
    return new Promise((resolve, reject) => {
      const input  = document.createElement('input');
      input.type   = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) { reject(new Error('cancelled')); return; }
        const reader = new FileReader();
        reader.onload  = (ev) => resolve({ name: file.name, content: ev.target.result });
        reader.onerror = ()  => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      };
      document.body.appendChild(input);
      input.click();
      // give browser a moment, then clean up
      setTimeout(() => document.body.removeChild(input), 1000);
    });
  }
  return (async () => {
    const DP = require('expo-document-picker');
    const FS = require('expo-file-system/legacy');
    const result = await DP.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) throw new Error('cancelled');
    const file    = result.assets?.[0] ?? result;
    const content = await FS.readAsStringAsync(file.uri);
    return { name: file.name, content };
  })();
}

function confirmReplace(goalCount, sessionCount, backupDate) {
  const msg = `Replace current data with:\n• ${goalCount} goals\n• ${sessionCount} sessions\n• Exported ${backupDate}\n\nThis cannot be undone.`;
  if (IS_WEB) {
    // eslint-disable-next-line no-alert
    return window.confirm(`Restore Backup?\n\n${msg}`)
      ? Promise.resolve()
      : Promise.reject(new Error('cancelled'));
  }
  return new Promise((resolve, reject) =>
    Alert.alert('Restore Backup?', msg, [
      { text: 'Cancel',  style: 'cancel',     onPress: () => reject(new Error('cancelled')) },
      { text: 'Restore', style: 'destructive', onPress: resolve },
    ], { cancelable: false })
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DataScreen({ isActive = true }) {
  const [stats,          setStats]          = useState(null);
  const [exporting,      setExporting]      = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState(null);
  const [log,            setLog]            = useState([]);

  useEffect(() => {
    if (isActive) loadStats();
  }, [isActive]);

  async function loadStats() {
    const [goals, sessions, active] = await Promise.all([
      getGoals(), getSessions(), getActiveSession(),
    ]);
    const earliest  = sessions.length ? Math.min(...sessions.map(s => s.startTime)) : null;
    const totalSecs = sessions.reduce((a, s) => a + (s.duration || 0), 0);
    setStats({ goals, sessions, active, earliest, totalSecs });
  }

  function addLog(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLog(prev => [{ ts, msg, type, key: Date.now() + Math.random() }, ...prev].slice(0, 30));
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true);
    addLog('Preparing backup…');
    try {
      const [goals, sessions, active] = await Promise.all([getGoals(), getSessions(), getActiveSession()]);
      const payload  = { _meta: { version: BACKUP_VERSION, exportedAt: Date.now(), appName: 'LifeFlow' }, goals, sessions, activeSession: active };
      const json     = JSON.stringify(payload, null, 2);
      const fileName = `timetracker_backup_${Date.now()}.json`;
      const size     = await doExport(json, fileName);
      setLastBackupInfo({ exportedAt: Date.now(), size });
      addLog(`✓ ${IS_WEB ? 'Downloaded' : 'Shared'}: ${goals.length} goals, ${sessions.length} sessions (${formatBytes(size)})`, 'success');
    } catch (err) {
      addLog(`Export failed: ${err.message}`, 'error');
      if (!IS_WEB) Alert.alert('Export failed', err.message);
    } finally {
      setExporting(false);
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    try {
      addLog('Opening file picker…');
      const { name, content } = await doImport();
      setImporting(true);
      addLog(`Reading: ${name}`);

      let payload;
      try { payload = JSON.parse(content); }
      catch { throw new Error('File is not valid JSON.'); }

      if (!payload._meta || !BACKUP_APP_NAMES.includes(payload._meta.appName))
        throw new Error('Not a valid LifeFlow backup file.');
      if (!Array.isArray(payload.goals))    throw new Error('Missing goals array.');
      if (!Array.isArray(payload.sessions)) throw new Error('Missing sessions array.');

      const goalCount    = payload.goals.length;
      const sessionCount = payload.sessions.length;
      const backupDate   = formatDate(payload._meta.exportedAt);

      addLog(`Found ${goalCount} goals, ${sessionCount} sessions (${backupDate})`);
      await confirmReplace(goalCount, sessionCount, backupDate);

      const normalizedSessions = payload.sessions.map(s => ({
        ...s,
        startTime: Number(s.startTime),
        endTime:   s.endTime != null ? Number(s.endTime) : null,
        duration:  s.duration != null ? Number(s.duration) : null,
      })).filter(s => Number.isFinite(s.startTime) && s.startTime > 0);

      const normalizedActive = payload.activeSession
        ? {
            ...payload.activeSession,
            startTime: Number(payload.activeSession.startTime),
          }
        : null;

      // If restored active session's startTime is in the future (clock skew / corrupt),
      // discard it to avoid negative elapsed times.
      const safeActive = normalizedActive && normalizedActive.startTime <= Date.now()
        ? normalizedActive
        : null;

      await saveGoals(payload.goals);
      await saveSessions(normalizedSessions);
      await saveActiveSession(safeActive);
      await saveSetupDone(payload.goals.length > 0);
      await loadStats();

      addLog(`✓ Restored: ${goalCount} goals, ${sessionCount} sessions`, 'success');
      if (!IS_WEB) Alert.alert('Restored!', `Imported ${goalCount} goals and ${sessionCount} sessions.`);
    } catch (err) {
      if (err.message !== 'cancelled') {
        addLog(`Import failed: ${err.message}`, 'error');
        if (!IS_WEB) Alert.alert('Import failed', err.message);
      } else {
        addLog('Cancelled.');
      }
    } finally {
      setImporting(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  async function handleReset() {
    const ok = IS_WEB
      // eslint-disable-next-line no-alert
      ? window.confirm('Delete ALL data permanently? This cannot be undone.')
      : await new Promise(resolve =>
          Alert.alert('⚠️ Delete All Data', 'Permanently deletes all goals and sessions.', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete Everything', style: 'destructive', onPress: () => resolve(true) },
          ])
        );
    if (!ok) return;
    try {
      await AsyncStorage.clear();
      addLog('All data wiped.', 'error');
      await loadStats();
    } catch (err) { addLog(`Reset failed: ${err.message}`, 'error'); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <Text style={s.title}>Data</Text>
          <Text style={s.subtitle}>Backup & restore your tracking data</Text>
        </View>

        {/* Summary */}
        {stats && (
          <View style={s.summaryCard}>
            <Text style={s.cardLabel}>CURRENT DATA</Text>
            <View style={s.summaryGrid}>
              <StatBlock label="Goals"      value={stats.goals.length} />
              <StatBlock label="Sessions"   value={stats.sessions.length} />
              <StatBlock label="Since"      value={stats.earliest
                ? new Date(stats.earliest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                : '—'} />
              <StatBlock label="Total Time" value={fmtHours(stats.totalSecs)} />
            </View>
            {stats.active && (
              <View style={s.activeBadge}>
                <View style={s.activeDot} />
                <Text style={s.activeBadgeText}>Timer running — included in backup</Text>
              </View>
            )}
          </View>
        )}

        {/* Export */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>EXPORT</Text>
          <View style={s.actionCard}>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>Export Backup</Text>
              <Text style={s.actionDesc}>
                {IS_WEB ? 'Downloads a .json file to your computer.' : 'Share a .json file via Drive, email, or any app.'}
              </Text>
              {lastBackupInfo && (
                <Text style={s.actionMeta}>Last: {formatDate(lastBackupInfo.exportedAt)} · {formatBytes(lastBackupInfo.size)}</Text>
              )}
            </View>
            <TouchableOpacity style={[s.btn, s.btnExport, exporting && s.btnDisabled]} onPress={handleExport} disabled={exporting} activeOpacity={0.8}>
              {exporting ? <ActivityIndicator color="#0a1a0a" size="small" /> : <Text style={s.btnExportText}>↑  Export</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Import */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>IMPORT</Text>
          <View style={s.actionCard}>
            <View style={s.actionInfo}>
              <Text style={s.actionTitle}>Restore from Backup</Text>
              <Text style={s.actionDesc}>
                {IS_WEB ? 'Pick a .json backup file from your computer.' : 'Pick a .json file. Current data will be replaced.'}
              </Text>
            </View>
            <TouchableOpacity style={[s.btn, s.btnImport, importing && s.btnDisabled]} onPress={handleImport} disabled={importing} activeOpacity={0.8}>
              {importing ? <ActivityIndicator color="#0a0f1a" size="small" /> : <Text style={s.btnImportText}>↓  Import</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Migration guide (native only) */}
        {!IS_WEB && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>HOW TO MIGRATE TO A NEW PHONE</Text>
            <View style={s.guideCard}>
              {[
                { n: '1', text: 'Tap Export on your old phone.' },
                { n: '2', text: 'Share the .json to Drive, WhatsApp, or email.' },
                { n: '3', text: 'Open the file on your new phone.' },
                { n: '4', text: 'Tap Import here and pick the file.' },
              ].map(step => (
                <View key={step.n} style={s.step}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{step.n}</Text></View>
                  <Text style={s.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Activity log */}
        {log.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>ACTIVITY LOG</Text>
            <View style={s.logCard}>
              {log.map(entry => (
                <View key={entry.key} style={s.logRow}>
                  <Text style={s.logTs}>{entry.ts}</Text>
                  <Text style={[s.logMsg, entry.type === 'success' && s.logSuccess, entry.type === 'error' && s.logError]}>
                    {entry.msg}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Danger zone */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: '#7f1d1d' }]}>DANGER ZONE</Text>
          <View style={[s.actionCard, s.dangerCard]}>
            <View style={s.actionInfo}>
              <Text style={[s.actionTitle, { color: '#f87171' }]}>Delete All Data</Text>
              <Text style={s.actionDesc}>Permanently wipes all goals and sessions.</Text>
            </View>
            <TouchableOpacity style={[s.btn, s.btnDanger]} onPress={handleReset} activeOpacity={0.8}>
              <Text style={s.btnDangerText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.footnote}>All data stored locally — nothing sent to any server.</Text>
        <Text style={s.credit}>Developed by EngKhaled</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBlock({ label, value }) {
  return (
    <View style={s.statBlock}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: '#0f0f0f' },
  scroll:   { padding: 20, paddingBottom: 48 },
  header:   { marginBottom: 24, marginTop: 8 },
  title:    { fontSize: 32, fontWeight: '800', color: '#f0f0f0', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: '#444', marginTop: 4 },

  summaryCard: { backgroundColor: '#141414', borderRadius: 18, padding: 18, marginBottom: 8, borderWidth: 1, borderColor: '#1e1e1e' },
  cardLabel:   { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5, marginBottom: 14 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statBlock:   { alignItems: 'center' },
  statValue:   { fontSize: 22, fontWeight: '800', color: '#f0f0f0' },
  statLabel:   { fontSize: 11, color: '#444', marginTop: 3, fontWeight: '600' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 14, backgroundColor: '#4ade8015', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#4ade8030' },
  activeDot:   { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4ade80', marginRight: 8 },
  activeBadgeText: { fontSize: 12, color: '#4ade80', fontWeight: '600' },

  section:      { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5, marginBottom: 10 },

  actionCard:  { backgroundColor: '#141414', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#1e1e1e', gap: 12 },
  actionInfo:  { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#f0f0f0', marginBottom: 5 },
  actionDesc:  { fontSize: 12, color: '#555', lineHeight: 18 },
  actionMeta:  { fontSize: 11, color: '#3a3a3a', marginTop: 6 },

  btn:           { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 88, minHeight: 46 },
  btnDisabled:   { opacity: 0.5 },
  btnExport:     { backgroundColor: '#4ade80' },
  btnExportText: { color: '#0a1a0a', fontWeight: '800', fontSize: 13 },
  btnImport:     { backgroundColor: '#60a5fa' },
  btnImportText: { color: '#0a0f1a', fontWeight: '800', fontSize: 13 },
  btnDanger:     { backgroundColor: '#1e0808', borderWidth: 1, borderColor: '#7f1d1d' },
  btnDangerText: { color: '#f87171', fontWeight: '700', fontSize: 13 },
  dangerCard:    { borderColor: '#2a0a0a' },

  guideCard:   { backgroundColor: '#141414', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e1e1e', gap: 14 },
  step:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum:     { width: 24, height: 24, borderRadius: 12, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { color: '#888', fontWeight: '800', fontSize: 12 },
  stepText:    { flex: 1, color: '#666', fontSize: 13, lineHeight: 19 },

  logCard:    { backgroundColor: '#0c0c0c', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1a1a1a', gap: 6 },
  logRow:     { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  logTs:      { fontSize: 11, color: '#2a2a2a', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', paddingTop: 1 },
  logMsg:     { flex: 1, fontSize: 12, color: '#444', lineHeight: 18 },
  logSuccess: { color: '#4ade80' },
  logError:   { color: '#f87171' },

  footnote: { textAlign: 'center', color: '#252525', fontSize: 12, marginTop: 8 },
  credit: { textAlign: 'center', color: '#333', fontSize: 12, marginTop: 8, fontWeight: '700' },
});
