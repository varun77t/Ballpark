import type * as React from 'react';
import {
  Atom,
  Brain,
  Coffee,
  Compass,
  Crosshair,
  Droplet,
  Flame,
  Gem,
  Globe2,
  HelpCircle,
  Infinity as InfinityIcon,
  Landmark,
  Leaf,
  Repeat,
  Rocket,
  Shuffle,
  Sparkles,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

/** Icons referenced by name from the database (categories) and shared code (achievements). */
const ICONS: Record<string, LucideIcon> = {
  Atom,
  Brain,
  Coffee,
  Compass,
  Crosshair,
  Droplet,
  Flame,
  Gem,
  Globe2,
  Infinity: InfinityIcon,
  Landmark,
  Leaf,
  Repeat,
  Rocket,
  Shuffle,
  Sparkles,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
};

export function NamedIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const Icon = ICONS[name] ?? HelpCircle;
  return <Icon className={className} style={style} aria-hidden />;
}
