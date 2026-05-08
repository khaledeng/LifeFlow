import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveGoals } from '../storage';

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE = [
  '#4ade80', // green  – Work
  '#818cf8', // indigo – Sleep
  '#60a5fa', // blue   – Entertainment
  '#f472b6', // pink
  '#fb923c', // orange
  '#facc15', // yellow
  '#34d399', // emerald
  '#f87171', // red
  '#a78bfa', // violet
  '#38bdf8', // sky
];

const INITIAL_GOALS = [
  { id: '1', name: 'Work',          color: '#4ade80' },
  { id: '2', name: 'Sleep',         color: '#818cf8' },
  { id: '3', name: 'Entertainment', color: '#60a5fa' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SetupScreen({ onComplete }) {
  const [goals,        setGoals]        = useState(INITIAL_GOALS);
  const [goalName,     setGoalName]     = useState('');
  const [pickedColor,  setPickedColor]  = useState(PALETTE[0]);
  const [editingId,    setEditingId]    = useState(null);

  // ── Add / Update ─────────────────────────────────────────────────────────

  const submitGoal = () => {
    const name = goalName.trim();
    if (!name) return;

    if (editingId) {
      setGoals(prev =>
        prev.map(g => g.id === editingId ? { ...g, name, color: pickedColor } : g)
      );
      setEditingId(null);
    } else {
      setGoals(prev => [
        ...prev,
        { id: String(Date.now()), name, color: pickedColor },
      ]);
    }
    setGoalName('');
    setPickedColor(PALETTE[0]);
  };

  const startEdit = (goal) => {
    setEditingId(goal.id);
    setGoalName(goal.name);
    setPickedColor(goal.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setGoalName('');
    setPickedColor(PALETTE[0]);
  };

  const deleteGoal = (id) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (editingId === id) cancelEdit();
  };

  // ── Save & navigate ───────────────────────────────────────────────────────

  const handleStart = async () => {
    if (goals.length === 0) {
      Alert.alert('No goals', 'Add at least one goal before you start.');
      return;
    }
    await saveGoals(goals);
    onComplete();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={s.header}>
            <Text style={s.emoji}>🎯</Text>
            <Text style={s.title}>Set Up Your Goals</Text>
            <Text style={s.subtitle}>
              Define what you want to track every day.{'\n'}
              You can always tweak these later.
            </Text>
          </View>

          {/* ── Goal list ── */}
          <Text style={s.sectionLabel}>YOUR GOALS</Text>
          {goals.map(goal => (
            <View key={goal.id} style={s.goalRow}>
              <View style={[s.goalDot, { backgroundColor: goal.color }]} />
              <Text style={s.goalRowName} numberOfLines={1}>{goal.name}</Text>
              <TouchableOpacity style={s.goalAction} onPress={() => startEdit(goal)}>
                <Text style={s.goalActionEdit}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.goalAction} onPress={() => deleteGoal(goal.id)}>
                <Text style={s.goalActionDelete}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {goals.length === 0 && (
            <Text style={s.emptyHint}>No goals yet — add one below.</Text>
          )}

          {/* ── Form ── */}
          <View style={s.form}>
            <Text style={s.formLabel}>{editingId ? 'Edit Goal' : 'Add a Goal'}</Text>

            <TextInput
              style={s.input}
              placeholder="Goal name…"
              placeholderTextColor="#444"
              value={goalName}
              onChangeText={setGoalName}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={submitGoal}
            />

            <Text style={s.colorLabel}>Pick a color</Text>
            <View style={s.palette}>
              {PALETTE.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    s.swatch,
                    { backgroundColor: color },
                    pickedColor === color && s.swatchSelected,
                  ]}
                  onPress={() => setPickedColor(color)}
                  activeOpacity={0.75}
                />
              ))}
            </View>

            <View style={s.formBtns}>
              <TouchableOpacity
                style={[s.addBtn, !goalName.trim() && s.addBtnDisabled]}
                onPress={submitGoal}
                activeOpacity={0.8}
                disabled={!goalName.trim()}
              >
                <Text style={s.addBtnText}>{editingId ? '✓  Update' : '+  Add Goal'}</Text>
              </TouchableOpacity>
              {editingId && (
                <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>

        {/* ── CTA ── */}
        <View style={s.ctaWrapper}>
          <TouchableOpacity
            style={[s.ctaBtn, goals.length === 0 && s.ctaBtnDisabled]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Text style={s.ctaBtnText}>Start Tracking  →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#0f0f0f' },
  scroll:        { padding: 20, paddingBottom: 8 },

  header:        { alignItems: 'center', marginTop: 12, marginBottom: 32 },
  emoji:         { fontSize: 40, marginBottom: 12 },
  title:         { fontSize: 28, fontWeight: '800', color: '#f0f0f0', textAlign: 'center', letterSpacing: -0.5 },
  subtitle:      { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  sectionLabel:  { fontSize: 11, fontWeight: '700', color: '#444', letterSpacing: 1.5, marginBottom: 10 },

  goalRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, marginBottom: 8 },
  goalDot:       { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  goalRowName:   { flex: 1, color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  goalAction:    { paddingHorizontal: 8, paddingVertical: 4 },
  goalActionEdit:   { color: '#555', fontSize: 13 },
  goalActionDelete: { color: '#f87171', fontSize: 16, fontWeight: '700' },

  emptyHint:     { color: '#3a3a3a', fontSize: 14, textAlign: 'center', marginVertical: 12, fontStyle: 'italic' },

  form:          { backgroundColor: '#141414', borderRadius: 18, padding: 18, marginTop: 24, borderWidth: 1, borderColor: '#222' },
  formLabel:     { fontSize: 13, fontWeight: '700', color: '#888', letterSpacing: 0.8, marginBottom: 12 },

  input: {
    backgroundColor: '#1e1e1e',
    color: '#f0f0f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },

  colorLabel:    { fontSize: 12, color: '#555', marginBottom: 10, fontWeight: '600', letterSpacing: 0.5 },
  palette:       { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    margin: 5,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#f0f0f0',
    transform: [{ scale: 1.15 }],
  },

  formBtns:      { flexDirection: 'row', gap: 10 },
  addBtn:        { flex: 1, backgroundColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnDisabled:{ opacity: 0.35 },
  addBtnText:    { color: '#f0f0f0', fontWeight: '700', fontSize: 14 },
  cancelBtn:     { paddingHorizontal: 18, justifyContent: 'center' },
  cancelBtnText: { color: '#555', fontSize: 14 },

  ctaWrapper:    { padding: 20, paddingTop: 10 },
  ctaBtn:        { backgroundColor: '#4ade80', borderRadius: 16, padding: 18, alignItems: 'center' },
  ctaBtnDisabled:{ opacity: 0.4 },
  ctaBtnText:    { color: '#0a1a0a', fontWeight: '800', fontSize: 17, letterSpacing: 0.3 },
});
