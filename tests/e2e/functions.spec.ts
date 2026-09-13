import { prepareWorkspace } from './display';
import { expect, test, type Page } from '@playwright/test';
const next = async (page: Page, count = 1) => {
  for (let i = 0; i < count; i++)
    await page.getByRole('button', { name: '다음', exact: true }).click();
};
const end = async (page: Page) => {
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
};
const apply = async (page: Page) => {
  await page.getByRole('button', { name: '입력 적용', exact: true }).click();
};
const choose = async (page: Page, problem: string) => {
  const expand = page.getByRole('button', { name: '예제·설정', exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole('combobox', { name: '예제 선택', exact: true }).selectOption(problem);
};

test('일반 함수의 지역·전역 변경과 None 반환·복귀', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await prepareWorkspace(page);
  await choose(page, 'scope');
  await apply(page);
  await next(page, 6);
  await expect(page.locator('[data-variable="globals.total"] dd')).toHaveText('10');
  await expect(page.locator('[data-variable="frames.frame-2.parameters.total"] dd')).toHaveText(
    '14',
  );
  await expect(page.locator('.current-line')).toContainText('total = subtotal');
  await expect(page.locator('.active-frame')).toContainText('local_add(10, 4)');
  await expect(page.locator('.active-frame')).toContainText('현재 매개 변수: total=14, amount=4');
  await expect(page.locator('.tree-node.active code')).toHaveText('local_add(10, 4)');
  expect(
    await page
      .locator('[data-panel]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-step'))),
  ).toEqual(Array(6).fill('6'));
  const before = await page.locator('.workspace-grid').innerText();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await next(page);
  expect(await page.locator('.workspace-grid').innerText()).toBe(before);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-function-scope.png`,
    fullPage: true,
  });
  await next(page, 5);
  await expect(page.locator('[data-variable="globals.total"] dd')).toHaveText('14');
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.locator('.current-line')).toContainText('global total');
  await expect(page.locator('[data-variable="globals.total"] dd')).toHaveText('10');
  await next(page, 2);
  await expect(page.locator('.return-notice')).toContainText('None · 반환값 없음');
  await expect(page.locator('[data-variable="frames.frame-1.locals.receipt"] dd')).toHaveText(
    '아직 없음',
  );
  await next(page);
  await expect(page.locator('[data-variable="frames.frame-1.locals.receipt"] dd')).toHaveText(
    'None · 반환값 없음',
  );
  await end(page);
  await expect(page.locator('[data-variable="globals.result"] dd')).toHaveText('14');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('피보나치 다중 호출·완료 가지 접기·입력 한도', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await choose(page, 'fibonacci');
  await expect(page.locator('#function-definition')).toContainText('F₀=0, F₁=1');
  await page.getByRole('textbox', { name: '입력값 n' }).fill('8');
  await apply(page);
  await end(page);
  await expect(page.locator('[data-variable="globals.result"] dd')).toHaveText('21');
  await expect(page.locator('[data-metric="calls"]')).toHaveText('67회');
  await expect(page.locator('.tree-node')).toHaveCount(67);
  await page.getByRole('button', { name: '완료 가지 접기', exact: true }).click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await expect(page.locator('.folded-branch')).toContainText('66개 호출');
  await expect(page.locator('[data-metric="calls"]')).toHaveText('67회');
  await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
  await expect(page.locator('.tree-node')).toHaveCount(67);
  await page.getByRole('button', { name: '호출 트리 글자 확대', exact: true }).click();
  await expect(page.locator('.tree-text-size output')).toHaveText('125%');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-fibonacci.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('textbox', { name: '입력값 n' }).fill('9');
  await apply(page);
  await expect(page.getByRole('alert')).toContainText('0부터 8까지');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
});

test('재귀·반복 비교는 각 관찰 위치를 기억하고 입력 변경으로 초기화', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await next(page, 3);
  await page.getByRole('button', { name: '같은 입력으로 재귀·반복 비교', exact: true }).click();
  await expect(page.getByRole('region', { name: '재귀·반복 비교' })).toContainText(
    '두 방식의 결과가 일치',
  );
  await page.getByRole('button', { name: '반복 단계 보기', exact: true }).click();
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
  await next(page, 5);
  await page.getByRole('button', { name: '재귀 단계 보기', exact: true }).click();
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '3');
  await expect(page.locator('.current-line')).toContainText('if n == 0');
  await page.getByRole('button', { name: '반복 단계 보기', exact: true }).click();
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '5');
  await expect(page.locator('.current-line')).toContainText('while i <= n');
  await end(page);
  await expect(page.locator('[data-variable="globals.result"] dd')).toHaveText('10');
  await expect(page.locator('[data-metric="iterations"]')).toHaveText('4회');
  await page.screenshot({
    path: `test-results/${test.info().project.name}-function-comparison.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '예제·설정', exact: true }).click();
  await page.getByRole('textbox', { name: '입력값 n' }).fill('5');
  await expect(page.locator('[data-function-comparison]')).toHaveCount(0);
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', 'empty');
  await apply(page);
  await expect(page.locator('[data-metric="calls"]')).toHaveText('0회');
});

test('팩토리얼 최소 입력과 같은 결과·다른 프레임 수', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await choose(page, 'factorial');
  await page.getByRole('textbox', { name: '입력값 n' }).fill('0');
  await apply(page);
  await end(page);
  await expect(page.locator('[data-variable="globals.result"] dd')).toHaveText('1');
  await page.getByRole('textbox', { name: '입력값 n' }).fill('4');
  await apply(page);
  await page.getByRole('button', { name: '같은 입력으로 재귀·반복 비교', exact: true }).click();
  await expect(page.locator('[data-function-comparison="recursive"]')).toContainText(
    '5회 / 5개 프레임',
  );
  await expect(page.locator('[data-function-comparison="iterative"]')).toContainText(
    '1회 / 1개 프레임',
  );
  await page.getByRole('button', { name: '반복 단계 보기', exact: true }).click();
  await end(page);
  await expect(page.locator('[data-variable="globals.result"] dd')).toHaveText('24');
  await page.getByRole('button', { name: '처음으로', exact: true }).click();
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await choose(page, 'scope');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await expect(page.locator('[data-function-comparison]')).toHaveCount(0);
});

test('비교에서 한도 도달과 정상 완료를 구분하고 방식 전환을 복원', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await choose(page, 'fibonacci');
  await page.getByRole('textbox', { name: '입력값 n' }).fill('8');
  await page.getByRole('combobox', { name: '실행 한도', exact: true }).selectOption('50');
  await apply(page);
  await end(page);
  await expect(page.locator('.run-summary')).toContainText('한도 도달');
  await page.getByRole('button', { name: '같은 입력으로 재귀·반복 비교', exact: true }).click();
  await expect(page.getByRole('region', { name: '재귀·반복 비교' })).toContainText(
    '최종 결과를 비교할 수 없습니다',
  );
  await expect(page.locator('[data-function-comparison="recursive"]')).toContainText(
    '한도 도달 · 미완료',
  );
  await expect(page.locator('[data-function-comparison="iterative"]')).toContainText('정상 종료');
  await page.getByRole('button', { name: '반복 단계 보기', exact: true }).click();
  await end(page);
  await expect(page.locator('.run-summary')).toContainText('정상 종료');
  await expect(page.locator('[data-variable="globals.result"] dd')).toHaveText('21');
  await page.getByRole('button', { name: '재귀 단계 보기', exact: true }).click();
  await expect(page.locator('.run-summary')).toContainText('한도 도달');
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
});
