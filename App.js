import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getGoals } from './src/storage';
import SetupScreen from './src/screens/SetupScreen';
import MainNavigator from './src/navigation/MainNavigator';

const NAV_THEME = {
  white: true,
  colors: {
    primary: '#4ade80',
    background: '#0f0f0f',
    card: '#111111',
    text: '#f0f0f0',
    border: '#1e1e1e',
    notification: '#4ade80',
  },
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const goals = await getGoals();
        setSetupDone(goals.length > 0);
      } catch (e) {
        setSetupDone(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' }}>
          <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!setupDone) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
        <SetupScreen onComplete={() => setSetupDone(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={NAV_THEME}>
        <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />
        <MainNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}