import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getGoals, saveGoals } from '../storage';

const PALETTE = [
  '#4ade80','#818cf8','#60a5fa','#f472b6',
  '#fb923c','#facc15','#34d399','#f87171',
  '#a78bfa','#38bdf8',
];

export default function GoalsScreen({ isActive }) {
  const [goals,       setGoals]       = useState([]);
  const [goalName,    setGoalName]    = useState('');
  const [pickedColor, setPickedColor] = useState(PALETTE[0]);
  const [editingId,   setEditingId]   = useState(null);
  const [saved,       setSaved]       = useState(false);

  const load = useCallback(async () => {
    const g = await getGoals();
    setGoals(g);
  }, []);

  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  // ── Persist whenever goals change ──────────────────────────────────────────
  const persist = async (updated) => {
    setGoals(updated);
    await saveGoals(updated);
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const submitGoal = async () => {
    const name = goalName.trim();
    if (!name) return;

    let updated;
    if (editingId) {
      updated = goals.map(g =>
        g.id === editingId ? { ...g, name, color: pickedColor } : g
      );
      setEditingId(null);
    } else {
      updated = [...goals, { id: String(Date.now()), name, color: pickedColor }];
    }
    setGoalName('');
    setPickedColor(PALETTE[0]);
    await persist(updated);
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

  const deleteGoal = async (id) => {
    const ok = Platform.OS === 'web'
      ? window.confirm('Delete this goal? Sessions already logged won\'t be affected.')
      : await new Promise(resolve =>
          Alert.alert('Delete goal?', 'Sessions already logged won\'t be affected.', [
            { text: 'Cancel', style: 'cancel',      onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive',  onPress: () => resolve(true) },
          ])
        );
    if (!ok) return;
    const updated = goals.filter(g => g.id !== id);
    if (editingId === id) cancelEdit();
    await persist(updated);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Your Goals</Text>
            <Text style={s.subtitle}>Add, rename, or remove goals</Text>
          </View>
          {saved && (
            <View style={s.savedBadge}>
              <Text style={s.savedText}>✓ Saved</Text>
            </View>
          )}
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Goal list */}
          <Text style={s.sectionLabel}>
            {goals.length} {goals.length === 1 ? 'GOAL' : 'GOALS'}
          </Text>

          {goals.length === 0 && (
            <Text style={s.empty}>No goals yet — add one below.</Text>
          )}

          {goals.map(goal => (
            <View
              key={goal.id}
              style={[s.row, editingId === goal.id && { borderColor: goal.color, borderWidth: 1 }]}
            >
              <View style={[s.dot, { backgroundColor: goal.color }]} />
              <Text style={s.rowName} numberOfLines={1}>{goal.name}</Text>
              <TouchableOpacity style={s.rowBtn} onPress={() => startEdit(goal)}>
                <Text style={s.editTxt}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.rowBtn} onPress={() => deleteGoal(goal.id)}>
                <Text style={s.deleteTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Form */}
          <View style={s.form}>
            <Text style={s.formLabel}>{editingId ? '✏️  Edit Goal' : '＋  New Goal'}</Text>

            <TextInput
              style={s.input}
              placeholder="Goal name…"
              placeholderTextColor="#3a3a3a"
              value={goalName}
              onChangeText={setGoalName}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={submitGoal}
            />

            <Text style={s.colorLabel}>Color</Text>
            <View style={s.palette}>
              {PALETTE.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.swatch, { backgroundColor: c }, pickedColor === c && s.swatchSel]}
                  onPress={() => setPickedColor(c)}
                  activeOpacity={0.75}
                />
              ))}
            </View>

            <View style={s.formRow}>
              <TouchableOpacity
                style={[s.addBtn, !goalName.trim() && s.addBtnOff]}
                onPress={submitGoal}
                disabled={!goalName.trim()}
                activeOpacity={0.8}
              >
                <Text style={s.addBtnTxt}>
                  {editingId ? '✓  Update' : '＋  Add Goal'}
                </Text>
              </TouchableOpacity>
              {editingId && (
                <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#0f0f0f' },
  scroll:     { padding: 20, paddingBottom: 40 },

  header: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    paddingHorizontal: 22,
    paddingTop:        18,
    paddingBottom:     10,
  },
  title:    { fontSize: 32, fontWeight: '800', color: '#f0f0f0', letterSpacing: -1 },
  subtitle: { fontSize: 13, color: '#444', marginTop: 3 },

  savedBadge: {
    backgroundColor: '#4ade8020',
    borderRadius:    20,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderWidth: 1,
    borderColor: '#4ade8040',
  },
  savedText: { color: '#4ade80', fontWeight: '700', fontSize: 13 },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#333', letterSpacing: 1.5, marginBottom: 10 },
  empty:        { color: '#2a2a2a', fontStyle: 'italic', fontSize: 14, marginBottom: 20 },

  row: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: '#1a1a1a',
    borderRadius:    14,
    padding:         14,
    marginBottom:    8,
    borderWidth:     1,
    borderColor:     'transparent',
  },
  dot:       { width: 11, height: 11, borderRadius: 6, marginRight: 12 },
  rowName:   { flex: 1, color: '#f0f0f0', fontSize: 15, fontWeight: '600' },
  rowBtn:    { paddingHorizontal: 8, paddingVertical: 4 },
  editTxt:   { color: '#555', fontSize: 13 },
  deleteTxt: { color: '#f87171', fontSize: 16, fontWeight: '700' },

  form: {
    backgroundColor: '#141414',
    borderRadius:    18,
    padding:         18,
    marginTop:       24,
    borderWidth:     1,
    borderColor:     '#1e1e1e',
  },
  formLabel:  { fontSize: 13, fontWeight: '700', color: '#555', letterSpacing: 0.5, marginBottom: 14 },
  input: {
    backgroundColor: '#1e1e1e',
    color:           '#f0f0f0',
    borderRadius:    12,
    padding:         14,
    fontSize:        16,
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     '#2a2a2a',
  },
  colorLabel: { fontSize: 11, color: '#444', fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 },
  palette:    { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  swatch:     { width: 34, height: 34, borderRadius: 17, margin: 5 },
  swatchSel:  { borderWidth: 3, borderColor: '#f0f0f0', transform: [{ scale: 1.15 }] },

  formRow:    { flexDirection: 'row', gap: 10 },
  addBtn:     { flex: 1, backgroundColor: '#2a2a2a', borderRadius: 12, padding: 14, alignItems: 'center' },
  addBtnOff:  { opacity: 0.3 },
  addBtnTxt:  { color: '#f0f0f0', fontWeight: '700', fontSize: 14 },
  cancelBtn:  { paddingHorizontal: 18, justifyContent: 'center' },
  cancelTxt:  { color: '#555', fontSize: 14 },
});