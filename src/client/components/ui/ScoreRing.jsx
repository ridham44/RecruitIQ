function colorFor(score) {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

export default function ScoreRing({ score = 0, size = 44 }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border-4 border-current font-semibold ${colorFor(score)}`}
      style={{ width: size, height: size, fontSize: size / 3.2 }}
    >
      {Math.round(score)}
    </div>
  );
}
