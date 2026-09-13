import { prepareWorkspace, compactWorkspace } from './display';
import { expect, test, type Page } from '@playwright/test';

async function openDistance(page: Page) {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: /^트리와 탐색/ }).click();
  await page.getByRole('button', { name: '거리·공통 조상', exact: true }).click();
}
async function end(page: Page) {
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
}
async function ready(page: Page) {
  await page.getByRole('button', { name: '거리 계산 준비', exact: true }).click();
}

test('거리 포인터·코드·거리 증가의 분리, 여섯 영역과 키보드 복원', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openDistance(page);
  await expect(page.locator('[data-distance-count]')).toHaveText('아직 없음');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('[data-distance-a]')).toContainText('D → B');
  await expect(page.locator('[data-distance-b]')).toContainText('E → E');
  await expect(page.locator('[data-distance-count]')).toHaveText('0개 간선');
  await expect(page.locator('.current-line')).toContainText('a = parent[a]');
  await expect(page.locator('.edge-current')).toHaveCount(1);
  expect(
    await page
      .locator('[data-panel]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-step'))),
  ).toEqual(Array(6).fill('6'));
  const before = await page.locator('.workspace-grid').innerText();
  await page.locator('h1').click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('.workspace-grid').innerText()).toBe(before);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('[data-distance-count]')).toHaveText('1개 간선');
  await expect(page.locator('.current-line')).toContainText('distance = distance + 1');
  await end(page);
  await expect(page.locator('[data-distance-lca]')).toHaveText('B');
  await expect(page.locator('[data-distance-path]')).toHaveText('D → B → E');
  await expect(page.locator('[data-distance-count]')).toHaveText('2개 간선');
  await expect(page.locator('.edge-route')).toHaveCount(2);
  await expect(page.locator('.node-lca')).toHaveCount(1);
  await expect(page.locator('[data-metric="comparisons"]')).toHaveText('5회');
  await page.getByRole('button', { name: /정점 B 선택/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-vertex-info]')).toContainText('선택 정점 B');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-tree-distance.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('계산 방법·노드 변경은 자동 실행을 멈추고 초기화, 배열 방식과 같은 노드 0', async ({
  page,
}) => {
  await openDistance(page);
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await page.getByRole('combobox', { name: '거리 계산 방법', exact: true }).selectOption('array');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', 'empty');
  await ready(page);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('.current-line')).toContainText('b = nodes[position[b] // 2]');
  await expect(page.locator('[data-distance-b]')).toContainText('E → B');
  await expect(page.locator('[data-distance-count]')).toHaveText('0개 간선');
  await end(page);
  await expect(page.locator('[data-distance-path]')).toHaveText('D → B → E');
  await expect(page.locator('[data-metric="arithmetic"]')).toHaveText('4회');
  await page.getByRole('combobox', { name: '첫 노드', exact: true }).selectOption('G');
  await page.getByRole('combobox', { name: '둘째 노드', exact: true }).selectOption('G');
  await ready(page);
  await end(page);
  await expect(page.locator('[data-distance-count]')).toHaveText('0개 간선');
  await expect(page.locator('[data-distance-lca]')).toHaveText('G');
  await expect(page.locator('[data-distance-path]')).toHaveText('G');
  await page.getByRole('combobox', { name: '첫 노드', exact: true }).selectOption('A');
  await ready(page);
  await end(page);
  await expect(page.locator('[data-distance-count]')).toHaveText('3개 간선');
  await expect(page.locator('[data-distance-path]')).toHaveText('A → B → E → G');
});

test('한도 도달·일반 트리의 배열 거절·잘못된 트리 수정과 문자 입력 초기화', async ({ page }) => {
  await openDistance(page);
  await page.getByRole('combobox', { name: '실행 한도', exact: true }).selectOption('10');
  await ready(page);
  await end(page);
  await expect(page.locator('.run-summary')).toContainText('한도 도달');
  await expect(page.locator('[data-distance-lca]')).toHaveText('아직 확정하지 않음');
  await expect(page.locator('[data-panel="state"]')).toContainText(
    '현재 누적값을 최종 거리로 해석하지',
  );
  await page.getByRole('combobox', { name: '실행 한도', exact: true }).selectOption('100');
  await page.getByRole('combobox', { name: '거리 계산 방법', exact: true }).selectOption('array');
  await page.getByRole('button', { name: '일반 트리', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('alert')).toContainText('깊이 비교 방식을 선택');
  await page.getByRole('combobox', { name: '거리 계산 방법', exact: true }).selectOption('depth');
  await ready(page);
  await end(page);
  await expect(page.locator('[data-distance-path]')).toHaveText('B → A → C → E');
  await expect(page.locator('[data-distance-count]')).toHaveText('3개 간선');
  await page.locator('.graph-editor > summary').click();
  await page.getByRole('button', { name: '인접리스트 편집', exact: true }).click();
  await page.getByRole('textbox', { name: '리스트 입력' }).fill('A: B\nB: A');
  await expect(page.getByRole('button', { name: '거리 계산 준비', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '표현 적용', exact: true }).click();
  await ready(page);
  await expect(page.getByRole('alert')).toContainText('루트는 부모가 없어야');
  await page.getByRole('textbox', { name: '리스트 입력' }).fill('A: B\nB:');
  await page.getByRole('button', { name: '표현 적용', exact: true }).click();
  await page.getByRole('combobox', { name: '첫 노드', exact: true }).selectOption('B');
  await page.getByRole('combobox', { name: '둘째 노드', exact: true }).selectOption('A');
  await ready(page);
  await end(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-distance-path]')).toHaveText('B → A');
});

test('집중 화면·모바일 탭에서도 단계 유지, 활동 전환 시 새 실습', async ({ page }) => {
  await openDistance(page);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  await compactWorkspace(page);
  if (test.info().project.name === 'mobile-edge') {
    await page.getByRole('tab', { name: '현재 상태', exact: true }).click();
    await expect(page.locator('[data-distance-a]')).toBeVisible();
    await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '6');
    await page.getByRole('tab', { name: '현재 상태', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: '시각화', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  }
  await page.screenshot({
    path: `test-results/${test.info().project.name}-tree-distance-focus.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '예제·설정', exact: true }).click();
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await page.getByRole('button', { name: '관계·BFS/DFS', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '탐색 방법', exact: true })).toHaveValue('bfs');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
  await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '거리·공통 조상', exact: true }).click();
  await expect(page.locator('[data-distance-count]')).toHaveText('아직 없음');
});
