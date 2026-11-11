import type { SeedQuestion } from '../types';
import { animals } from './animals';
import { business } from './business';
import { everyday } from './everyday';
import { food } from './food';
import { geography } from './geography';
import { history } from './history';
import { india } from './india';
import { animalsNapkin } from './napkin/animals';
import { businessNapkin } from './napkin/business';
import { everydayNapkin } from './napkin/everyday';
import { foodNapkin } from './napkin/food';
import { geographyNapkin } from './napkin/geography';
import { historyNapkin } from './napkin/history';
import { indiaNapkin } from './napkin/india';
import { scienceNapkin } from './napkin/science';
import { spaceNapkin } from './napkin/space';
import { sportsNapkin } from './napkin/sports';
import { weirdNapkin } from './napkin/weird';
import { science } from './science';
import { space } from './space';
import { sports } from './sports';
import { weird } from './weird';

/**
 * Category slug → questions. Add a new file here to add a category's questions.
 * The napkin/ files hold the Fermi-style rebuild: familiar things nobody has counted.
 */
export const QUESTIONS_BY_CATEGORY: Record<string, SeedQuestion[]> = {
  science: [...science, ...scienceNapkin],
  geography: [...geography, ...geographyNapkin],
  food: [...food, ...foodNapkin],
  sports: [...sports, ...sportsNapkin],
  everyday: [...everyday, ...everydayNapkin],
  animals: [...animals, ...animalsNapkin],
  space: [...space, ...spaceNapkin],
  history: [...history, ...historyNapkin],
  business: [...business, ...businessNapkin],
  india: [...india, ...indiaNapkin],
  weird: [...weird, ...weirdNapkin],
};
