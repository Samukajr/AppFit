import { useAuth } from '../features/auth/AuthProvider';
import { WorkoutScreen } from '../features/workouts/screens/WorkoutScreen';

export default function Home() {
  const { session } = useAuth();
  return session ? <WorkoutScreen key={session.user.id} /> : null;
}
