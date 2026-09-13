import { prepareWorkspace } from './display';
import { test, expect } from '@playwright/test';

test('코드·변수·구조·기록·집계의 동기화와 키보드 왕복', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('합');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '실습 영역으로 이동' })).toBeFocused();
  await prepareWorkspace(page);
  await expect(page.getByRole('button', { name: '이전', exact: true })).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '다음', exact: true }).click();
  const panelSteps = await page
    .locator('[data-panel]')
    .evaluateAll((panels) => panels.map((panel) => panel.getAttribute('data-step')));
  expect(panelSteps).toEqual(['3', '3', '3', '3', '3', '3']);
  await expect(page.locator('.current-line')).toContainText('if n == 0:');
  await expect(page.locator('.active-frame')).toContainText('sum_to(4)');
  await expect(page.locator('[data-metric="calls"]')).toHaveText('1회');
  await expect(page.locator('[data-metric="comparisons"]')).toHaveText('1회');
  const before = await page.locator('.workspace-grid').innerText();
  await page.locator('h1').click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-metric="comparisons"]')).toHaveText('0회');
  await page.keyboard.press('ArrowRight');
  expect(await page.locator('.workspace-grid').innerText()).toBe(before);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-workspace.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('자동 실행 중 입력 수정은 기록을 지우고 잘못된 입력을 설명한다', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await expect(page.getByRole('button', { name: '일시 정지' })).toBeVisible();
  await page.getByRole('textbox', { name: '입력값 n' }).fill('');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', 'empty');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '입력 적용' }).click();
  await expect(page.getByRole('alert')).toContainText('정수를 입력');
  await page.getByRole('textbox', { name: '입력값 n' }).fill('0');
  await page.getByRole('button', { name: '입력 적용' }).click();
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
  await expect(page.locator('[data-metric="calls"]')).toHaveText('0회');
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.run-summary')).toContainText('정상 종료');
  await expect(page.locator('.variable-group').first()).toContainText('result0');
  await expect(page.locator('[data-metric="calls"]')).toHaveText('1회');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '처음으로' }).click();
  await expect(page.locator('[data-metric="calls"]')).toHaveText('0회');
});

test('최대 입력의 호출 트리와 복귀 기록, 학습 안내를 확인한다', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('textbox', { name: '입력값 n' }).fill('12');
  await page.getByRole('button', { name: '입력 적용' }).click();
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('.tree-node')).toHaveCount(13);
  await expect(page.locator('[data-metric="maxDepth"]')).toHaveText('13개 프레임');
  await expect(page.locator('.variable-group').first()).toContainText('result78');
  await expect(page.locator('.empty-stack')).toContainText('모든 함수가 복귀했습니다.');
  await page.locator('.metric-rules summary').click();
  await expect(page.locator('.metric-rules')).toContainText('매개 변수 전달과 함수 정의는 제외');
  await page.locator('.lesson-guide summary').click();
  await expect(page.getByRole('heading', { name: '자기 말로 설명하기' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-completed.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
