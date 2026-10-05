import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionalPhoneSchema,
  phoneSchema,
  optionalUrlSchema,
  personNameSchema,
  emailSchema,
  tagListSchema,
  checkForm,
} from '../../src/shared/schemas/common.js';
import { createClientSchema } from '../../src/shared/schemas/client.schema.js';
import { createJobSchema, updateJobSchema } from '../../src/shared/schemas/job.schema.js';
import { educationSchema } from '../../src/shared/schemas/education.schema.js';
import { createSlotsSchema, generateSlotsSchema } from '../../src/shared/schemas/scheduling.schema.js';
import { passwordSchema } from '../../src/shared/schemas/auth.schema.js';

const ok = (schema, v) => schema.safeParse(v).success;
const msg = (schema, v) => schema.safeParse(v).error?.issues[0]?.message;

test('phone: rejects a repeated country code and junk', () => {
  assert.equal(msg(optionalPhoneSchema, '+39+39 319 123 4567'), 'Use only one + at the start, before the country code');
  for (const bad of ['12ab34', '123', '+', '++39 3191234567', '39+3191234567', '+1234567890123456']) {
    assert.equal(ok(optionalPhoneSchema, bad), false, bad);
  }
});

test('phone: accepts real formats and tidies spaces', () => {
  for (const good of ['+39 319 123 4567', '+1 (415) 555-0100', '98765 43210', '+91-98765-43210', '0039 319 1234567']) {
    assert.equal(ok(optionalPhoneSchema, good), true, good);
  }
  assert.equal(optionalPhoneSchema.parse('  +44  20 7946 0958 '), '+44 20 7946 0958');
  assert.equal(ok(optionalPhoneSchema, ''), true);
  assert.equal(ok(phoneSchema, ''), false);
});

test('url: only http(s) with a real domain', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', 'http://localhost', 'ferrari.com']) {
    assert.equal(ok(optionalUrlSchema, bad), false, bad);
  }
  assert.equal(ok(optionalUrlSchema, 'https://ferrari.com'), true);
  assert.equal(ok(optionalUrlSchema, ''), true);
});

test('names, emails and tag lists', () => {
  assert.equal(ok(personNameSchema('Name'), 'José Ñúñez'), true);
  assert.equal(ok(personNameSchema('Name'), "O'Brien-Smith"), true);
  for (const bad of ['   ', '123', 'Bob<script>', 'R2D2']) assert.equal(ok(personNameSchema('Name'), bad), false, bad);
  assert.equal(emailSchema.parse(' Rachel@Ferrari.COM '), 'rachel@ferrari.com');
  assert.deepEqual(tagListSchema('Skills').parse(['React', ' react ', 'Node.js']), ['React', 'Node.js']);
  assert.equal(ok(tagListSchema('Skills', { maxItems: 2 }), ['a', 'b', 'c']), false);
});

test('company form: field errors map to the right inputs', () => {
  const { data, errors } = checkForm(createClientSchema, {
    name: 'Ferrari',
    contactPhone: '+39+39 319 123 4567',
    website: 'javascript:alert(1)',
    contactEmail: 'nope',
  });
  assert.equal(data, null);
  assert.deepEqual(Object.keys(errors).sort(), ['contactEmail', 'contactPhone', 'website']);
});

test('job: experience range and weights', () => {
  const base = { title: 'Dev', description: 'A long enough description for the job post.' };
  assert.equal(ok(createJobSchema, base), true);
  assert.equal(msg(createJobSchema, { ...base, minimumExperience: 5, maximumExperience: 2 }), "Maximum experience can't be less than minimum experience");
  assert.equal(ok(updateJobSchema, { cvWeight: 0.5, interviewWeight: 0.6 }), false);
  assert.equal(ok(updateJobSchema, { cvWeight: 0.4, interviewWeight: 0.6 }), true);
  assert.equal(ok(createJobSchema, { ...base, openings: 99999 }), false);
});

test('education: end year not before start year', () => {
  assert.equal(msg(educationSchema, { degree: 'B.Tech', startYear: 2022, endYear: 2020 }), "End year can't be before the start year");
  assert.equal(ok(educationSchema, { degree: 'B.Tech', startYear: 2020, endYear: 2024 }), true);
  assert.equal(ok(educationSchema, { degree: 'B.Tech', startYear: 2999 }), false);
});

test('slots: no past, no huge ranges', () => {
  const hour = 3600e3;
  const future = Date.now() + 24 * hour;
  assert.equal(ok(createSlotsSchema, { slots: [{ startTime: new Date(future), endTime: new Date(future + hour) }] }), true);
  assert.equal(ok(createSlotsSchema, { slots: [{ startTime: new Date(Date.now() - 24 * hour), endTime: new Date(Date.now() - 23 * hour) }] }), false);
  assert.equal(ok(generateSlotsSchema, { rangeStart: new Date(future), rangeEnd: new Date(future + 400 * 24 * hour), durationMinutes: 5 }), false);
});

test('password: bcrypt 72-character limit', () => {
  assert.equal(ok(passwordSchema, 'abc12345'), true);
  assert.equal(ok(passwordSchema, `a1${'x'.repeat(80)}`), false);
});
