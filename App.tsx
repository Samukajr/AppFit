import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WorkoutScreen } from './src/features/workouts/screens/WorkoutScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <WorkoutScreen />
    </SafeAreaProvider>
  );
}
