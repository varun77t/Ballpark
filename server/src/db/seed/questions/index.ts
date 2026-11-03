import type { SeedQuestion } from '../types';
import { animals } from './animals';
import { business } from './business';
import { everyday } from './everyday';
import { food } from './food';
import { geography } from './geography';
import { history } from './history';
import { india } from './india';
import { science } from './science';
import { space } from './space';
import { sports } from './sports';
import { weird } from './weird';

/** Category slug → questions. Add a new file here to add a category's questions. */
export const QUESTIONS_BY_CATEGORY: Record<string, SeedQuestion[]> = {
  science,
  geography,
  food,
  sports,
  everyday,
  animals,
  space,
  history,
  business,
  india,
  weird,
};
