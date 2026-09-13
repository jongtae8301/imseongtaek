import { expect, it } from 'vitest';
import { formatValue } from './format';
import { value } from '../engine/types';

it('미생성·반환값 없음·0·빈 문자열·빈 구조를 서로 구분한다', () => {
  expect([
    formatValue({ kind: 'unset' }),
    formatValue({ kind: 'none' }),
    formatValue(value(0)),
    formatValue(value('')),
    formatValue(value([])),
  ]).toEqual(['아직 없음', 'None · 반환값 없음', '0', '""', '[]']);
});
