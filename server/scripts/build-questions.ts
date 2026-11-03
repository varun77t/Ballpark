/**
 * Builds large question packs from open data and from computed Fermi templates.
 *
 *   npm run questions:build -w server     (fetches World Bank + Wikidata, ~1 minute)
 *   npm run db:seed                       (loads the packs into the database)
 *
 * Output: src/db/seed/generated/<pack>.json, committed so seeding never needs the network.
 * Every generated question carries real figures with a source link, or, for computed
 * templates, every assumption in its reasoning and an accepted range.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatNumber, type Difficulty } from '@ballpark/shared';
import type { GeneratedPack, SeedQuestion } from '../src/db/seed/types';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/db/seed/generated');
const UA = 'BallparkQuestionBuilder/1.0 (open-source estimation game; local build)';
const WORLD_POP = 8.2e9;
const EARTH_LAND_KM2 = 148.9e6;
const EQUATOR_KM = 40075;

const fmt = (n: number) => formatNumber(n);
const pct = (n: number, digits = 1) => `${n < 0.1 ? n.toPrecision(1) : n.toFixed(digits).replace(/\.0$/, '')}%`;
const slugify = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init?.headers ?? {}) } });
    if (res.ok) {
      // Wikidata can cut a slow response off mid-stream; treat broken JSON as retryable.
      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        if (attempt >= 3) throw new Error(`Truncated JSON from ${url.slice(0, 120)}…`);
      }
    } else if (attempt >= 5) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    // Honour rate limits: Retry-After when given, otherwise back off a little more each time.
    const retryAfter = Number(res.headers.get('retry-after'));
    await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * attempt));
  }
}

/* ───────────────────────── World Bank ───────────────────────── */

interface WbCountry {
  id: string;
  name: string;
  region: { id: string; value: string };
}
interface WbPoint {
  countryiso3code: string;
  date: string;
  value: number | null;
}

/** World Bank's official short names, rewritten the way people say them. */
const NAME_FIX: Record<string, string> = {
  'Korea, Rep.': 'South Korea',
  "Korea, Dem. People's Rep.": 'North Korea',
  'Egypt, Arab Rep.': 'Egypt',
  'Iran, Islamic Rep.': 'Iran',
  'Venezuela, RB': 'Venezuela',
  'Yemen, Rep.': 'Yemen',
  'Gambia, The': 'The Gambia',
  'Bahamas, The': 'The Bahamas',
  'Congo, Dem. Rep.': 'the Democratic Republic of the Congo',
  'Congo, Rep.': 'the Republic of the Congo',
  'Micronesia, Fed. Sts.': 'Micronesia',
  'Hong Kong SAR, China': 'Hong Kong',
  'Macao SAR, China': 'Macao',
  'Russian Federation': 'Russia',
  Turkiye: 'Türkiye',
  'Viet Nam': 'Vietnam',
  'Lao PDR': 'Laos',
  'Kyrgyz Republic': 'Kyrgyzstan',
  'Slovak Republic': 'Slovakia',
  'Syrian Arab Republic': 'Syria',
  "Cote d'Ivoire": 'Côte d’Ivoire',
  'Virgin Islands (U.S.)': 'the U.S. Virgin Islands',
  'British Virgin Islands': 'the British Virgin Islands',
  'St. Lucia': 'Saint Lucia',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
  'St. Martin (French part)': 'Saint Martin',
  'Sao Tome and Principe': 'São Tomé and Príncipe',
  'Brunei Darussalam': 'Brunei',
  'Curacao': 'Curaçao',
};
const WITH_THE = new Set([
  'United States',
  'United Kingdom',
  'Netherlands',
  'Philippines',
  'United Arab Emirates',
  'Central African Republic',
  'Dominican Republic',
  'Marshall Islands',
  'Solomon Islands',
  'Maldives',
  'Comoros',
  'Seychelles',
  'Cayman Islands',
  'Faroe Islands',
  'Northern Mariana Islands',
  'Turks and Caicos Islands',
]);

function countryName(raw: string): string {
  const n = NAME_FIX[raw] ?? raw;
  return WITH_THE.has(n) ? `the ${n}` : n;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function worldBankIndicator(code: string): Promise<Map<string, { value: number; year: string }>> {
  const data = await getJson<[unknown, WbPoint[]]>(`https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&mrnev=1&per_page=20000`);
  const out = new Map<string, { value: number; year: string }>();
  for (const p of data[1] ?? []) if (p.value !== null && p.value > 0) out.set(p.countryiso3code, { value: p.value, year: p.date });
  return out;
}

function byRank<T>(rows: T[], key: (r: T) => number, tiers: [number, Difficulty][], fallback: Difficulty): Map<T, Difficulty> {
  const sorted = [...rows].sort((a, b) => key(b) - key(a));
  const out = new Map<T, Difficulty>();
  sorted.forEach((r, i) => out.set(r, tiers.find(([n]) => i < n)?.[1] ?? fallback));
  return out;
}

const wbSource = (code: string, iso: string, label: string) => ({
  label: `World Bank Open Data: ${label}`,
  url: `https://data.worldbank.org/indicator/${code}?locations=${iso}`,
});

async function buildWorldBank(): Promise<{ packs: GeneratedPack[]; population: Map<string, number>; names: Map<string, string> }> {
  const meta = await getJson<[unknown, WbCountry[]]>('https://api.worldbank.org/v2/country?format=json&per_page=400');
  const countries = meta[1].filter((c) => c.region.id !== 'NA');
  const names = new Map(countries.map((c) => [c.id, countryName(c.name)]));
  const [pop, area, gdp, mobile, urban] = await Promise.all(
    ['SP.POP.TOTL', 'AG.LND.TOTL.K2', 'NY.GDP.MKTP.CD', 'IT.CEL.SETS', 'SP.URB.TOTL'].map(worldBankIndicator),
  );
  const population = new Map([...pop].map(([k, v]) => [k, v.value]));

  type Row = { iso: string; name: string; region: string; pop: number; area?: number; year: string };
  const rows: Row[] = countries
    .filter((c) => pop.has(c.id))
    .map((c) => ({ iso: c.id, name: names.get(c.id)!, region: c.region.value.trim(), pop: pop.get(c.id)!.value, area: area.get(c.id)?.value, year: pop.get(c.id)!.year }));

  // ── Population
  const popRows = rows.filter((r) => r.pop >= 100_000);
  const popDiff = byRank(popRows, (r) => r.pop, [[12, 'easy'], [50, 'medium'], [120, 'hard']], 'insane');
  const popQs: SeedQuestion[] = popRows.map((r) => {
    const density = r.area ? r.pop / r.area : null;
    return {
      slug: `wb-population-${r.iso.toLowerCase()}`,
      category: r.iso === 'IND' ? 'india' : 'geography',
      text: `How many people live in ${r.name}?`,
      difficulty: popDiff.get(r)!,
      answer: Math.round(r.pop),
      unit: 'people',
      kind: 'fact',
      explanation: `The World Bank puts ${r.name}’s population at about ${fmt(r.pop)} (${r.year}).`,
      reasoning: density
        ? [
            `${cap(r.name)} has about ${fmt(r.area!)} km² of land.`,
            `Countries in ${r.region} vary a lot; this one averages about ${fmt(density)} people per km².`,
            `${fmt(r.area!)} km² × ${fmt(density)} per km² ≈ ${fmt(r.pop)} people.`,
          ]
        : [`The world has about 8.2 billion people across ~200 countries.`, `This one holds ${pct((r.pop / WORLD_POP) * 100, 2)} of them: about ${fmt(r.pop)}.`],
      fact: `That is ${pct((r.pop / WORLD_POP) * 100, 2)} of everyone on Earth${density ? `, packed at about ${fmt(density)} people per km²` : ''}.`,
      sources: [wbSource('SP.POP.TOTL', r.iso, 'Population, total')],
      dailyEligible: false,
    };
  });

  // ── Land area
  const areaRows = rows.filter((r) => r.area && r.area >= 1000);
  const areaDiff = byRank(areaRows, (r) => r.area!, [[15, 'medium'], [80, 'hard']], 'insane');
  const areaQs: SeedQuestion[] = areaRows.map((r) => {
    const indiaRatio = r.area! / 2_973_190;
    return {
      slug: `wb-land-area-${r.iso.toLowerCase()}`,
      category: 'geography',
      text: `How much land does ${r.name} cover, in square kilometres?`,
      difficulty: areaDiff.get(r)!,
      answer: Math.round(r.area!),
      unit: 'km²',
      kind: 'fact',
      explanation: `World Bank data give ${r.name} about ${fmt(r.area!)} km² of land area (excluding inland water).`,
      reasoning: [
        `Anchor on a country you know: India has about 2.97 million km² of land; the UK about 242,000 km².`,
        `${cap(r.name)} is roughly ${indiaRatio >= 1 ? `${indiaRatio.toFixed(1)}× India` : `${pct(indiaRatio * 100)} of India`}.`,
        `≈ ${fmt(r.area!)} km².`,
      ],
      fact: `That is ${pct((r.area! / EARTH_LAND_KM2) * 100, 2)} of all the land on Earth.`,
      sources: [wbSource('AG.LND.TOTL.K2', r.iso, 'Land area (sq. km)')],
      dailyEligible: false,
    };
  });

  // ── GDP
  const gdpRows = rows.filter((r) => gdp.has(r.iso) && r.pop >= 1_000_000);
  const gdpDiff = byRank(gdpRows, (r) => gdp.get(r.iso)!.value, [[15, 'medium'], [60, 'hard']], 'insane');
  const gdpQs: SeedQuestion[] = gdpRows.map((r) => {
    const g = gdp.get(r.iso)!;
    const perHead = g.value / r.pop;
    return {
      slug: `wb-gdp-${r.iso.toLowerCase()}`,
      category: 'business',
      text: `What was ${r.name}’s GDP in ${g.year}, in US dollars?`,
      difficulty: gdpDiff.get(r)!,
      answer: Math.round(g.value),
      unit: 'US dollars',
      kind: 'fact',
      explanation: `The World Bank records ${r.name}’s ${g.year} GDP at about $${fmt(g.value)} (current US dollars).`,
      reasoning: [
        `Start with people: about ${fmt(r.pop)} live there.`,
        `Output per person is about $${fmt(perHead)} a year.`,
        `${fmt(r.pop)} × $${fmt(perHead)} ≈ $${fmt(g.value)}.`,
      ],
      fact: `That works out to roughly $${fmt(perHead)} for every person in the country, every year.`,
      sources: [wbSource('NY.GDP.MKTP.CD', r.iso, 'GDP (current US$)')],
      dailyEligible: false,
    };
  });

  // ── Mobile subscriptions
  const mobRows = rows.filter((r) => mobile.has(r.iso) && r.pop >= 1_000_000);
  const mobDiff = byRank(mobRows, (r) => mobile.get(r.iso)!.value, [[15, 'medium']], 'hard');
  const mobQs: SeedQuestion[] = mobRows.map((r) => {
    const m = mobile.get(r.iso)!;
    const per = m.value / r.pop;
    return {
      slug: `wb-mobile-${r.iso.toLowerCase()}`,
      category: r.iso === 'IND' ? 'india' : 'science',
      text: `How many mobile phone subscriptions were active in ${r.name} in ${m.year}?`,
      difficulty: mobDiff.get(r)!,
      answer: Math.round(m.value),
      unit: 'subscriptions',
      kind: 'fact',
      explanation: `The ITU, via the World Bank, counts about ${fmt(m.value)} mobile subscriptions in ${r.name} (${m.year}).`,
      reasoning: [
        `Population ≈ ${fmt(r.pop)}.`,
        `Count SIMs, not people: many have two, and some have none. Here it is ${per.toFixed(2)} per person.`,
        `${fmt(r.pop)} × ${per.toFixed(2)} ≈ ${fmt(m.value)}.`,
      ],
      fact: per >= 1 ? `There are more SIM subscriptions than people: ${per.toFixed(2)} for each resident.` : `That’s ${per.toFixed(2)} subscriptions per person: plenty of people still share or go without.`,
      sources: [wbSource('IT.CEL.SETS', r.iso, 'Mobile cellular subscriptions (ITU)')],
      dailyEligible: false,
    };
  });

  // ── Urban population
  const urbRows = rows.filter((r) => urban.has(r.iso) && r.pop >= 2_000_000);
  const urbDiff = byRank(urbRows, (r) => urban.get(r.iso)!.value, [[12, 'medium']], 'hard');
  const urbQs: SeedQuestion[] = urbRows.map((r) => {
    const u = urban.get(r.iso)!;
    const share = (u.value / r.pop) * 100;
    return {
      slug: `wb-urban-${r.iso.toLowerCase()}`,
      category: r.iso === 'IND' ? 'india' : 'geography',
      text: `How many people in ${r.name} live in cities and towns?`,
      difficulty: urbDiff.get(r)!,
      answer: Math.round(u.value),
      unit: 'people',
      kind: 'fact',
      explanation: `World Bank estimates put ${r.name}’s urban population at about ${fmt(u.value)} (${u.year}), using each country’s own definition of “urban”.`,
      reasoning: [`Total population ≈ ${fmt(r.pop)}.`, `About ${pct(share, 0)} of people there live in urban areas.`, `${fmt(r.pop)} × ${pct(share, 0)} ≈ ${fmt(u.value)}.`],
      fact: `${pct(share, 0)} of ${r.name}’s people are urban; the world as a whole crossed 50% around 2007.`,
      sources: [wbSource('SP.URB.TOTL', r.iso, 'Urban population')],
      dailyEligible: false,
    };
  });

  const pack = (slug: string, name: string, questions: SeedQuestion[]): GeneratedPack => ({ pack: { slug, name }, questions });
  return {
    population,
    names,
    packs: [
      pack('wb-population', 'Countries: population', popQs),
      pack('wb-land-area', 'Countries: land area', areaQs),
      pack('wb-gdp', 'Countries: GDP', gdpQs),
      pack('wb-mobile', 'Countries: mobile subscriptions', mobQs),
      pack('wb-urban', 'Countries: city dwellers', urbQs),
    ],
  };
}

/* ───────────────────────── Wikidata ───────────────────────── */

interface Binding {
  [k: string]: { value: string } | undefined;
}

async function sparql(query: string): Promise<Binding[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson<{ results: { bindings: Binding[] } }>(url, { headers: { Accept: 'application/sparql-results+json' } });
  return data.results.bindings;
}
const qid = (uri: string) => uri.split('/').pop()!;

/** English labels for many entities, 50 per request (the API's limit). */
async function labels(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join('|');
    const data = await getJson<{ entities: Record<string, { labels?: { en?: { value: string } } }> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch}&props=labels&languages=en&format=json`,
    );
    for (const [id, e] of Object.entries(data.entities)) if (e.labels?.en) out.set(id, e.labels.en.value);
    await new Promise((r) => setTimeout(r, 1200)); // stay well inside Wikidata's request budget
  }
  return out;
}
const isLabel = (s: string | undefined) => !!s && !/^Q\d+$/.test(s);

/**
 * Census of India 2011, city proper (municipal corporation). Wikidata's figures for these cities
 * mix district and metro totals, so the census count is used instead.
 */
const INDIA_CENSUS_2011: Record<string, number> = {
  Mumbai: 12_442_373,
  Delhi: 11_034_555,
  Bengaluru: 8_443_675,
  Hyderabad: 6_809_970,
  Ahmedabad: 5_577_940,
  Chennai: 4_646_732,
  Kolkata: 4_496_694,
  Surat: 4_467_797,
  Pune: 3_124_458,
  Jaipur: 3_046_163,
  Lucknow: 2_817_105,
  Kanpur: 2_765_348,
  Nagpur: 2_405_665,
  Prayagraj: 1_112_544,
};

const CHINA_CITIES = new Set(['Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen', 'Tianjin', 'Wuhan', 'Hong Kong']);

async function buildCities(population: Map<string, number>, names: Map<string, string>): Promise<GeneratedPack[]> {
  const rows = await sparql(`
    SELECT ?city ?country ?pop WHERE {
      ?city wdt:P31 wd:Q1549591; wdt:P1082 ?pop; wdt:P17 ?country.
      FILTER(?pop >= 300000)
    }`);
  // India's megacities are not all tagged "big city"; any subclass of city counts there.
  const indiaRows = await sparql(`
    SELECT ?city ?country ?pop WHERE {
      ?city wdt:P17 wd:Q668; wdt:P1082 ?pop. FILTER(?pop >= 300000)
      ?city wdt:P31/wdt:P279* wd:Q515.
      BIND(wd:Q668 AS ?country)
    }`);
  rows.push(...indiaRows);
  const isoRows = await sparql(`SELECT ?c ?iso WHERE { ?c wdt:P298 ?iso. ?c wdt:P31 wd:Q6256. }`);
  const isoOf = new Map(isoRows.map((b) => [qid(b.c!.value), b.iso!.value]));
  const seen = new Set<string>();
  // One row per city: keep its smallest recorded population. Where Wikidata holds several
  // figures, the larger ones are usually district or metro totals, not the city proper.
  const best = new Map<string, { id: string; name?: string; iso: string; pop: number }>();
  for (const b of rows) {
    const iso = isoOf.get(qid(b.country!.value));
    if (!iso) continue;
    const c = { id: qid(b.city!.value), name: undefined as string | undefined, iso, pop: Number(b.pop!.value) };
    const prev = best.get(c.id);
    if (!prev || c.pop < prev.pop) best.set(c.id, c);
  }
  const kept = [...best.values()].filter((c) => c.pop >= 750_000 || (c.iso === 'IND' && c.pop >= 300_000));
  const cityNames = await labels(kept.map((c) => c.id));
  for (const c of kept) c.name = cityNames.get(c.id);
  const cities = kept
    .filter((c) => isLabel(c.name) && Number.isFinite(c.pop) && names.has(c.iso) && population.has(c.iso))
    // Chinese "prefecture-level cities" are mostly rural regions; keep only true megacities.
    .filter((c) => c.iso !== 'CHN' || CHINA_CITIES.has(c.name!))
    .filter((c) => {
      const key = `${c.name}|${c.iso}`;
      if (seen.has(key)) return false;
      seen.add(key);
      // Drop records that exceed the whole country (bad data) or look like whole provinces.
      return c.pop < population.get(c.iso)! * 0.6;
    });

  const world = cities.filter((c) => c.iso !== 'IND');
  const india = cities.filter((c) => c.iso === 'IND');
  const worldDiff = byRank(world, (c) => c.pop, [[40, 'medium']], 'hard');
  const indiaDiff = byRank(india, (c) => c.pop, [[10, 'medium']], 'hard');

  const toQ = (c: (typeof cities)[number], difficulty: Difficulty, category: string): SeedQuestion => {
    const census = c.iso === 'IND' ? INDIA_CENSUS_2011[c.name!] : undefined;
    if (census) c = { ...c, pop: census };
    const countryPop = population.get(c.iso)!;
    const share = (c.pop / countryPop) * 100;
    const country = names.get(c.iso)!;
    return {
      slug: `city-${slugify(c.name!)}-${c.id.toLowerCase()}`,
      category,
      text: census
        ? `How many people lived in ${c.name}, India, at the 2011 Census? (The city proper, not the metro area.)`
        : `How many people live in ${c.name}, ${country}? (Inside the city’s own limits, not the wider metro area.)`,
      difficulty,
      answer: Math.round(c.pop),
      unit: 'people',
      kind: 'fact',
      tolerance: difficulty === 'medium' ? 1.5 : 2,
      explanation: census
        ? `The 2011 Census of India counted ${fmt(c.pop)} people in ${c.name}’s municipal limits; the wider urban agglomeration is larger.`
        : `Wikidata records a population of about ${fmt(c.pop)} for ${c.name}. City-limit counts vary by census and boundary, so the tolerance is generous.`,
      reasoning: [
        `${cap(country)} has about ${fmt(countryPop)} people.`,
        `A major city usually holds somewhere between 1% and 20% of its country; ${c.name} holds about ${pct(share)}.`,
        `${fmt(countryPop)} × ${pct(share)} ≈ ${fmt(c.pop)}.`,
      ],
      fact: share >= 1 ? `Roughly one in every ${Math.round(100 / share)} people in ${country} lives within ${c.name}’s limits.` : `Despite its size, ${c.name} is home to under 1% of ${country}’s people.`,
      sources: [
        census
          ? { label: 'Census of India 2011: cities with population over 1 lakh', url: 'https://censusindia.gov.in/' }
          : { label: `Wikidata: ${c.name} (population, P1082)`, url: `https://www.wikidata.org/wiki/${c.id}` },
        { label: 'World Bank Open Data: Population, total', url: `https://data.worldbank.org/indicator/SP.POP.TOTL?locations=${c.iso}` },
      ],
      dailyEligible: false,
    };
  };

  return [
    { pack: { slug: 'wd-cities', name: 'World cities: population' }, questions: world.map((c) => toQ(c, worldDiff.get(c)!, 'geography')) },
    { pack: { slug: 'wd-cities-india', name: 'Indian cities: population' }, questions: india.map((c) => toQ(c, indiaDiff.get(c)!, 'india')) },
  ];
}

async function buildRivers(): Promise<GeneratedPack> {
  const rows = await sparql(`
    SELECT ?r ?len ?basin WHERE {
      ?r wdt:P31 wd:Q4022; p:P2043/psn:P2043/wikibase:quantityAmount ?len.
      FILTER(?len >= 1500000 && ?len <= 7500000)
      ?r p:P2053/psn:P2053/wikibase:quantityAmount ?basin.
    }`);
  const longest = new Map<string, number>();
  for (const b of rows) {
    const id = qid(b.r!.value);
    const km = Number(b.len!.value) / 1000;
    const basinKm2 = Number(b.basin!.value) / 1e6;
    // Hack's law sanity check: a river this long drains a basin of at least ~L^1.6/10 km².
    if (!(basinKm2 >= km ** 1.6 / 10)) continue;
    longest.set(id, Math.max(longest.get(id) ?? 0, Number(b.len!.value)));
  }
  const top = [...longest].sort((a, b) => b[1] - a[1]).slice(0, 260);
  const riverNames = await labels(top.map(([id]) => id));
  const seen = new Set<string>();
  const rivers = top
    .map(([id, len]) => ({ id, name: riverNames.get(id), km: len / 1000 }))
    .filter((r) => isLabel(r.name) && !seen.has(r.name!) && (seen.add(r.name!), true))
    .slice(0, 220);
  const diff = byRank(rivers, (r) => r.km, [[12, 'medium']], 'hard');
  return {
    pack: { slug: 'wd-rivers', name: 'Rivers: length' },
    questions: rivers.map((r) => {
      const display = /river/i.test(r.name!) ? `the ${r.name}` : `the ${r.name} river`;
      return {
        slug: `river-${slugify(r.name!)}-${r.id.toLowerCase()}`,
        category: 'geography',
        text: `How long is ${display}, in kilometres?`,
        difficulty: diff.get(r)!,
        answer: Math.round(r.km),
        unit: 'km',
        kind: 'fact',
        tolerance: 1.5,
        explanation: `Wikidata lists ${display} at about ${fmt(Math.round(r.km))} km. River lengths depend on which source stream you count, so figures differ between atlases.`,
        reasoning: [
          'Calibrate on rivers you know: the Nile is about 6,650 km, the Ganges about 2,500 km, the Thames about 350 km.',
          'Estimate the straight-line distance from source to sea, then add 30–50% for meanders.',
          `≈ ${fmt(Math.round(r.km))} km.`,
        ],
        fact: `Laid along the equator it would stretch ${pct((r.km / EQUATOR_KM) * 100)} of the way around the Earth.`,
        sources: [{ label: `Wikidata: ${r.name} (length, P2043)`, url: `https://www.wikidata.org/wiki/${r.id}` }],
        dailyEligible: false,
      };
    }),
  };
}

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
      const n = (s.volume * t.packing) / t.volume;
      if (n < 20) continue; // a basketball in a bathtub is not a question
      const spread = Math.min(0.5, s.spread + 0.15);
      const difficulty: Difficulty = n < 2e4 ? 'easy' : n < 2e7 ? 'medium' : n < 1e12 ? 'hard' : 'insane';
      const q: SeedQuestion = {
        slug: `fit-${t.key}-in-${s.key}`,
        category: t.sports ? 'sports' : 'weird',
        text: `How many ${t.plural} could you fit inside ${s.name}?`,
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

interface Rate {
  key: string;
  what: string;
  perMinute: number;
  awakeOnly: boolean;
  how: string;
  low: number;
  high: number;
}
const RATES: Rate[] = [
  { key: 'heartbeats', what: 'times does a human heart beat', perMinute: 70, awakeOnly: false, how: 'A resting heart beats about 60–80 times a minute', low: 0.85, high: 1.15 },
  { key: 'breaths', what: 'breaths does an adult take', perMinute: 15, awakeOnly: false, how: 'An adult breathes about 12–20 times a minute', low: 0.8, high: 1.3 },
  { key: 'blinks', what: 'times does a person blink', perMinute: 17, awakeOnly: true, how: 'People blink about 15–20 times a minute while awake (16 waking hours a day)', low: 0.75, high: 1.25 },
];
const SPANS: { key: string; name: string; minutes: number; label: string }[] = [
  { key: 'hour', name: 'in an hour', minutes: 60, label: '1 hour = 60 minutes' },
  { key: 'day', name: 'in a day', minutes: 1440, label: '1 day = 1,440 minutes' },
  { key: 'week', name: 'in a week', minutes: 10080, label: '1 week = 10,080 minutes' },
  { key: 'year', name: 'in a year', minutes: 525600, label: '1 year ≈ 525,600 minutes' },
  { key: 'decade', name: 'in ten years', minutes: 5256000, label: '10 years ≈ 5.26 million minutes' },
  { key: 'lifetime', name: 'over a 73-year lifetime', minutes: 73 * 525600, label: '73 years ≈ 38.4 million minutes' },
];

function buildRates(): GeneratedPack {
  const qs: SeedQuestion[] = [];
  for (const r of RATES) {
    for (const s of SPANS) {
      const minutes = r.awakeOnly ? (s.minutes * 16) / 24 : s.minutes;
      const n = r.perMinute * minutes;
      const difficulty: Difficulty = s.key === 'hour' || s.key === 'day' ? 'easy' : s.key === 'lifetime' ? 'hard' : 'medium';
      qs.push({
        slug: `rate-${r.key}-${s.key}`,
        category: 'everyday',
        text: `How many ${r.what} ${s.name}?`,
        difficulty,
        answer: Math.round(n),
        low: Math.round(n * r.low),
        high: Math.round(n * r.high),
        unit: r.key,
        kind: 'estimate',
        explanation: `${r.perMinute} a minute × ${fmt(minutes)} ${r.awakeOnly ? 'waking ' : ''}minutes ≈ ${fmt(n)}.`,
        reasoning: [`${r.how}.`, `${s.label}${r.awakeOnly ? '; count only the waking two-thirds' : ''}.`, `${r.perMinute} × ${fmt(minutes)} ≈ ${fmt(n)}.`],
        fact: s.key === 'lifetime' ? `That is about ${fmt(n / WORLD_POP)} for every person alive today, from one body.` : 'Small rates times big spans: the trick behind most Fermi questions.',
        sources: [{ label: 'Computed from typical physiological rates (e.g. Wikipedia: Heart rate, Respiratory rate, Blinking)' }],
        dailyEligible: s.key !== 'hour',
      });
    }
  }
  return { pack: { slug: 'fermi-body-rates', name: 'Your body, by the numbers' }, questions: qs };
}

/* ───────────────────────── Main ───────────────────────── */

async function main() {
  await mkdir(OUT, { recursive: true });
  const packs: GeneratedPack[] = [...buildContainers(), buildRates()];
  console.log('fetching World Bank…');
  const wb = await buildWorldBank();
  packs.push(...wb.packs);
  console.log('fetching Wikidata cities…');
  packs.push(...(await buildCities(wb.population, wb.names)));
  console.log('fetching Wikidata rivers…');
  packs.push(await buildRivers());

  let total = 0;
  for (const p of packs) {
    total += p.questions.length;
    await writeFile(path.join(OUT, `${p.pack.slug}.json`), `${JSON.stringify(p, null, 1)}\n`);
    console.log(`  ${p.pack.slug.padEnd(22)} ${String(p.questions.length).padStart(4)} questions`);
  }
  console.log(`✔ ${total} generated questions in ${packs.length} packs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
