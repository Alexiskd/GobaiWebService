import test from 'node:test';
import assert from 'node:assert/strict';
import { ecefToEnu, enuToScene, geodeticToEcef } from './geodesy.ts';
import { collaborativeRank, deduplicateVotes, hotScore, rank, reliabilityStatus, wilsonLowerBound } from './scoring.ts';

test('geodesy: an anchor maps to its unit-sphere point and has zero local ENU offset', () => {
  const anchor = { latitude: 45.76, longitude: 4.84, altitudeMeters: 180 };
  const ecef = geodeticToEcef(anchor);
  const enu = ecefToEnu(ecef, anchor);
  const scene = enuToScene(enu, anchor);
  const latitude = anchor.latitude * Math.PI / 180;
  const longitude = anchor.longitude * Math.PI / 180;
  const expected = {
    x: Math.cos(latitude) * Math.cos(longitude) * (1 + anchor.altitudeMeters / 6_371_000),
    y: Math.sin(latitude) * (1 + anchor.altitudeMeters / 6_371_000),
    z: -Math.cos(latitude) * Math.sin(longitude) * (1 + anchor.altitudeMeters / 6_371_000),
  };
  assert.ok(Math.hypot(scene.x - expected.x, scene.y - expected.y, scene.z - expected.z) < 1e-12);
  assert.ok(Math.hypot(enu.east, enu.north, enu.up) < 1e-8);
});

test('geodesy: one meter east, north and up remain orthogonal and scale to the Earth scene', () => {
  const anchor = { latitude: 0, longitude: 0, altitudeMeters: 0 };
  const east = enuToScene({ east: 1, north: 0, up: 0 }, anchor);
  const north = enuToScene({ east: 0, north: 1, up: 0 }, anchor);
  const up = enuToScene({ east: 0, north: 0, up: 1 }, anchor);
  assert.ok(Math.abs(Math.hypot(east.x - 1, east.y, east.z) - 1 / 6_371_000) < 1e-12);
  assert.ok(Math.abs(north.y - 1 / 6_371_000) < 1e-12);
  assert.ok(Math.abs(up.x - (1 + 1 / 6_371_000)) < 1e-12);
});

test('geodesy: anchor conversion uses the WGS84 ellipsoid', () => {
  const equator = geodeticToEcef({ latitude: 0, longitude: 0, altitudeMeters: 0 });
  const pole = geodeticToEcef({ latitude: 90, longitude: 0, altitudeMeters: 0 });
  assert.ok(Math.abs(equator[0] - 6_378_137) < 1e-6);
  assert.ok(Math.abs(pole[2] - 6_356_752.314245) < 0.01);
});

test('hot ranking uses the supplied formula and orders recent engagement', () => {
  const now = Date.parse('2026-01-01T02:00:00.000Z');
  const post = {
    createdAt: '2026-01-01T01:00:00.000Z',
    upvotes: 4,
    downvotes: 1,
    comments: 3,
    avgCommentDepth: 1,
    earlyUpvotes: 2,
  };
  const expected = (
    (Math.log10(3) + 1.5 * Math.log10(3) + 0.5 * Math.log10(5.5))
    * (5 / 7)
  ) / Math.pow(3, 1.5);
  assert.ok(Math.abs(hotScore(post, now) - expected) < 1e-12);
  assert.equal(rank([post, { ...post, createdAt: '2025-12-01T00:00:00.000Z' }], now)[0].createdAt, post.createdAt);
});

test('Wilson lower bound gates trust and remains pending below the minimum sample', () => {
  assert.equal(reliabilityStatus(15, 4).status, 'pending');
  assert.equal(reliabilityStatus(20, 0).status, 'validated');
  assert.equal(reliabilityStatus(10, 10).status, 'contested');
  assert.ok(wilsonLowerBound(20, 0) > wilsonLowerBound(10, 10));
});

test('duplicate signed votes count once per pseudonymous key, deterministically', () => {
  const events = [
    { cid: 'b', contributionCid: 'c1', publicKey: 'pk1', direction: 'up' as const, signature: 's1' },
    { cid: 'a', contributionCid: 'c1', publicKey: 'pk1', direction: 'down' as const, signature: 's2' },
    { cid: 'c', contributionCid: 'c1', publicKey: 'pk2', direction: 'up' as const, signature: 's3' },
    { cid: 'd', contributionCid: 'c2', publicKey: 'pk1', direction: 'up' as const, signature: 's4' },
  ];
  assert.deepEqual(deduplicateVotes(events).map((vote) => vote.cid), ['a', 'c', 'd']);
});

test('collaborative ranking recommends unseen items liked by positive-similarity peers', () => {
  const votes = [
    { cid: 'v1', contributionCid: 'item-a', publicKey: 'viewer', direction: 'up' as const, signature: 's' },
    { cid: 'v2', contributionCid: 'item-b', publicKey: 'viewer', direction: 'down' as const, signature: 's' },
    { cid: 'p1', contributionCid: 'item-a', publicKey: 'similar', direction: 'up' as const, signature: 's' },
    { cid: 'p2', contributionCid: 'item-b', publicKey: 'similar', direction: 'down' as const, signature: 's' },
    { cid: 'p3', contributionCid: 'item-c', publicKey: 'similar', direction: 'up' as const, signature: 's' },
    { cid: 'p4', contributionCid: 'item-own', publicKey: 'similar', direction: 'up' as const, signature: 's' },
    { cid: 'o1', contributionCid: 'item-a', publicKey: 'opposite', direction: 'down' as const, signature: 's' },
    { cid: 'o2', contributionCid: 'item-b', publicKey: 'opposite', direction: 'up' as const, signature: 's' },
    { cid: 'o3', contributionCid: 'item-d', publicKey: 'opposite', direction: 'up' as const, signature: 's' },
    { cid: 'l1', contributionCid: 'item-a', publicKey: 'low-overlap', direction: 'up' as const, signature: 's' },
    { cid: 'l2', contributionCid: 'item-e', publicKey: 'low-overlap', direction: 'up' as const, signature: 's' },
  ];
  const items: Array<{ cid: string; score: number; authorPublicKey?: string }> =
    ['item-a', 'item-b', 'item-c', 'item-d', 'item-e'].map((cid) => ({ cid, score: 0 }));
  items.push({ cid: 'item-own', authorPublicKey: 'viewer', score: 0 });
  const recommendations = collaborativeRank(items, votes, 'viewer');
  assert.deepEqual(recommendations.map((item) => item.cid), ['item-c']);
  assert.equal(recommendations[0].similarPeers, 1);
  assert.equal(recommendations[0].positivePeers, 1);
  assert.ok(recommendations[0].recommendationScore > 0);
});

test('collaborative ranking returns no suggestions for a cold-start profile', () => {
  const votes = [
    { cid: 'v1', contributionCid: 'item-a', publicKey: 'viewer', direction: 'up' as const, signature: 's' },
    { cid: 'p1', contributionCid: 'item-a', publicKey: 'peer', direction: 'up' as const, signature: 's' },
    { cid: 'p2', contributionCid: 'item-b', publicKey: 'peer', direction: 'up' as const, signature: 's' },
  ];
  assert.deepEqual(collaborativeRank([{ cid: 'item-b' }], votes, 'viewer'), []);
  assert.deepEqual(collaborativeRank([{ cid: 'item-b' }], votes, undefined), []);
});
