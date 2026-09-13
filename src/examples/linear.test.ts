import { describe, expect, it } from 'vitest';
import { buildLinearRun, linearDemoCommands } from './linear';
import type { LinearCommand, LinearMode } from '../structures/linear';
import { createPlayer } from '../player/controller';
import { value } from '../engine/types';

describe.each<LinearMode>(['queue', 'stack'])('%s Step 실행기', (mode) => {
  it('조건 검사 후 실제 조작하며 예제의 마지막 반환 순서가 일치한다', () => {
    const run = buildLinearRun(mode, linearDemoCommands);
    expect(run.steps).toHaveLength(18);
    expect(run.steps.slice(1, 5).map((step) => step.event)).toEqual([
      'compare',
      'insert',
      'compare',
      'insert',
    ]);
    expect(run.steps[1]!.structures[0]).toMatchObject({ items: [] });
    expect(run.steps[2]!.structures[0]).toMatchObject({ items: [1] });
    expect(run.steps.at(-1)!.status).toBe('completed');
    expect(run.steps.at(-1)!.structures[0]).toMatchObject({
      items: [],
      removedValues: mode === 'queue' ? [1, 2, 3, 4] : [4, 3, 2, 1],
    });
    expect(run.steps.at(-1)!.metrics).toMatchObject({
      inserts: 4,
      removes: 4,
      comparisons: 8,
      assignments: 4,
      rejected: 0,
      maxSize: 4,
    });
  });
  it('Python의 조건·성공 분기·실패 분기와 강조 줄이 일치한다', () => {
    const run = buildLinearRun(
      mode,
      [
        { type: 'remove' },
        { type: 'insert', value: 0 },
        { type: 'insert', value: 9 },
        { type: 'remove' },
      ],
      { capacity: 1 },
    );
    for (const step of run.steps) {
      if (!step.source) continue;
      const code = run.metadata.code.lines[step.source.line - 1]!;
      if (step.event === 'compare') expect(code).toMatch(/^if /);
      if (step.event === 'reject') expect(code).toContain('print(');
      if (step.event === 'insert') {
        expect(code).toContain('.append(item)');
        expect(step.globals.item).toEqual(value(0));
      }
      if (step.event === 'remove')
        expect(code).toContain(mode === 'queue' ? '.popleft()' : '.pop()');
    }
    expect(run.steps[2]!.metrics).toMatchObject({ removes: 0, rejected: 1 });
    expect(run.steps[6]!.structures[0]).toMatchObject({
      items: [0],
      transition: { action: 'reject' },
    });
    expect(run.steps[8]!.returnValue).toEqual(value(0));
    expect(run.steps[8]!.globals.removed).toEqual(value(0));
    expect(run.steps[8]!.returnInfo).toBeNull();
  });
  it('직접 조작과 예제 모드의 중간 스냅샷은 같다', () => {
    const direct = buildLinearRun(mode, linearDemoCommands, { direct: true });
    const demo = buildLinearRun(mode, linearDemoCommands);
    expect(direct.steps.slice(1)).toEqual(demo.steps.slice(1, -1));
    expect(direct.steps.at(-1)!.status).toBe('running');
    expect(direct).toEqual(buildLinearRun(mode, linearDemoCommands, { direct: true }));
    expect(JSON.parse(JSON.stringify(direct))).toEqual(direct);
    const structure = direct.steps[2]!.structures[0]!;
    if (structure.kind !== 'sequence') throw new Error('선형 구조 누락');
    expect(Object.isFrozen(structure.items)).toBe(true);
  });
  it('되돌리기 시 포인터·반환값·삭제 기록·집계가 함께 복원된다', () => {
    const run = buildLinearRun(mode, [{ type: 'insert', value: 0 }, { type: 'remove' }]);
    const player = createPlayer(run);
    player.seek(4);
    const after = player.getSnapshot().run!.steps[4];
    player.previous();
    expect(run.steps[player.getSnapshot().index]!.globals.removed).toEqual({ kind: 'unset' });
    expect(run.steps[player.getSnapshot().index]!.metrics.removes).toBe(0);
    player.next();
    expect(run.steps[player.getSnapshot().index]).toBe(after);
  });
  it('요청을 추가해도 코드와 지난 단계는 유지하고 삽입 입력만 복원한다', () => {
    const first = buildLinearRun(mode, [{ type: 'insert', value: 0 }], { direct: true });
    const commands: LinearCommand[] = [
      { type: 'insert', value: 0 },
      { type: 'insert', value: -7 },
      { type: 'remove' },
    ];
    const run = buildLinearRun(mode, commands, { direct: true });
    expect(run.metadata.code).toEqual(first.metadata.code);
    expect(run.metadata.lineMap).toEqual(first.metadata.lineMap);
    expect(run.steps.slice(0, first.steps.length)).toEqual(first.steps);
    expect(run.steps[2]!.source).toEqual(run.steps[4]!.source);
    expect(run.steps[3]!.globals.item).toEqual(value(-7));
    expect(run.steps[3]!.changes).toContainEqual({
      path: 'globals.item',
      before: value(0),
      after: value(-7),
      description: '이번 삽입 입력 item = -7',
    });
    const player = createPlayer(run);
    player.seek(3);
    player.previous();
    expect(run.steps[player.getSnapshot().index]!.globals.item).toEqual(value(0));
    player.next();
    expect(run.steps[player.getSnapshot().index]!.globals.item).toEqual(value(-7));
    const many = buildLinearRun(
      mode,
      Array.from({ length: 40 }, () => ({ type: 'remove' })),
    );
    expect(many.metadata.code).toEqual(first.metadata.code);
  });
  it('실행 한도에서는 마지막으로 완료한 사건의 구조만 남긴다', () => {
    const run = buildLinearRun(mode, linearDemoCommands, { maxSteps: 3 });
    expect(run.steps).toHaveLength(3);
    expect(run.steps.at(-1)!).toMatchObject({
      status: 'limit-reached',
      metrics: { comparisons: 1, inserts: 0 },
    });
    expect(run.steps.at(-1)!.structures[0]).toMatchObject({ items: [] });
  });
});

it('40회 직접 조작은 81개 스냅샷이며 41회는 제한한다', () => {
  const commands: LinearCommand[] = Array.from({ length: 40 }, () => ({ type: 'remove' }));
  const run = buildLinearRun('queue', commands, { direct: true });
  expect(run.steps).toHaveLength(81);
  expect(run.steps.at(-1)!.metrics.rejected).toBe(40);
  expect(() => buildLinearRun('queue', [...commands, { type: 'remove' }])).toThrow(RangeError);
});
