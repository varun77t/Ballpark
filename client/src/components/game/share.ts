import { formatNumber, type AttemptDTO, type QuestionReveal } from '@ballpark/shared';
import { cardColor } from '@/lib/deck';

function label(attempt: AttemptDTO): string {
  if (attempt.mode === 'daily' && attempt.dailyDate) return `Daily ${attempt.dailyDate}`;
  if (attempt.mode === 'endless') return 'Endless';
  return `No. ${attempt.question.id}`;
}

function verdict(attempt: AttemptDTO): string {
  const r = attempt.result!;
  if (r.status === 'skipped') return 'Skipped';
  return r.status === 'solved' ? 'HIT' : 'MISS';
}

export function shareText(attempt: AttemptDTO): string {
  const r = attempt.result!;
  const g = attempt.guesses[0];
  const mark = r.status === 'solved' ? '🎯' : '🫠';
  return [
    `Ballpark ${label(attempt)} · ${verdict(attempt)} ${mark}`,
    `“${attempt.question.text}”`,
    g ? `${Math.round(r.accuracy)}% accuracy · ${r.score.total} pts` : 'No guess',
    typeof window !== 'undefined' ? window.location.origin : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Draws a 1080×1350 result card in the question's own color. Returns a PNG blob. */
export async function shareImage(attempt: AttemptDTO): Promise<Blob> {
  const q = attempt.question as QuestionReveal;
  const r = attempt.result!;
  const color = cardColor(q.category);
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  await document.fonts?.ready;
  const face = "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif";

  ctx.fillStyle = '#ece8df';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color.bg;
  ctx.beginPath();
  ctx.roundRect(48, 48, W - 96, H - 96, 64);
  ctx.fill();

  ctx.fillStyle = color.fg;
  ctx.strokeStyle = color.fg;
  const x = 120;

  // Brand
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(x + 22, 150, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 22, 150, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `850 40px ${face}`;
  ctx.fillText('Ballpark', x + 62, 164);
  ctx.font = `700 26px ${face}`;
  ctx.textAlign = 'right';
  ctx.fillText(label(attempt).toUpperCase(), W - x, 162);
  ctx.textAlign = 'left';

  // Question, wrapped
  ctx.font = `800 60px ${face}`;
  const lines: string[] = [];
  let line = '';
  for (const w of q.text.split(' ')) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 2 * x && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  const shown = lines.slice(0, 5);
  shown.forEach((l, i) => ctx.fillText(i === 4 && lines.length > 5 ? `${l}…` : l, x, 330 + i * 72));

  // Answer
  const y = 330 + shown.length * 72 + 110;
  ctx.font = `700 26px ${face}`;
  ctx.fillText('ANSWER', x, y);
  ctx.font = `900 132px ${face}`;
  ctx.fillText(formatNumber(q.answer), x, y + 140);
  ctx.font = `700 32px ${face}`;
  ctx.fillText(q.unit, x, y + 196);

  // Stamp
  ctx.save();
  ctx.translate(W - x - 150, y + 60);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(-150, -62, 300, 124, 28);
  ctx.stroke();
  ctx.font = `900 64px ${face}`;
  ctx.textAlign = 'center';
  ctx.fillText(verdict(attempt).toUpperCase(), 0, 22);
  ctx.restore();

  // Score line
  ctx.font = `800 44px ${face}`;
  const g = attempt.guesses[0];
  ctx.fillText(g ? `Guessed ${formatNumber(g.value)} · ${Math.round(r.accuracy)}% · ${r.score.total} pts` : 'No guess', x, H - 150);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png'));
}
