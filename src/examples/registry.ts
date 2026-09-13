import { buildSumRun, parseSumInput, sumLesson } from './sum-recursive';
import { buildLinearRun, linearDemoCommands, linearLessons } from './linear';
import { buildSearchRun, graphLesson } from './graph-search';
import { graphSamples } from '../structures/graph';
import { buildFunctionRun, functionExamples } from './functions';

/** 실행 가능한 예제만 등록한다. 개발 예정 모듈은 docs/ROADMAP.md에서 관리한다. */
export const examples = {
  [sumLesson.id]: { lesson: sumLesson, parseInput: parseSumInput, buildRun: buildSumRun },
  'sum-iterative': {
    lesson: functionExamples.sum.lesson,
    buildRun: (n: number) => buildFunctionRun('sum', 'iterative', n),
  },
  'factorial-recursive': {
    lesson: functionExamples.factorial.lesson,
    buildRun: (n: number) => buildFunctionRun('factorial', 'recursive', n),
  },
  'factorial-iterative': {
    lesson: functionExamples.factorial.lesson,
    buildRun: (n: number) => buildFunctionRun('factorial', 'iterative', n),
  },
  'fibonacci-recursive': {
    lesson: functionExamples.fibonacci.lesson,
    buildRun: (n: number) => buildFunctionRun('fibonacci', 'recursive', n),
  },
  'fibonacci-iterative': {
    lesson: functionExamples.fibonacci.lesson,
    buildRun: (n: number) => buildFunctionRun('fibonacci', 'iterative', n),
  },
  'function-scope': {
    lesson: functionExamples.scope.lesson,
    buildRun: (n: number) => buildFunctionRun('scope', 'recursive', n),
  },
  'queue-bank': {
    lesson: linearLessons.queue,
    buildRun: () => buildLinearRun('queue', linearDemoCommands),
  },
  'stack-rail': {
    lesson: linearLessons.stack,
    buildRun: () => buildLinearRun('stack', linearDemoCommands),
  },
  'graph-bfs': {
    lesson: graphLesson,
    buildRun: () =>
      buildSearchRun('bfs', { graph: graphSamples.cycle, start: 'A', target: 'F', reverse: false }),
  },
  'graph-dfs': {
    lesson: graphLesson,
    buildRun: () =>
      buildSearchRun('dfs', { graph: graphSamples.cycle, start: 'A', target: 'F', reverse: false }),
  },
  'tree-bfs': {
    lesson: graphLesson,
    buildRun: () =>
      buildSearchRun('bfs', {
        graph: graphSamples.tree,
        start: 'A',
        target: 'F',
        reverse: false,
        treeRoot: 'A',
      }),
  },
  'tree-dfs': {
    lesson: graphLesson,
    buildRun: () =>
      buildSearchRun('dfs', {
        graph: graphSamples.tree,
        start: 'A',
        target: 'F',
        reverse: false,
        treeRoot: 'A',
      }),
  },
} as const;
