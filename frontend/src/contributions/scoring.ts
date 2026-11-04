import type { ContributionStatus, HotPost, VoteEvent } from './types';

export const HOT_CONFIG = {
  weights: { votes: 1.0, velocity: 1.5, engagement: 0.5 },
  earlyWindowH: 1,
  gravity: 1.5,
  offsetH: 2,
} as const;

const HOUR = 3_600_000;

export function hotScore(post: HotPost, now = Date.now(), cfg = HOT_CONFIG): number {
  const created = +new Date(post.createdAt);
  const ageH = Math.max((+new Date(now) - created) / HOUR, 0);

  const net = post.upvotes - post.downvotes;
  const logVotes = Math.sign(net) * Math.log10(Math.max(Math.abs(net), 1));

  const windowEnd = created + cfg.earlyWindowH * HOUR;
  const early = post.upvoteTimes
    ? post.upvoteTimes.filter((time) => +new Date(time) <= windowEnd).length
    : post.earlyUpvotes ?? 0;
  const observedH = Math.max(Math.min(ageH, cfg.earlyWindowH), 0.25);
  const velocity = Math.log10(1 + early / observedH);

  const engagement = Math.log10(1 + post.comments * (1 + 0.5 * post.avgCommentDepth));
  const ratio = (post.upvotes + 1) / (post.upvotes + post.downvotes + 2);
  const raw = (
    cfg.weights.votes * logVotes
    + cfg.weights.velocity * velocity
    + cfg.weights.engagement * engagement
  ) * ratio;

  return raw / Math.pow(ageH + cfg.offsetH, cfg.gravity);
}

export function rank<T extends HotPost>(posts: readonly T[], now = Date.now()): Array<T & { score: number }> {
  return posts
    .map((post) => ({ ...post, score: hotScore(post, now) }))
    .sort((a, b) => b.score - a.score);
}

export interface CollaborativeItem {
  cid: string;
  authorPublicKey?: string;
  score?: number;
}

export type CollaborativeRecommendation<T extends CollaborativeItem> = T & {
  recommendationScore: number;
  similarPeers: number;
  positivePeers: number;
};

export function collaborativeRank<T extends CollaborativeItem>(
  items: readonly T[],
  events: readonly VoteEvent[],
  viewerPublicKey: string | null | undefined,
  minimumOverlap = 2,
): Array<CollaborativeRecommendation<T>> {
  if (!Number.isSafeInteger(minimumOverlap) || minimumOverlap < 1) {
    throw new RangeError('Le nombre minimal de votes partagés doit être positif.');
  }
  if (!viewerPublicKey) return [];

  const votes = deduplicateVotes(events);
  const ratingsByUser = new Map<string, Map<string, number>>();
  const votersByItem = new Map<string, Array<{ publicKey: string; rating: number }>>();
  for (const vote of votes) {
    const rating = vote.direction === 'up' ? 1 : -1;
    let profile = ratingsByUser.get(vote.publicKey);
    if (!profile) {
      profile = new Map();
      ratingsByUser.set(vote.publicKey, profile);
    }
    profile.set(vote.contributionCid, rating);
    const voters = votersByItem.get(vote.contributionCid) ?? [];
    voters.push({ publicKey: vote.publicKey, rating });
    votersByItem.set(vote.contributionCid, voters);
  }

  const viewerProfile = ratingsByUser.get(viewerPublicKey);
  if (!viewerProfile || viewerProfile.size < minimumOverlap) return [];
  const overlapByPeer = new Map<string, { agreement: number; count: number }>();
  for (const [cid, viewerRating] of viewerProfile) {
    for (const voter of votersByItem.get(cid) ?? []) {
      if (voter.publicKey === viewerPublicKey) continue;
      const overlap = overlapByPeer.get(voter.publicKey) ?? { agreement: 0, count: 0 };
      overlap.agreement += viewerRating * voter.rating;
      overlap.count++;
      overlapByPeer.set(voter.publicKey, overlap);
    }
  }

  const similarityByPeer = new Map<string, number>();
  for (const [publicKey, overlap] of overlapByPeer) {
    if (overlap.count < minimumOverlap) continue;
    const cosineSimilarity = overlap.agreement / overlap.count;
    if (cosineSimilarity > 0) similarityByPeer.set(publicKey, cosineSimilarity);
  }
  if (similarityByPeer.size === 0) return [];

  const viewedByUser = viewerProfile;
  const candidateScores = new Map<string, {
    weightedRating: number;
    totalWeight: number;
    similarPeers: Set<string>;
    positivePeers: Set<string>;
  }>();
  for (const vote of votes) {
    const similarity = similarityByPeer.get(vote.publicKey);
    if (
      similarity === undefined
      || viewedByUser.has(vote.contributionCid)
      || vote.publicKey === viewerPublicKey
    ) continue;
    const candidate = candidateScores.get(vote.contributionCid) ?? {
      weightedRating: 0,
      totalWeight: 0,
      similarPeers: new Set<string>(),
      positivePeers: new Set<string>(),
    };
    const rating = vote.direction === 'up' ? 1 : -1;
    candidate.weightedRating += similarity * rating;
    candidate.totalWeight += similarity;
    candidate.similarPeers.add(vote.publicKey);
    if (rating > 0) candidate.positivePeers.add(vote.publicKey);
    candidateScores.set(vote.contributionCid, candidate);
  }

  const itemByCid = new Map(items.map((item) => [item.cid, item]));
  const recommendations: Array<CollaborativeRecommendation<T>> = [];
  for (const [cid, candidate] of candidateScores) {
    const item = itemByCid.get(cid);
    if (!item || item.authorPublicKey === viewerPublicKey || candidate.weightedRating <= 0) continue;
    const preference = candidate.weightedRating / candidate.totalWeight;
    const confidence = candidate.totalWeight / (candidate.totalWeight + 1);
    recommendations.push({
      ...item,
      recommendationScore: preference * confidence,
      similarPeers: candidate.similarPeers.size,
      positivePeers: candidate.positivePeers.size,
    });
  }
  return recommendations.sort((a, b) => (
    b.recommendationScore - a.recommendationScore
    || (b.score ?? 0) - (a.score ?? 0)
    || a.cid.localeCompare(b.cid)
  ));
}

export function deduplicateVotes(events: readonly VoteEvent[]): VoteEvent[] {
  const canonical = [...events].sort((a, b) => a.cid.localeCompare(b.cid));
  const byVoter = new Map<string, VoteEvent>();
  for (const event of canonical) {
    const key = `${event.contributionCid}\0${event.publicKey}`;
    if (!byVoter.has(key)) byVoter.set(key, event);
  }
  return [...byVoter.values()];
}

export function wilsonLowerBound(upvotes: number, downvotes: number, z = 1.96): number {
  if (
    !Number.isSafeInteger(upvotes) || upvotes < 0
    || !Number.isSafeInteger(downvotes) || downvotes < 0
    || !Number.isFinite(z) || z <= 0
  ) {
    throw new RangeError('Les votes et z doivent être des valeurs finies positives.');
  }
  const total = upvotes + downvotes;
  if (total === 0) return 0;
  const proportion = upvotes / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const center = proportion + zSquared / (2 * total);
  const margin = z * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * total)) / total);
  return Math.max(0, (center - margin) / denominator);
}

export function reliabilityStatus(
  upvotes: number,
  downvotes: number,
  minimumVotes = 20,
  threshold = 0.75,
): { status: ContributionStatus; score: number; totalVotes: number } {
  if (
    !Number.isSafeInteger(minimumVotes) || minimumVotes < 1
    || !Number.isFinite(threshold) || threshold < 0 || threshold > 1
  ) {
    throw new RangeError('Le minimum de votes et le seuil de fiabilité sont invalides.');
  }
  const totalVotes = upvotes + downvotes;
  const score = wilsonLowerBound(upvotes, downvotes);
  return {
    status: totalVotes < minimumVotes ? 'pending' : score >= threshold ? 'validated' : 'contested',
    score,
    totalVotes,
  };
}
