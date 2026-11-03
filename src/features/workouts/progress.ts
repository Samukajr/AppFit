export type ProgressSession = {
  id: string;
  workoutId: string;
  workoutName: string;
  finishedAt: string;
  lifts: { exerciseKey: string; name: string; weightKg: number; reps: number }[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dados de evolução inválidos.');
  return value as Record<string, unknown>;
}
function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Texto de evolução inválido.');
  return value;
}
export function parseProgress(value: unknown): ProgressSession[] {
  if (!Array.isArray(value)) throw new Error('Histórico de evolução inválido.');
  const ids = new Set<string>();
  return value.map((entry) => {
    const session = record(entry);
    const id = text(session.id);
    const finishedAt = text(session.finishedAt);
    if (ids.has(id) || !Number.isFinite(Date.parse(finishedAt)) || !Array.isArray(session.lifts)) {
      throw new Error('Sessão de evolução inválida.');
    }
    ids.add(id);
    const keys = new Set<string>();
    return { id, workoutId: text(session.workoutId), workoutName: text(session.workoutName), finishedAt,
      lifts: session.lifts.map((entry) => {
        const lift = record(entry);
        const exerciseKey = text(lift.exerciseKey);
        if (keys.has(exerciseKey) || typeof lift.weightKg !== 'number' || !Number.isFinite(lift.weightKg) ||
          lift.weightKg < 0 || lift.weightKg > 2000 || typeof lift.reps !== 'number' ||
          !Number.isInteger(lift.reps) || lift.reps < 1 || lift.reps > 1000) {
          throw new Error('Carga ou repetições de evolução inválidas.');
        }
        keys.add(exerciseKey);
        return { exerciseKey, name: text(lift.name), weightKg: lift.weightKg, reps: lift.reps };
      }) };
  }).sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt) || a.id.localeCompare(b.id));
}

function monday(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return date;
}

export function weeklyFrequency(sessions: ProgressSession[], days: 30 | 90 | null, now = new Date()) {
  const start = new Date(now);
  if (days !== null) start.setDate(start.getDate() - days);
  else if (sessions.length) start.setTime(sessions.reduce((first, session) => Math.min(first, Date.parse(session.finishedAt)), now.getTime()));
  const first = monday(start);
  const last = monday(now);
  const counts = new Map<number, number>();
  for (const session of sessions) {
    const week = monday(new Date(session.finishedAt)).getTime();
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  const weeks: { date: string; count: number }[] = [];
  for (const date = first; date <= last; date.setDate(date.getDate() + 7)) {
    weeks.push({ date: date.toISOString(), count: counts.get(date.getTime()) ?? 0 });
  }
  return weeks;
}
