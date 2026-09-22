import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deterministicCleanup,
  isCorrectionTooDivergent,
} from '../../src/server/ai/transcript-normalizer.service.js';

test('deterministicCleanup strips filler words', () => {
  assert.equal(deterministicCleanup('um I use, uh, React for the frontend'), 'I use, React for the frontend');
});

test('deterministicCleanup collapses repeated words', () => {
  assert.equal(deterministicCleanup('I I think the the component re-renders'), 'I think the component re-renders');
});

test('deterministicCleanup is idempotent on already-clean text', () => {
  const clean = 'I use useState to manage state in React.';
  assert.equal(deterministicCleanup(clean), clean);
});

test('deterministicCleanup collapses whitespace and empty input', () => {
  assert.equal(deterministicCleanup('  too   many   spaces  '), 'too many spaces');
  assert.equal(deterministicCleanup(''), '');
  assert.equal(deterministicCleanup(undefined), '');
});

test('isCorrectionTooDivergent accepts a plausible small technical-term fix', () => {
  const cleaned = 'I use user state to manage data in React.';
  const corrected = 'I use useState to manage data in React.';
  assert.equal(isCorrectionTooDivergent(cleaned, corrected), false);
});

test('isCorrectionTooDivergent rejects a wildly different / longer rewrite', () => {
  const cleaned = 'I use useState for state.';
  const corrected =
    'In my previous role I extensively used React hooks including useState, useEffect, useMemo, and useCallback to build scalable applications.';
  assert.equal(isCorrectionTooDivergent(cleaned, corrected), true);
});

test('isCorrectionTooDivergent rejects empty or undefined corrections', () => {
  assert.equal(isCorrectionTooDivergent('some text', ''), true);
  assert.equal(isCorrectionTooDivergent('some text', undefined), true);
  assert.equal(isCorrectionTooDivergent('some text', '   '), true);
});
