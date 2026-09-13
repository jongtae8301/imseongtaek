import { prepareWorkspace } from './display';
import { expect, test, type Page } from '@playwright/test';

async function end(page: Page) {
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
}
async function apply(page: Page) {
  await page.getByRole('button', { name: '탐색 준비', exact: true }).click();
}
async function openEditor(page: Page) {
  await page.locator('.graph-editor > summary').click();
}

test('BFS 여섯 영역 동기화·키보드 복원과 같은 입력의 DFS 비교', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '그래프와 탐색' }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('[data-current-vertex]')).toHaveText('A');
  await expect(page.locator('[data-frontier]')).toContainText('빈 큐');
  await expect(page.locator('.current-line')).toContainText('u = queue.popleft()');
  expect(
    await page
      .locator('[data-panel]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-step'))),
  ).toEqual(Array(6).fill('5'));
  const before = await page.locator('.workspace-grid').innerText();
  await page.locator('h1').click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-frontier]')).toContainText('Front / Rear');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('.workspace-grid').innerText()).toBe(before);
  await end(page);
  await expect(page.locator('[data-visit-order]')).toHaveText('A → B → C → D → E → F');
  await expect(page.locator('[data-target-path]')).toHaveText('A → C → F');
  await expect(page.locator('[data-metric="edgeScans"]')).toHaveText('12회');
  await page.getByRole('button', { name: 'BFS·DFS 결과 비교', exact: true }).click();
  await expect(page.locator('[data-comparison="dfs"]')).toContainText('A → B → D → F → C → E');
  await expect(page.locator('[data-comparison="dfs"]')).toContainText('A → B → D → F');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-graph-comparison.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('리스트·행렬·간선·정점 편집과 입력 오류', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '그래프와 탐색' }).click();
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await openEditor(page);
  await page.getByRole('button', { name: '인접리스트 편집', exact: true }).click();
  await page.getByRole('textbox', { name: '리스트 입력' }).fill('A: B\nB: A\nC:');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', 'empty');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '탐색 준비', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '표현 적용', exact: true }).click();
  await page.getByRole('button', { name: '인접행렬 편집', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '행렬 입력' })).toHaveValue('0 1 0\n1 0 0\n0 0 0');
  await page.getByRole('textbox', { name: '행렬 입력' }).fill('0 1 0\n0 0 0\n0 0 0');
  await page.getByRole('button', { name: '표현 적용', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('대칭');
  await page.getByRole('button', { name: '문자 입력 취소', exact: true }).click();
  await page.getByRole('button', { name: 'A에서 C 연결 추가', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'C에서 A 연결 해제', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: '새 정점', exact: true }).fill('D');
  await page.getByRole('button', { name: '정점 추가', exact: true }).click();
  await page.getByRole('combobox', { name: '삭제할 정점', exact: true }).selectOption('D');
  await page.getByRole('button', { name: '정점 삭제', exact: true }).click();
  await page.getByRole('combobox', { name: '목표 정점', exact: true }).selectOption('C');
  await apply(page);
  await end(page);
  await expect(page.locator('[data-target-path]')).toHaveText('A → C');
  await page.getByRole('textbox', { name: '행렬 입력' }).fill('잘못된 입력');
  await page.getByRole('button', { name: '사이클 그래프', exact: true }).click();
  await page.getByRole('textbox', { name: '행렬 입력' }).fill('또 다른 입력');
  await page.getByRole('button', { name: '사이클 그래프', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '행렬 입력' })).not.toHaveValue('또 다른 입력');
  await apply(page);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-graph-editor.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('DFS 콜 스택·방향키와 이웃 순서 변경 초기화', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '그래프와 탐색' }).click();
  await page.getByRole('combobox', { name: '탐색 방법', exact: true }).selectOption('dfs');
  await apply(page);
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('.dfs-frames li')).toHaveCount(2);
  await expect(page.locator('.dfs-frames .active-frame')).toContainText('dfs-2');
  await expect(page.locator('.dfs-frames .active-frame')).toContainText('v = 아직 없음');
  await expect(page.locator('.current-line')).toContainText('dfs(v)');
  await expect(page.locator('[data-current-vertex]')).toHaveText('B');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-dfs.png`,
    fullPage: true,
  });
  const node = page.getByRole('button', { name: /정점 C 선택/ });
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-vertex-info]')).toContainText('선택 정점 C');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '8');
  await page.getByRole('button', { name: '그래프 확대', exact: true }).click();
  await expect(page.getByLabel('그래프 배율', { exact: true })).toHaveText('125%');
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await page.getByRole('combobox', { name: '이웃 방문 순서', exact: true }).selectOption('true');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await apply(page);
  await end(page);
  await expect(page.locator('[data-visit-order]')).toHaveText('A → C → F → D → B → E');
  await expect(page.locator('.dfs-frames li')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('한도 설정 없이 단절·방향 그래프 탐색을 완료하고 도달 불가를 표시', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '그래프와 탐색' }).click();
  await page.getByRole('button', { name: '단절 그래프', exact: true }).click();
  await apply(page);
  await end(page);
  await expect(page.locator('[data-target-path]')).toHaveText('도달 불가');
  await expect(page.locator('.run-summary')).toContainText('정상 종료');
  await expect(page.getByRole('combobox', { name: '실행 한도', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'BFS·DFS 결과 비교', exact: true }).click();
  for (const algorithm of ['bfs', 'dfs']) {
    await expect(page.locator(`[data-comparison="${algorithm}"]`)).toContainText('정상 종료');
    await expect(page.locator(`[data-comparison="${algorithm}"]`)).toContainText('도달 불가');
  }
  await page.getByRole('button', { name: '방향 그래프', exact: true }).click();
  await expect(page.locator('[data-comparison]')).toHaveCount(0);
  await page.getByRole('combobox', { name: '시작 정점', exact: true }).selectOption('D');
  await page.getByRole('combobox', { name: '목표 정점', exact: true }).selectOption('A');
  await apply(page);
  await end(page);
  await expect(page.locator('[data-visit-order]')).toHaveText('D');
  await expect(page.locator('[data-target-path]')).toHaveText('도달 불가');
});

test('트리 관계·1기반 배열·잘못된 트리 거절과 일반 트리', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '트리와 탐색' }).click();
  await page.getByRole('button', { name: /정점 C 선택/ }).click();
  await expect(page.locator('[data-vertex-info]')).toContainText(
    '트리 부모: A / 자식: F / 형제: B / 깊이: 1',
  );
  await expect(page.getByLabel('이진 트리 배열')).toContainText('6F');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-tree.png`,
    fullPage: true,
  });
  await openEditor(page);
  await page.getByRole('combobox', { name: '간선 시작', exact: true }).selectOption('D');
  await page.getByRole('combobox', { name: '간선 끝', exact: true }).selectOption('A');
  await page.getByRole('button', { name: '간선 연결', exact: true }).click();
  await apply(page);
  await expect(page.getByRole('alert')).toContainText('루트는 부모가 없어야');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '간선 해제', exact: true }).click();
  await apply(page);
  await end(page);
  await expect(page.locator('[data-visit-order]')).toHaveText('A → B → C → D → E → F');
  await page.getByRole('button', { name: '일반 트리', exact: true }).click();
  await apply(page);
  await expect(page.locator('[data-panel="structures"]')).toContainText('이진 트리가 아닙니다');
  await expect(page.getByLabel('이진 트리 배열')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
