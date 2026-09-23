import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCandidateSchema, registerCompanySchema, loginSchema } from '../../src/shared/schemas/auth.schema.js';
import { createJobSchema, updateJobSchema } from '../../src/shared/schemas/job.schema.js';

test('auth validation: rejects password under 8 characters', () => {
  const result = registerCandidateSchema.safeParse({
    email: 'valid@example.com',
    password: 'pass1',
    fullName: 'John Doe',
  });
  assert.equal(result.success, false);
});

test('auth validation: rejects password with 8 characters but no numbers', () => {
  const result = registerCandidateSchema.safeParse({
    email: 'valid@example.com',
    password: 'passwordonly',
    fullName: 'John Doe',
  });
  assert.equal(result.success, false);
});

test('auth validation: accepts strong 8+ character password with letters and numbers', () => {
  const result = registerCandidateSchema.safeParse({
    email: 'valid@example.com',
    password: 'ValidPassword123',
    fullName: 'John Doe',
  });
  assert.equal(result.success, true);
});

test('auth validation: rejects malformed email in registration and login', () => {
  const regResult = registerCandidateSchema.safeParse({
    email: 'notanemail',
    password: 'ValidPassword123',
    fullName: 'John Doe',
  });
  assert.equal(regResult.success, false);

  const loginResult = loginSchema.safeParse({
    email: 'notanemail',
    password: 'anyPassword',
  });
  assert.equal(loginResult.success, false);
});

test('job validation: validates 7 new fields with defaults and constraints', () => {
  const validJob = {
    title: 'Senior Software Engineer',
    description: 'We are looking for an experienced engineer.',
    workMode: 'Hybrid',
    openings: 3,
    jobLevel: 'Senior',
    noticePeriod: '30 days',
    salaryRange: '₹12–18 LPA',
    languagesRequired: ['English', 'Hindi'],
    certifications: ['AWS Certified Developer'],
    minimumExperience: 3,
  };

  const parsed = createJobSchema.parse(validJob);
  assert.equal(parsed.workMode, 'Hybrid');
  assert.equal(parsed.openings, 3);
  assert.equal(parsed.jobLevel, 'Senior');
  assert.equal(parsed.noticePeriod, '30 days');
  assert.equal(parsed.salaryRange, '₹12–18 LPA');
  assert.deepEqual(parsed.languagesRequired, ['English', 'Hindi']);
  assert.deepEqual(parsed.certifications, ['AWS Certified Developer']);
});

test('job validation: requires openings to be at least 1', () => {
  const invalidJob = {
    title: 'Software Engineer',
    description: 'Job description text.',
    openings: 0,
  };
  const result = createJobSchema.safeParse(invalidJob);
  assert.equal(result.success, false);
});
