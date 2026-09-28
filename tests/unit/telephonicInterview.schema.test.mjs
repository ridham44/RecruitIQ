import test from 'node:test';
import assert from 'node:assert/strict';
import {
  phoneNumberSchema,
  bookSlotSchema,
  createSlotsSchema,
  generateSlotsSchema,
} from '../../src/shared/schemas/scheduling.schema.js';
import { callStatusUpdateSchema } from '../../src/shared/schemas/interview.schema.js';

test('phone number: accepts E.164 and strips spaces, dashes and brackets', () => {
  assert.equal(phoneNumberSchema.parse('+919876543210'), '+919876543210');
  assert.equal(phoneNumberSchema.parse('+91 98765-43210'), '+919876543210');
  assert.equal(phoneNumberSchema.parse('+1 (415) 555-0100'), '+14155550100');
});

test('phone number: rejects numbers without country code or with bad length', () => {
  for (const value of ['9876543210', '+0123456789', '+91', '+1234567890123456', 'call me', '']) {
    assert.equal(phoneNumberSchema.safeParse(value).success, false, `should reject "${value}"`);
  }
});

test('booking: phoneNumber is optional (only PHONE slots require it, checked in bookSlot)', () => {
  assert.equal(bookSlotSchema.safeParse({ slotId: 'abc' }).success, true);
  assert.equal(bookSlotSchema.parse({ slotId: 'abc', phoneNumber: '+91 98765 43210' }).phoneNumber, '+919876543210');
  assert.equal(bookSlotSchema.safeParse({ slotId: 'abc', phoneNumber: '12345' }).success, false);
});

test('slots: mode defaults to ONLINE so existing clients are unaffected', () => {
  const start = new Date('2026-10-01T10:00:00Z');
  const end = new Date('2026-10-01T10:15:00Z');
  assert.equal(createSlotsSchema.parse({ slots: [{ startTime: start, endTime: end }] }).slots[0].mode, 'ONLINE');
  assert.equal(createSlotsSchema.parse({ slots: [{ startTime: start, endTime: end, mode: 'PHONE' }] }).slots[0].mode, 'PHONE');
  assert.equal(generateSlotsSchema.parse({ rangeStart: start, rangeEnd: end, durationMinutes: 15 }).mode, 'ONLINE');
  assert.equal(createSlotsSchema.safeParse({ slots: [{ startTime: start, endTime: end, mode: 'VIDEO' }] }).success, false);
});

test('call status: only known phone-agent statuses are accepted', () => {
  for (const status of ['DIALING', 'IN_CALL', 'NO_ANSWER', 'FAILED', 'DROPPED', 'COMPLETED']) {
    assert.equal(callStatusUpdateSchema.safeParse({ status }).success, true, status);
  }
  assert.equal(callStatusUpdateSchema.safeParse({ status: 'PENDING' }).success, false);
});
