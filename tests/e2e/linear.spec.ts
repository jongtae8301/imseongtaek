import { prepareWorkspace } from './display';
import { expect, test } from '@playwright/test';

test('큐 직접 조작의 FIFO·0·중복과 이전 단계 복원', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '큐와 스택' }).click();
  const code = page.getByRole('list', { name: '예제 Python 코드' });
  const initialCode = await code.locator('li code').allTextContents();
  await expect(page.locator('[data-pointer="Front"]')).toContainText('없음');
  await page.getByRole('button', { name: '삭제 · Dequeue', exact: true }).click();
  await expect(page.locator('.run-summary')).toContainText('빈 큐에서는 삭제할 수 없습니다');
  await expect(page.locator('[data-metric="rejected"]')).toHaveText('1회');
  for (const number of [0, 7, 0]) {
    await page.getByRole('textbox', { name: '삽입할 값' }).fill(String(number));
    await page.getByRole('button', { name: '삽입 · Enqueue', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '삽입할 값' })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: '삽입할 값' })).toBeFocused();
    await expect(page.locator('.current-line')).toContainText('queue.append(item)');
    await expect(page.locator('[data-variable="globals.item"] dd')).toHaveText(String(number));
    expect(await code.locator('li code').allTextContents()).toEqual(initialCode);
  }
  await page.getByRole('button', { name: '삭제 · Dequeue', exact: true }).click();
  await expect(page.locator('[data-removal-order]')).toHaveText('0');
  await expect(page.locator('[data-pointer="Front"]')).toContainText('값 7');
  await expect(page.locator('[data-pointer="Rear"]')).toContainText('위치 1 · 값 0');
  await expect(page.locator('.current-line')).toContainText('removed = queue.popleft()');
  const before = await page.locator('.workspace-grid').innerText();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(page.getByRole('button', { name: '삽입 · Enqueue', exact: true })).toBeDisabled();
  await expect(page.locator('[data-removal-order]')).toHaveText('아직 삭제된 값 없음');
  await expect(page.locator('[data-metric="removes"]')).toHaveText('0회');
  await page.getByRole('button', { name: '마지막 단계로', exact: true }).click();
  expect(await page.locator('.workspace-grid').innerText()).toBe(before);
  expect(
    await page
      .locator('[data-panel]')
      .evaluateAll((panels) => panels.map((panel) => panel.getAttribute('data-step'))),
  ).toEqual(['10', '10', '10', '10', '10', '10']);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-queue.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('용량 초과·잘못된 입력·새 실습과 직접 조작 한도', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '큐와 스택' }).click();
  await page.getByRole('textbox', { name: '삽입할 값' }).fill('1.5');
  await page.getByRole('button', { name: '삽입 · Enqueue' }).click();
  await expect(page.getByRole('alert')).toContainText('정수를 입력');
  await expect(page.getByRole('textbox', { name: '삽입할 값' })).toHaveValue('1.5');
  await expect(page.locator('[data-panel="structures"]')).toHaveAttribute('data-step', '0');
  for (let i = 0; i < 7; i++) {
    await page.getByRole('textbox', { name: '삽입할 값' }).fill('0');
    await page.getByRole('button', { name: '삽입 · Enqueue' }).click();
  }
  await expect(page.locator('.run-summary')).toContainText('용량 6개를 모두 사용');
  await expect(page.getByRole('textbox', { name: '삽입할 값' })).toHaveValue('0');
  await expect(page.locator('[data-metric="inserts"]')).toHaveText('6회');
  await expect(page.locator('[data-metric="rejected"]')).toHaveText('1회');
  await expect(page.locator('[data-pointer="Rear"]')).toContainText('위치 5');
  await page.getByRole('button', { name: '새 실습', exact: true }).click();
  await expect(page.locator('[data-pointer="Front"]')).toContainText('없음');
  await expect(page.locator('[data-metric="inserts"]')).toHaveText('0회');
  for (let i = 0; i < 40; i++) await page.getByRole('button', { name: '삭제 · Dequeue' }).click();
  await expect(page.getByRole('button', { name: '삭제 · Dequeue' })).toBeDisabled();
  await expect(page.getByText('40회 조작 한도에 도달했습니다.', { exact: false })).toBeVisible();
});

test('같은 예제 입력의 FIFO/LIFO와 예제·모듈 교체 초기화', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '자동 실행', exact: true }).click();
  await page.getByRole('button', { name: '큐와 스택' }).click();
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '예제 실행', exact: true }).click();
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('[data-removal-order]')).toHaveText('1 → 2 → 3 → 4');
  await expect(page.locator('.run-summary')).toContainText('정상 종료');
  await page.getByRole('combobox', { name: '자료구조 선택' }).selectOption('stack');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
  await expect(page.locator('[data-removal-order]')).toHaveText('아직 삭제된 값 없음');
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('[data-removal-order]')).toHaveText('4 → 3 → 2 → 1');
  await expect(page.locator('[data-pointer="Top"]')).toContainText('없음');
  await page.getByRole('button', { name: '직접 조작', exact: true }).click();
  await page.getByRole('button', { name: '삽입 · Push' }).dblclick();
  await expect(page.locator('[data-metric="inserts"]')).toHaveText('1회');
  const input = page.getByRole('textbox', { name: '삽입할 값' });
  await expect(input).toHaveValue('');
  // 다음 숫자를 선택·지우기 없이 입력하고 Enter로 이어서 삽입한다.
  await input.press('2');
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(page.locator('[data-metric="inserts"]')).toHaveText('2회');
  await expect(page.locator('[data-pointer="Top"]')).toContainText('위치 1 · 값 2');
  await page.getByRole('button', { name: '삭제 · Pop' }).click();
  await expect(page.locator('[data-pointer="Top"]')).toContainText('위치 0 · 값 1');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-stack.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '함수와 재귀' }).click();
  await expect(page.locator('[data-metric="calls"]')).toHaveText('0회');
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
});

for (const mode of ['queue', 'stack']) {
  test(`${mode} 용량 선택이 코드·거절·예제에 적용되고 변경 시 재생과 기록을 초기화한다`, async ({
    page,
  }) => {
    await page.goto('/');
    await prepareWorkspace(page);
    await page.getByRole('button', { name: '큐와 스택' }).click();
    await page.getByRole('combobox', { name: '자료구조 선택', exact: true }).selectOption(mode);
    const capacity = page.getByRole('combobox', { name: '최대 용량', exact: true });
    await expect(capacity).toHaveValue('6');
    await capacity.selectOption('2');
    const insert = page.getByRole('button', {
      name: mode === 'queue' ? '삽입 · Enqueue' : '삽입 · Push',
      exact: true,
    });
    for (const item of [1, 2, 3]) {
      await page.getByRole('textbox', { name: '삽입할 값' }).fill(String(item));
      await insert.click();
    }
    await expect(page.locator('[data-metric="inserts"]')).toHaveText('2회');
    await expect(page.locator('.run-summary')).toContainText('용량 2개를 모두 사용');
    await expect(page.getByRole('textbox', { name: '삽입할 값' })).toHaveValue('3');
    await expect(page.locator('.source-code')).toContainText('CAPACITY = 2');
    await page.getByRole('button', { name: '이전', exact: true }).click();
    await expect(insert).toBeDisabled();
    await capacity.selectOption('12');
    await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
    await expect(page.locator('[data-metric="inserts"]')).toHaveText('0회');
    await expect(page.locator('.sequence-table tbody tr')).toHaveCount(12);
    await expect(insert).toBeEnabled();
    await page.getByRole('button', { name: '예제 실행', exact: true }).click();
    await expect(capacity).toHaveValue('12');
    await page.getByRole('button', { name: '자동 실행', exact: true }).click();
    await capacity.selectOption('1');
    await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '0');
    await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
    await page.keyboard.press('End');
    await expect(page.locator('.run-summary')).toContainText('정상 종료');
    await expect(page.locator('[data-removal-order]')).toHaveText('1');
    await expect(page.locator('[data-metric="rejected"]')).toHaveText('6회');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
