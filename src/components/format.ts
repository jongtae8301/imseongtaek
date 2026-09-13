import type { DeepReadonly, RuntimeValue, StepEvent } from '../engine/types';

export function formatValue(item: DeepReadonly<RuntimeValue> | undefined): string {
  if (!item || item.kind === 'unset') return '아직 없음';
  if (item.kind === 'none') return 'None · 반환값 없음';
  return JSON.stringify(item.value);
}
export const eventLabels: Record<StepEvent, string> = {
  initial: '준비',
  call: '호출',
  return: '복귀',
  assign: '대입',
  scope: '범위 지정',
  compare: '비교',
  arithmetic: '산술',
  insert: '삽입',
  remove: '삭제',
  reject: '거절',
  visit: '방문',
  discover: '발견',
  edge: '이웃 확인',
  process: '처리 완료',
  prune: '배제',
  reuse: '재사용',
  complete: '종료',
  error: '오류',
  limit: '한도 도달',
  cancel: '중단',
};
