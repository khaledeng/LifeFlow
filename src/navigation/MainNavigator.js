import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TrackerScreen from '../screens/TrackerScreen';
import StatsScreen   from '../screens/StatsScreen';
import DataScreen    from '../screens/DataScreen';

const Tab = createBottomTabNavigator();

const Icon = ({ glyph, color }) => (
  <Text style={{ fontSize: 21, color }}>{glyph}</Text>
);

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor:  '#1e1e1e',
          borderTopWidth:  1,
          height:          62,
          paddingBottom:   8,
          paddingTop:      4,
        },
        tabBarActiveTintColor:   '#4ade80',
        tabBarInactiveTintColor: '#333',
        tabBarLabelStyle: {
          fontSize:   11,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Tracker"
        component={TrackerScreen}
        options={{
          tabBarLabel: 'Tracker',
          tabBarIcon:  ({ color }) => <Icon glyph="⏱" color={color} />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarLabel: 'Stats',
          tabBarIcon:  ({ color }) => <Icon glyph="📊" color={color} />,
        }}
      />
      <Tab.Screen
        name="Data"
        component={DataScreen}
        options={{
          tabBarLabel: 'Data',
          tabBarIcon:  ({ color }) => <Icon glyph="💾" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}