import type { TreeInfo } from '../structures/graph';

export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** unset: 아직 생성되지 않음, none: 반환값 없음(Python None). */
export type RuntimeValue =
  { kind: 'unset' } | { kind: 'none' } | { kind: 'value'; value: JsonValue };
export const unset = (): RuntimeValue => ({ kind: 'unset' });
export const value = (item: JsonValue): RuntimeValue => ({ kind: 'value', value: item });

export interface SourceLocation {
  codeId: string;
  line: number;
}
export interface Frame {
  id: string;
  functionName: string;
  parentId: string | null;
  parameters: Record<string, RuntimeValue>;
  locals: Record<string, RuntimeValue>;
  callSite: SourceLocation;
  returnTo: SourceLocation;
}
export interface CallNode {
  id: string;
  parentId: string | null;
  label: string;
  depth: number;
  state: 'active' | 'waiting' | 'returned';
  returnValue: RuntimeValue;
}

export interface SequenceTransition {
  action: 'insert' | 'remove' | 'reject';
  requested: 'insert' | 'remove';
  value: number | null;
  before: number[];
  fromIndex: number | null;
  toIndex: number | null;
  reason: string | null;
}
export interface SequenceStructure {
  kind: 'sequence';
  id: string;
  mode: 'queue' | 'stack' | 'array';
  items: JsonValue[];
  pointers: Record<string, number | null>;
  capacity: number;
  removedValues: JsonValue[];
  transition: SequenceTransition | null;
}

/** 두 포인터의 부모 이동과 관찰용 경로. BFS/DFS의 방문 상태와 구분한다. */
export interface TreeDistanceStructure {
  kind: 'tree-distance';
  id: string;
  method: 'depth' | 'array';
  from: string;
  to: string;
  a: string | null;
  b: string | null;
  distance: number | null;
  lca: string | null;
  trailA: string[];
  trailB: string[];
  currentEdge: [string, string] | null;
  path: string[];
}

/** 추가 모듈도 구조 데이터만 생성하며, 실제 화면은 별도의 렌더러로 등록한다. */
export type Structure =
  | { kind: 'call-tree'; id: string; nodes: CallNode[] }
  | SequenceStructure
  | TreeDistanceStructure
  | { kind: 'graph'; id: string; directed: boolean; vertices: string[]; edges: [string, string][] }
  | { kind: 'tree'; id: string; info: TreeInfo }
  | { kind: 'table'; id: string; rows: JsonValue[][] };

export interface SearchState {
  algorithm: 'bfs' | 'dfs';
  start: string;
  target: string | null;
  visitOrder: string[];
  parents: Record<string, string | null>;
  distances: Record<string, number>;
  currentEdge: [string, string] | null;
  targetPath: string[];
  outcome: 'pending' | 'found' | 'unreachable' | 'traversed';
  current: string | null;
  discovered: string[];
  processed: string[];
  frontier: string[];
  path: string[];
  pruned: { target: string; reason: string }[];
}
export type StepEvent =
  | 'initial'
  | 'call'
  | 'return'
  | 'assign'
  | 'scope'
  | 'compare'
  | 'arithmetic'
  | 'insert'
  | 'remove'
  | 'reject'
  | 'visit'
  | 'discover'
  | 'edge'
  | 'process'
  | 'prune'
  | 'reuse'
  | 'complete'
  | 'error'
  | 'limit'
  | 'cancel';
export type ExecutionStatus = 'running' | 'completed' | 'error' | 'limit-reached' | 'cancelled';
export interface Metrics {
  calls: number;
  comparisons: number;
  assignments: number;
  arithmetic: number;
  maxDepth: number;
  iterations?: number;
  inserts?: number;
  removes?: number;
  rejected?: number;
  maxSize?: number;
  discoveries?: number;
  visits?: number;
  edgeScans?: number;
  skipped?: number;
  finished?: number;
}
export interface Change {
  path: string;
  before: RuntimeValue;
  after: RuntimeValue;
  description: string;
}
export interface StepState {
  source: SourceLocation | null;
  activeFrameId: string | null;
  frames: Frame[];
  globals: Record<string, RuntimeValue>;
  returnValue: RuntimeValue;
  returnInfo: {
    frameId: string;
    targetFrameId: string | null;
    target: SourceLocation;
    value: RuntimeValue;
  } | null;
  structures: Structure[];
  search: SearchState | null;
  metrics: Metrics;
}
export interface Step extends StepState {
  index: number;
  event: StepEvent;
  status: ExecutionStatus;
  explanation: string;
  changes: Change[];
}
export interface RunMetadata {
  exampleId: string;
  input: Record<string, JsonValue>;
  algorithmVersion: string;
  code: { id: string; language: 'python'; lines: string[] };
  lineMap: Record<string, number>;
  neighborOrder: string[] | null;
  metricRules: { [K in keyof Metrics]: string };
  limits: {
    maxSteps: number;
    maxDepth: number;
    maxInput: number;
    maxOperations?: number;
    capacity?: number;
  };
  stepSemantics: 'after-event';
}
// 재귀 JSON 값 자체가 readonly이므로 다시 전개하지 않는다.
export type DeepReadonly<T> = JsonValue extends T
  ? JsonValue
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
export type Snapshot = DeepReadonly<Step>;
export interface ExecutionRun {
  readonly metadata: DeepReadonly<RunMetadata>;
  readonly steps: readonly Snapshot[];
}
