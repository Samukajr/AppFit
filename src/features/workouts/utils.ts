export function parseSet(repsText: string, weightText: string) {
  const normalizedWeight = weightText.trim().replace(',', '.');
  if (!/^\d+$/.test(repsText.trim()) || !/^\d+(\.\d{1,2})?$/.test(normalizedWeight)) {
    throw new Error('Informe repetições inteiras e uma carga válida (até 2 casas decimais).');
  }
  const reps = Number(repsText);
  const weightKg = Number(normalizedWeight);
  if (reps < 1 || reps > 1000 || weightKg > 2000) {
    throw new Error('Use de 1 a 1000 repetições e carga entre 0 e 2000 kg.');
  }
  return { reps, weightKg };
}

export function remainingSeconds(deadline: number | null, now: number) {
  return deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));
}
