export type ContributionStatus = 'pending' | 'validated' | 'contested';

export interface Bounds3D {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface LasMetadata {
  version: string;
  pointFormat: number;
  pointCount: number;
  pointDataOffset: number;
  pointRecordLength: number;
  compressed: boolean;
  scale: [number, number, number];
  offset: [number, number, number];
  bounds: Bounds3D;
  crsWkt: string | null;
}

export interface GeodeticAnchor {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
}

export interface HotPost {
  createdAt: string;
  upvotes: number;
  downvotes: number;
  comments: number;
  avgCommentDepth: number;
  upvoteTimes?: string[];
  earlyUpvotes?: number;
}

export interface VoteEvent {
  cid: string;
  contributionCid: string;
  publicKey: string;
  direction: 'up' | 'down';
  signature: string;
}

export interface ContributionManifest {
  schemaVersion: 1;
  title: string;
  pseudonym?: string;
  filename: string;
  fileCid: string;
  chunkCids: string[];
  pointCount: number;
  bounds: Bounds3D;
  crsWkt: string | null;
  anchor: GeodeticAnchor;
  dimensionsMeters: [number, number, number];
  sourceDimensionsMeters?: [number, number, number];
  createdAt: string;
  previousVersionCid: string | null;
}

export interface SignedEvent<T> {
  schemaVersion: 1;
  kind: 'contribution' | 'vote' | 'comment';
  cid: string;
  publicKey: string;
  createdAt: string;
  payload: T;
  nonce: number;
  difficulty: number;
  signature: string;
}
