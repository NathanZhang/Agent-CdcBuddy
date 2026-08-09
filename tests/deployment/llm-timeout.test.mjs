import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRouterTimeoutMs,
  getText2SqlTimeoutMs,
  resolveTimeoutMs,
} from '../../src/lib/config/llm-timeout.ts';

test('uses 30000ms when a timeout is missing', () => {
  assert.equal(resolveTimeoutMs(undefined), 30_000);
});

test('accepts a finite positive integer timeout', () => {
  assert.equal(resolveTimeoutMs('45000'), 45_000);
});

test('rejects invalid timeout values', () => {
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity']) {
    assert.equal(resolveTimeoutMs(value), 30_000, `expected ${value || 'empty'} to use the default`);
  }
});

test('reads separate router and Text2SQL variables', () => {
  const env = {
    SILICONFLOW_ROUTER_TIMEOUT_MS: '31000',
    SILICONFLOW_TEXT2SQL_TIMEOUT_MS: '32000',
  };

  assert.equal(getRouterTimeoutMs(env), 31_000);
  assert.equal(getText2SqlTimeoutMs(env), 32_000);
});
