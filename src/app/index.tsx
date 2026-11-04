import { useAuth } from '../features/auth/AuthProvider';
import { StudentHome } from '../features/onboarding/StudentHome';

export default function Home() {
  const { session } = useAuth();
  return session ? <StudentHome key={session.user.id} /> : null;
}
