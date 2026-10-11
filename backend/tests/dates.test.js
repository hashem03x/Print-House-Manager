import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidTimeZone, parseCalendarDate, startOfDayInTimeZone } from '../src/utils/dates.js';

test('parseCalendarDate stores calendar dates as UTC midnight', () => {
  assert.equal(parseCalendarDate('2026-10-20').toISOString(), '2026-10-20T00:00:00.000Z');
  assert.equal(parseCalendarDate('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z');
  assert.equal(parseCalendarDate('2026-10-20T23:59:00-08:00').toISOString(), '2026-10-20T00:00:00.000Z');
});

test('parseCalendarDate rejects invalid input', () => {
  for (const value of ['2026-02-30', '2025-02-29', '2026-13-01', '20-10-2026', '', 'today', 123, null, undefined]) {
    assert.equal(parseCalendarDate(value), null, String(value));
  }
});

test('startOfDayInTimeZone handles fixed and DST zones', () => {
  // 01:30 UTC on 11 Oct = 04:30 in Cairo (UTC+3 in summer) -> midnight Cairo = 21:00 UTC on 10 Oct
  assert.equal(
    startOfDayInTimeZone(new Date('2026-10-11T01:30:00Z'), 'Africa/Cairo').toISOString(),
    '2026-10-10T21:00:00.000Z'
  );
  assert.equal(startOfDayInTimeZone(new Date('2026-10-11T23:59:59Z'), 'UTC').toISOString(), '2026-10-11T00:00:00.000Z');
  // New York on a DST change day (clocks go back 1 Nov 2026): midnight is still EDT (UTC-4)
  assert.equal(
    startOfDayInTimeZone(new Date('2026-11-01T20:00:00Z'), 'America/New_York').toISOString(),
    '2026-11-01T04:00:00.000Z'
  );
});

test('isValidTimeZone', () => {
  assert.equal(isValidTimeZone('Africa/Cairo'), true);
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
});
