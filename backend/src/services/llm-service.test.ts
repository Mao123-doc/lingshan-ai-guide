import assert from 'node:assert/strict';
import {
  assessModelIdentity,
  buildLLMCallResult,
  extractProviderModel,
} from './llm-service';

assert.equal(extractProviderModel({ model: 'deepseek-flash' }), 'deepseek-flash');
assert.equal(extractProviderModel({ choices: [{ message: { content: 'OK' } }] }), undefined);

assert.deepEqual(
  assessModelIdentity('deepseek-chat', 'deepseek-chat'),
  { status: 'match', requestedModel: 'deepseek-chat', providerModel: 'deepseek-chat' },
);
assert.deepEqual(
  assessModelIdentity('deepseek-chat', 'deepseek-flash'),
  { status: 'mismatch', requestedModel: 'deepseek-chat', providerModel: 'deepseek-flash' },
);
assert.deepEqual(
  assessModelIdentity('deepseek-chat', undefined),
  { status: 'unknown', requestedModel: 'deepseek-chat', providerModel: undefined },
);

assert.deepEqual(
  buildLLMCallResult('OK', 'deepseek-chat', { model: 'deepseek-flash' }),
  {
    content: 'OK',
    modelIdentity: {
      status: 'mismatch',
      requestedModel: 'deepseek-chat',
      providerModel: 'deepseek-flash',
    },
  },
);

console.log('LLM model identity tests passed');
