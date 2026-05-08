import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getSetupDone } from './src/storage';
import { registerNotificationHandlers } from './src/notifications';
import SetupScreen from './src/screens/SetupScreen';
import AppShell    from './src/components/AppShell';

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [loading,    setLoading]    = useState(true);
  const [setupDone,  setSetupDone]  = useState(false);

  useEffect(() => {
    registerNotificationHandlers().catch(error => {
      console.warn('Unable to register notification handlers', error);
    });

    (async () => {
      try {
        setSetupDone(await getSetupDone());
      } catch (e) {
        // If storage fails, show setup
        setSetupDone(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Loading splash ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  // ── One-time setup ─────────────────────────────────────────────────────────

  if (!setupDone) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
        <SetupScreen onComplete={() => setSetupDone(true)} />
      </SafeAreaProvider>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#111111" />
      <AppShell />
    </SafeAreaProvider>
  );
}
