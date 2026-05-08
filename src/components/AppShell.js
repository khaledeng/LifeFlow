import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';

import TrackerScreen from '../screens/TrackerScreen';
import StatsScreen   from '../screens/StatsScreen';
import GoalsScreen   from '../screens/GoalsScreen';
import DataScreen    from '../screens/DataScreen';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_W * 0.78, 300);

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'tracker', label: 'Tracker',    icon: '⏱',  desc: 'Start & stop your goals' },
  { key: 'stats',   label: 'Statistics', icon: '📊',  desc: 'See your time breakdown' },
  { key: 'goals',   label: 'Your Goals', icon: '🎯',  desc: 'Manage what you track' },
  { key: 'data',    label: 'Data',       icon: '💾',  desc: 'Backup & restore' },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function AppShell() {
  const [activeScreen, setActiveScreen] = useState('tracker');
  const [drawerOpen,   setDrawerOpen]   = useState(false);

  const translateX  = useRef(new Animated.Value(-DRAWER_W)).current;
  const backdropOpa = useRef(new Animated.Value(0)).current;

  // ── Drawer animations ──────────────────────────────────────────────────────
  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue:         0,
        damping:         20,
        stiffness:       180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpa, {
        toValue:         1,
        duration:        220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateX, backdropOpa]);

  const closeDrawer = useCallback((callback) => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue:         -DRAWER_W,
        damping:         22,
        stiffness:       200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpa, {
        toValue:         0,
        duration:        180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDrawerOpen(false);
      callback?.();
    });
  }, [translateX, backdropOpa]);

  const navigateTo = (key) => {
    closeDrawer(() => setActiveScreen(key));
  };

  // ── Current nav item meta ──────────────────────────────────────────────────
  const current = NAV_ITEMS.find(n => n.key === activeScreen);

  // ── Render screen ──────────────────────────────────────────────────────────
  const renderScreen = () => {
    // All screens are mounted to preserve state; hidden via style to avoid re-mounts
    return (
      <>
        <View style={{ flex: 1, display: activeScreen === 'tracker' ? 'flex' : 'none' }}>
          <TrackerScreen isActive={activeScreen === 'tracker'} />
        </View>
        <View style={{ flex: 1, display: activeScreen === 'stats' ? 'flex' : 'none' }}>
          <StatsScreen isActive={activeScreen === 'stats'} />
        </View>
        <View style={{ flex: 1, display: activeScreen === 'goals' ? 'flex' : 'none' }}>
          <GoalsScreen isActive={activeScreen === 'goals'} />
        </View>
        <View style={{ flex: 1, display: activeScreen === 'data' ? 'flex' : 'none' }}>
          <DataScreen />
        </View>
      </>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />

      {/* ── Top bar with burger ── */}
      <SafeAreaView style={s.topBarSafe}>
        <View style={s.topBar}>
          {/* Burger button */}
          <TouchableOpacity
            style={s.burgerBtn}
            onPress={openDrawer}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <View style={s.burgerLine} />
            <View style={[s.burgerLine, { width: 18 }]} />
            <View style={[s.burgerLine, { width: 14 }]} />
          </TouchableOpacity>

          {/* Current screen name */}
          <View style={s.topBarCenter}>
            <Text style={s.topBarIcon}>{current.icon}</Text>
            <Text style={s.topBarTitle}>{current.label}</Text>
          </View>

          {/* Spacer to balance burger */}
          <View style={s.burgerSpacer} />
        </View>
      </SafeAreaView>

      {/* ── Screen content ── */}
      <View style={s.content}>
        {renderScreen()}
      </View>

      {/* ── Drawer overlay ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <TouchableWithoutFeedback onPress={() => closeDrawer()}>
            <Animated.View
              style={[s.backdrop, { opacity: backdropOpa }]}
            />
          </TouchableWithoutFeedback>

          {/* Drawer panel */}
          <Animated.View
            style={[s.drawer, { transform: [{ translateX }] }]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              {/* Drawer header */}
              <View style={s.drawerHeader}>
                <Text style={s.drawerLogo}>⏱</Text>
                <View>
                  <Text style={s.drawerAppName}>Time Tracker</Text>
                  <Text style={s.drawerTagline}>Track what matters</Text>
                </View>
              </View>

              <View style={s.divider} />

              {/* Nav items */}
              <View style={s.navList}>
                {NAV_ITEMS.map(item => {
                  const isActive = activeScreen === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[s.navItem, isActive && s.navItemActive]}
                      onPress={() => navigateTo(item.key)}
                      activeOpacity={0.75}
                    >
                      <Text style={s.navIcon}>{item.icon}</Text>
                      <View style={s.navText}>
                        <Text style={[s.navLabel, isActive && s.navLabelActive]}>
                          {item.label}
                        </Text>
                        <Text style={s.navDesc}>{item.desc}</Text>
                      </View>
                      {isActive && <View style={s.activeBar} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Drawer footer */}
              <View style={s.drawerFooter}>
                <View style={s.divider} />
                <Text style={s.drawerFooterTxt}>All data stored locally on device</Text>
              </View>
            </SafeAreaView>
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0f0f0f' },
  content: { flex: 1 },

  // ── Top bar ──
  topBarSafe:   { backgroundColor: '#111111', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  topBar: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 16,
    paddingVertical:  12,
  },
  burgerBtn:   { padding: 4, gap: 5, justifyContent: 'center' },
  burgerLine:  { width: 22, height: 2, backgroundColor: '#f0f0f0', borderRadius: 2 },
  burgerSpacer:{ width: 30 },

  topBarCenter: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:           8,
  },
  topBarIcon:  { fontSize: 18 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#f0f0f0', letterSpacing: 0.2 },

  // ── Backdrop ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    opacity: 0.55,
    zIndex: 10,
  },

  // ── Drawer ──
  drawer: {
    position:        'absolute',
    left:            0,
    top:             0,
    bottom:          0,
    width:           DRAWER_W,
    backgroundColor: '#111111',
    zIndex:          20,
    borderRightWidth: 1,
    borderRightColor: '#1e1e1e',
    // Android shadow
    elevation:       24,
    // iOS shadow
    shadowColor:     '#000',
    shadowOffset:    { width: 4, height: 0 },
    shadowOpacity:   0.5,
    shadowRadius:    16,
  },

  drawerHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 22,
    paddingTop:    28,
    paddingBottom: 22,
    gap:           14,
  },
  drawerLogo:    { fontSize: 34 },
  drawerAppName: { fontSize: 20, fontWeight: '800', color: '#f0f0f0', letterSpacing: -0.5 },
  drawerTagline: { fontSize: 12, color: '#3a3a3a', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#1a1a1a', marginHorizontal: 16 },

  navList: { paddingVertical: 12, paddingHorizontal: 10, gap: 4 },

  navItem: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap:            14,
    position:       'relative',
    overflow:       'hidden',
  },
  navItemActive: { backgroundColor: '#1e1e1e' },

  navIcon:  { fontSize: 22, width: 30, textAlign: 'center' },
  navText:  { flex: 1 },
  navLabel: { fontSize: 15, fontWeight: '600', color: '#666', letterSpacing: 0.2 },
  navLabelActive: { color: '#f0f0f0', fontWeight: '700' },
  navDesc:  { fontSize: 11, color: '#333', marginTop: 2 },

  activeBar: {
    position:        'absolute',
    right:           0,
    top:             '20%',
    bottom:          '20%',
    width:           3,
    borderRadius:    2,
    backgroundColor: '#4ade80',
  },

  drawerFooter: { marginTop: 'auto', paddingBottom: 20 },
  drawerFooterTxt: {
    textAlign:  'center',
    fontSize:   11,
    color:      '#252525',
    marginTop:  14,
    paddingHorizontal: 16,
  },
});