import { expect, test, type Page } from '@playwright/test';

async function showPanel(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}
async function next(page: Page, count: number) {
  for (let i = 0; i < count; i++)
    await page.getByRole('button', { name: '다음', exact: true }).click();
}
test('간단한 기본 화면·설정 접기와 여섯 탭의 동일 Step 복원', async ({ page }) => {
  const mobile = test.info().project.name === 'mobile-edge';
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: '입력값 n' })).toBeHidden();
  await expect(page.locator('[data-panel]:visible')).toHaveCount(mobile ? 1 : 2);
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.locator('.learning-prompt')).not.toHaveAttribute('open', '');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-simple-home.png`,
    fullPage: true,
  });
  await next(page, 3);
  if (mobile) await showPanel(page, '코드');
  await expect(page.locator('.current-line')).toBeVisible();
  await expect(page.locator('.current-line')).toContainText('if n == 0:');
  await showPanel(page, '현재 상태');
  await expect(page.locator('[data-variable$="parameters.n"]')).toContainText('4');
  expect(
    await page
      .locator('[data-panel]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-step'))),
  ).toEqual(Array(6).fill('3'));
  await page.getByRole('button', { name: '모두 펼치기', exact: true }).click();
  await expect(page.locator('[data-panel]:visible')).toHaveCount(6);
  await page.getByRole('button', { name: '간단히 보기', exact: true }).click();
  await expect(page.getByRole('tab', { name: '현재 상태', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.locator('h1').click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '3');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-simple-state.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('예제 설정과 입력 검증은 접근 가능하고 표시 전환은 재생을 유지한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '예제·설정' }).click();
  await page.getByRole('textbox', { name: '입력값 n' }).fill('0');
  await page.getByRole('button', { name: '입력 적용' }).click();
  await page.getByRole('button', { name: '설정 닫기' }).click();
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await showPanel(page, '분석');
  await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '예제·설정' }).click();
  await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '입력값 n' }).fill('');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '입력 적용' }).click();
  await page.getByRole('button', { name: '설정 닫기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('정수');
});

test('그래프·트리 탐색·직접 조작은 간단한 화면에서 연결된다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '그래프와 탐색', exact: true }).click();
  await next(page, 5);
  await showPanel(page, '현재 상태');
  await expect(page.locator('[data-current-vertex]')).toHaveText('A');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-simple-graph.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '트리와 탐색', exact: true }).click();
  await expect(page.getByRole('button', { name: '거리·공통 조상', exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: '트리 활동 선택', exact: true })).toHaveCount(0);
  await next(page, 6);
  await showPanel(page, '현재 상태');
  await expect(page.locator('[data-current-vertex]')).toHaveText('A');
  await expect(page.locator('[data-visit-order]')).toHaveText('A');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-simple-tree.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: '큐와 스택', exact: true }).click();
  await expect(page.locator('.run-summary')).toContainText('삽입·삭제하며 구조 변화를');
  await page.getByRole('textbox', { name: '삽입할 값' }).fill('7');
  await page.getByRole('button', { name: '삽입 · Enqueue', exact: true }).click();
  await expect(page.locator('[data-panel="visualization"]')).toContainText('7');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-simple-queue.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('탭 방향키와 화면 크기 변경은 실행 단계·선택을 보존한다', async ({ page }) => {
  await page.goto('/');
  await next(page, 3);
  await showPanel(page, '코드');
  await page.getByRole('tab', { name: '코드', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: '분석', exact: true })).toBeFocused();
  await expect(page.locator('[data-panel="analysis"]')).toBeVisible();
  await expect(page.locator('[data-panel="analysis"]')).toHaveAttribute('data-step', '3');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: '코드', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await showPanel(page, '시각화');
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.locator('[data-panel]:visible')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: '코드', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('[data-panel="code"]')).toHaveAttribute('data-step', '3');
  await expect(page.locator('.current-line')).toBeVisible();
  await page.getByRole('button', { name: '그래프와 탐색', exact: true }).click();
  await showPanel(page, '현재 상태');
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: '이전', exact: true }).click();
  // 종료와 빈 큐 조건 검사 직전의 마지막 처리 사건까지 돌아간다.
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await showPanel(page, '코드');
  await expect(page.locator('.current-line')).toContainText('processed.append(u)');
  await expect
    .poll(async () => {
      const line = (await page.locator('.current-line').boundingBox())!;
      const code = (await page.locator('.source-code').boundingBox())!;
      const panel = (await page.locator('[data-panel="code"]').boundingBox())!;
      return (
        line.y >= code.y &&
        line.y + line.height <= Math.min(code.y + code.height, panel.y + panel.height)
      );
    })
    .toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-long-code.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
