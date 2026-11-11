/**
 * Builds the computed "how many fit" pack from stated dimensions and packing fractions.
 *
 *   npm run questions:build -w server     (no network needed)
 *   npm run db:seed                       (loads the pack into the database)
 *
 * Output: src/db/seed/generated/<pack>.json, committed so seeding never needs this script.
 * Only a curated handful of the thing × space grid is kept: a whole grid of near-identical
 * questions makes a deck feel like a worksheet.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatNumber, type Difficulty } from '@ballpark/shared';
import type { GeneratedPack, SeedQuestion } from '../src/db/seed/types';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/seed/generated');

const fmt = (n: number) => formatNumber(n);

/** The pairs worth asking: surprising, varied in scale, and not already hand-written. */
const KEEP = new Set([
  'fit-baseball-in-elevator',
  'fit-basketball-in-shipping-container',
  'fit-tennis-ball-in-olympic-pool',
  'fit-golf-ball-in-empire-state',
  'fit-football-in-great-pyramid',
  'fit-ping-pong-ball-in-great-pyramid',
  'fit-tennis-ball-in-moon',
  'fit-golf-ball-in-car-boot',
  'fit-lego-brick-in-olympic-pool',
  'fit-sugar-cube-in-car-boot',
  'fit-smartphone-in-shipping-container',
  'fit-shoebox-in-boeing-747',
  'fit-marble-in-elevator',
  'fit-lego-brick-in-empire-state',
  'fit-sugar-cube-in-great-pyramid',
  'fit-smartphone-in-school-bus',
]);

/* ───────────────────────── Computed Fermi templates ───────────────────────── */

interface Thing {
  key: string;
  name: string;
  plural: string;
  /** volume in m³ */
  volume: number;
  packing: number;
  how: string;
  sports?: boolean;
}

const sphere = (d: number) => (4 / 3) * Math.PI * (d / 2) ** 3;

const THINGS: Thing[] = [
  { key: 'marble', name: 'marble', plural: 'marbles', volume: sphere(0.016), packing: 0.64, how: 'A glass marble is about 16 mm across' },
  { key: 'ping-pong-ball', name: 'ping-pong ball', plural: 'ping-pong balls', volume: sphere(0.04), packing: 0.64, how: 'A ping-pong ball is 40 mm across (ITTF rules)', sports: true },
  { key: 'golf-ball', name: 'golf ball', plural: 'golf balls', volume: sphere(0.04267), packing: 0.64, how: 'A golf ball is 42.7 mm across (R&A rules)', sports: true },
  { key: 'tennis-ball', name: 'tennis ball', plural: 'tennis balls', volume: sphere(0.067), packing: 0.64, how: 'A tennis ball is about 6.7 cm across (ITF rules)', sports: true },
  { key: 'baseball', name: 'baseball', plural: 'baseballs', volume: sphere(0.074), packing: 0.64, how: 'A baseball is about 7.4 cm across', sports: true },
  { key: 'football', name: 'football (size 5)', plural: 'footballs', volume: sphere(0.22), packing: 0.64, how: 'A size-5 football is about 22 cm across', sports: true },
  { key: 'basketball', name: 'basketball', plural: 'basketballs', volume: sphere(0.243), packing: 0.64, how: 'A size-7 basketball is about 24.3 cm across', sports: true },
  { key: 'lego-brick', name: 'LEGO 2×4 brick', plural: 'LEGO 2×4 bricks', volume: 0.0318 * 0.0158 * 0.0114, packing: 0.55, how: 'A 2×4 LEGO brick is 31.8 × 15.8 × 11.4 mm, and loose bricks leave lots of gaps' },
  { key: 'sugar-cube', name: 'sugar cube', plural: 'sugar cubes', volume: 0.016 ** 3, packing: 0.9, how: 'A sugar cube is about 1.6 cm on each side, and cubes stack tightly' },
  { key: 'smartphone', name: 'smartphone', plural: 'smartphones', volume: 0.147 * 0.071 * 0.0078, packing: 0.9, how: 'A typical smartphone is about 14.7 × 7.1 × 0.8 cm, stacked neatly' },
  { key: 'shoebox', name: 'shoebox', plural: 'shoeboxes', volume: 0.33 * 0.19 * 0.12, packing: 0.95, how: 'A shoebox is about 33 × 19 × 12 cm, stacked like bricks' },
];

interface Space {
  key: string;
  name: string;
  /** volume in m³ */
  volume: number;
  how: string;
  /** relative uncertainty of the space’s usable volume */
  spread: number;
}

const SPACES: Space[] = [
  { key: 'bathtub', name: 'a standard bathtub', volume: 0.22, how: 'A bathtub holds about 220 litres to the rim (0.22 m³)', spread: 0.3 },
  { key: 'car-boot', name: 'a family car’s boot', volume: 0.45, how: 'A family hatchback’s boot is about 450 litres (0.45 m³)', spread: 0.3 },
  { key: 'elevator', name: 'a passenger lift', volume: 5, how: 'A passenger lift car is about 1.6 × 1.4 × 2.3 m ≈ 5 m³', spread: 0.3 },
  { key: 'shipping-container', name: 'a 20-foot shipping container', volume: 33.2, how: 'A 20-foot container holds 33.2 m³ (ISO spec)', spread: 0.05 },
  { key: 'school-bus', name: 'a school bus', volume: 40, how: 'A full-size school bus has about 10 × 2.3 × 1.9 m inside, minus seats ≈ 40 m³', spread: 0.25 },
  { key: 'boeing-747', name: 'a Boeing 747', volume: 900, how: 'A 747-400’s passenger cabin is roughly 70 × 6 × 2.5 m ≈ 900 m³ (cargo holds excluded)', spread: 0.3 },
  { key: 'olympic-pool', name: 'an Olympic swimming pool (2 m deep)', volume: 2500, how: 'An Olympic pool is 50 × 25 × 2 m = 2,500 m³', spread: 0.05 },
  { key: 'empire-state', name: 'the Empire State Building', volume: 1.04e6, how: 'The Empire State Building encloses about 37 million cubic feet ≈ 1.04 million m³', spread: 0.15 },
  { key: 'great-pyramid', name: 'the Great Pyramid of Giza', volume: 2.58e6, how: 'The Great Pyramid’s volume is about 230² × 146 ÷ 3 ≈ 2.6 million m³', spread: 0.1 },
  { key: 'moon', name: 'the Moon', volume: 2.1958e19, how: 'The Moon’s volume is about 2.2 × 10¹⁹ m³ (radius 1,737 km)', spread: 0.05 },
];

function buildContainers(): GeneratedPack[] {
  const weird: SeedQuestion[] = [];
  const sports: SeedQuestion[] = [];
  for (const t of THINGS) {
    for (const s of SPACES) {
      if (!KEEP.has(`fit-${t.key}-in-${s.key}`)) continue;
      const n = (s.volume * t.packing) / t.volume;
      const spread = Math.min(0.5, s.spread + 0.15);
      const difficulty: Difficulty = n < 2e4 ? 'easy' : n < 2e7 ? 'medium' : n < 1e12 ? 'hard' : 'insane';
      const q: SeedQuestion = {
        slug: `fit-${t.key}-in-${s.key}`,
        category: t.sports ? 'sports' : 'weird',
        text: `How many ${t.plural} could you fit inside ${s.name}?`,
        shape: 'fit',
        difficulty,
        answer: Math.round(n),
        low: Math.round(n * (1 - spread)),
        high: Math.round(n * (1 + spread)),
        unit: t.plural,
        kind: 'estimate',
        tolerance: difficulty === 'easy' ? 1.5 : 2,
        explanation: `Usable volume ÷ the space each ${t.name} really takes up (its own volume plus the gaps around it) ≈ ${fmt(n)}.`,
        reasoning: [
          `${s.how}.`,
          `${t.how}: about ${fmt(t.volume * 1e6)} cm³ each.`,
          `They fill only about ${Math.round(t.packing * 100)}% of the space; the rest is gaps.`,
          `${fmt(s.volume)} m³ × ${t.packing} ÷ ${t.volume.toPrecision(3)} m³ ≈ ${fmt(n)}.`,
        ],
        fact:
          t.packing === 0.64
            ? 'Randomly poured balls fill about 64% of a space; even the best possible arrangement only reaches 74%, as Kepler guessed and a computer proof confirmed in 1998.'
            : `Shape matters: neat stacking fills ${Math.round(t.packing * 100)}% of the space, far more than a random heap.`,
        sources: [{ label: 'Computed estimate from stated dimensions; packing fractions from Wikipedia: Sphere packing', url: 'https://en.wikipedia.org/wiki/Sphere_packing' }],
        dailyEligible: true,
      };
      (t.sports ? sports : weird).push(q);
    }
  }
  return [
    { pack: { slug: 'fermi-fit-objects', name: 'How many fit: objects' }, questions: weird },
    { pack: { slug: 'fermi-fit-balls', name: 'How many fit: balls' }, questions: sports },
  ];
}

/* ───────────────────────── Main ───────────────────────── */

async function main() {
  await mkdir(OUT, { recursive: true });
  const packs = buildContainers();
  const missing = [...KEEP].filter((slug) => !packs.some((p) => p.questions.some((q) => q.slug === slug)));
  if (missing.length) throw new Error(`KEEP lists questions the grid no longer produces: ${missing.join(', ')}`);

  for (const p of packs) {
    await writeFile(path.join(OUT, `${p.pack.slug}.json`), `${JSON.stringify(p, null, 1)}
`);
    console.log(`  ${p.pack.slug.padEnd(22)} ${String(p.questions.length).padStart(4)} questions`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
