import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExperienceTier,
  bucketAnswerStrength,
  nextDifficulty,
} from '../../src/server/modules/interviews/interviewDifficulty.util.js';

test('computeExperienceTier boundaries', () => {
  assert.equal(computeExperienceTier(0), 'FRESHER');
  assert.equal(computeExperienceTier(0.99), 'FRESHER');
  assert.equal(computeExperienceTier(1), 'JUNIOR');
  assert.equal(computeExperienceTier(2.99), 'JUNIOR');
  assert.equal(computeExperienceTier(3), 'MID');
  assert.equal(computeExperienceTier(5.99), 'MID');
  assert.equal(computeExperienceTier(6), 'SENIOR');
  assert.equal(computeExperienceTier(10), 'SENIOR');
});

test('bucketAnswerStrength boundaries', () => {
  assert.equal(bucketAnswerStrength(0), 'WEAK');
  assert.equal(bucketAnswerStrength(39), 'WEAK');
  assert.equal(bucketAnswerStrength(40), 'ADEQUATE');
  assert.equal(bucketAnswerStrength(74), 'ADEQUATE');
  assert.equal(bucketAnswerStrength(75), 'STRONG');
  assert.equal(bucketAnswerStrength(100), 'STRONG');
  assert.equal(bucketAnswerStrength(undefined), 'WEAK');
});

test('nextDifficulty full rule table', () => {
  const cases = [
    ['EASY', 'STRONG', 'MEDIUM'],
    ['EASY', 'ADEQUATE', 'EASY'],
    ['EASY', 'WEAK', 'EASY'], // clamped at the floor
    ['MEDIUM', 'STRONG', 'HARD'],
    ['MEDIUM', 'ADEQUATE', 'MEDIUM'],
    ['MEDIUM', 'WEAK', 'EASY'],
    ['HARD', 'STRONG', 'HARD'], // clamped at the ceiling
    ['HARD', 'ADEQUATE', 'HARD'],
    ['HARD', 'WEAK', 'MEDIUM'],
  ];
  for (const [current, strength, expected] of cases) {
    assert.equal(nextDifficulty(current, strength), expected, `${current} + ${strength} -> ${expected}`);
  }
});

test('nextDifficulty defaults an unrecognized current level to MEDIUM', () => {
  assert.equal(nextDifficulty(null, 'STRONG'), 'HARD');
  assert.equal(nextDifficulty(undefined, 'WEAK'), 'EASY');
});
