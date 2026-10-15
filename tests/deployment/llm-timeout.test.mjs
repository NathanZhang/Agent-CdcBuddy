import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRouterTimeoutMs,
  getText2SqlTimeoutMs,
  resolveTimeoutMs,
  getLLMTimeouts,
} from '../../src/lib/config/llm-timeout.ts';

test('uses 300000ms when a timeout is missing', () => {
  assert.equal(resolveTimeoutMs(undefined), 300_000);
});

test('accepts a finite positive integer timeout', () => {
  assert.equal(resolveTimeoutMs('45000'), 45_000);
});

test('rejects invalid timeout values', () => {
  for (const value of ['', '0', '-1', '1.5', 'NaN', 'Infinity', '2147483648', '9007199254740992']) {
    assert.equal(resolveTimeoutMs(value), 300_000, `expected ${value || 'empty'} to use the default`);
  }
});

test('separates first output, idle and non-stream compatibility budgets', () => {
  assert.deepEqual(getLLMTimeouts({}), {firstOutputMs:300000,idleMs:180000,nonStreamMs:300000});
  assert.deepEqual(getLLMTimeouts({SILICONFLOW_ROUTER_TIMEOUT_MS:'31000'}), {firstOutputMs:31000,idleMs:31000,nonStreamMs:31000});
  assert.deepEqual(getLLMTimeouts({SILICONFLOW_TEXT2SQL_TIMEOUT_MS:'32000'},'text2sql'), {firstOutputMs:32000,idleMs:32000,nonStreamMs:32000});
  const env={SILICONFLOW_FIRST_OUTPUT_TIMEOUT_MS:'300000',SILICONFLOW_IDLE_TIMEOUT_MS:'180000',SILICONFLOW_NON_STREAM_TIMEOUT_MS:'400000',SILICONFLOW_ROUTER_TIMEOUT_MS:'1000'};
  assert.deepEqual(getLLMTimeouts(env), {firstOutputMs:300000,idleMs:180000,nonStreamMs:400000});
  assert.deepEqual(getLLMTimeouts({SILICONFLOW_FIRST_OUTPUT_TIMEOUT_MS:'0',SILICONFLOW_IDLE_TIMEOUT_MS:'Infinity'}), {firstOutputMs:300000,idleMs:180000,nonStreamMs:300000});
});

test('reads separate router and Text2SQL variables', () => {
  const env = {
    SILICONFLOW_ROUTER_TIMEOUT_MS: '31000',
    SILICONFLOW_TEXT2SQL_TIMEOUT_MS: '32000',
  };

  assert.equal(getRouterTimeoutMs(env), 31_000);
  assert.equal(getText2SqlTimeoutMs(env), 32_000);
});
