// Starter content for the built-in demo site (/sample-app).
import {createBlock} from './blocks';
import type {Block} from './studio-types';

export function isDemoBaseUrl(baseUrl: string): boolean {
  return /\/sample-app\/?$/.test(baseUrl);
}

export function demoTestBlocks(variables: Record<string, string>): Block[] {
  const email = 'USERNAME' in variables ? '{{USERNAME}}' : 'qa.lead@acme.io';
  const expectedUser = 'USERNAME' in variables ? '{{USERNAME}}' : 'qa.lead@acme.io';
  const t = (by: 'testid' | 'role' | 'label', value: string, role?: string) =>
    role ? {by, value, role} : {by, value};
  return [
    {...createBlock('open'), value: '/'},
    {...createBlock('expectTitle'), value: 'Playwright'},
    {...createBlock('fill'), target: t('label', 'Corporate Email'), value: email},
    {...createBlock('click'), target: t('role', 'Authenticate Session', 'button')},
    {...createBlock('expectText'), target: t('testid', 'authenticated-user'), value: expectedUser},
    {...createBlock('click'), target: t('role', 'Acknowledge Banner', 'button')},
    {...createBlock('expectHidden'), target: t('testid', 'mfa-challenge-banner')},
    {...createBlock('fill'), target: t('testid', 'quantity-input'), value: '3'},
    {...createBlock('click'), target: t('testid', 'create-order-submit')},
    {...createBlock('expectText'), target: t('testid', 'latest-order-id'), value: 'ORD-2026-8844'},
    createBlock('screenshot'),
  ];
}
