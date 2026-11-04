export function youtubeExerciseSearch(exerciseName: string) {
  const name = exerciseName.trim();
  if (!name || name.length > 200) throw new Error('Nome de exercício inválido para buscar vídeo.');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} execução correta exercício`)}`;
}
