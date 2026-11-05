import { MQ } from './mediaQueries';
import { compactHeader } from './responsiveCompactHeader';
import { compactSheet } from './responsiveCompactSheet';

// Mobile (≤ 720px) et tablettes basses : tout le palier compact, en deux morceaux qui gardent leur ordre.
export const compactStyles = {
  [MQ.compact]: {
    ...compactHeader,
    ...compactSheet,
  },
};
