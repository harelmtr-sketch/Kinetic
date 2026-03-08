import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppShell from './src/navigation/AppShell';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}
