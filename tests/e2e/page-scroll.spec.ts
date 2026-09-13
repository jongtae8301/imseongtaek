import { expect, test, type Page } from '@playwright/test';

async function panel(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function end(page: Page) {
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.keyboard.press('End');
}

async function noVerticalClipping(page: Page) {
  const clipped = await page.locator('#workspace *').evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const element = node as HTMLElement;
        const style = getComputedStyle(element);
        return (
          element.clientHeight > 1 &&
          element.clientWidth > 1 &&
          element.tagName !== 'TEXTAREA' &&
          !element.closest('.sr-only') &&
          ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY) &&
          element.scrollHeight > element.clientHeight + 2
        );
      })
      .map((element) => element.className),
  );
  expect(clipped).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function bottomIsReachable(page: Page) {
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  await page.locator('.lesson-guide summary').focus();
  await expect
    .poll(async () => {
      const last = (await page.locator('.lesson-guide summary').boundingBox())!;
      const bar = (await page.locator('.playback').boundingBox())!;
      return last.y >= 0 && last.y + last.height <= bar.y;
    })
    .toBe(true);
}

test('그래프 전체 높이와 확대를 페이지에서 읽고 그림 위 휠도 페이지를 움직인다', async ({
  page,
}) => {
  if (test.info().project.name === 'desktop-edge')
    await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: '그래프와 탐색', exact: true }).click();
  if (test.info().project.name === 'mobile-edge') await panel(page, '시각화');
  const canvas = page.locator('[data-panel="visualization"] .graph-canvas-scroll');
  const svg = canvas.locator('svg').first();
  await noVerticalClipping(page);
  const beforeHeight = (await svg.boundingBox())!.height;
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: '그래프 확대', exact: true }).click();
  expect((await svg.boundingBox())!.height).toBeGreaterThan(beforeHeight * 1.9);
  expect(await canvas.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await noVerticalClipping(page);
  await canvas.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  // 짧은 모바일 페이지에서 이미 맨 아래라면 휠로 더 내려갈 수 없으므로 여유를 둔다.
  await page.evaluate(() => window.scrollBy(0, -160));
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 50, Math.max(30, box.y + 50));
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 240);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
  expect(await canvas.evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator('[data-panel="visualization"]')).toHaveAttribute('data-step', '0');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: '그래프 축소', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-page-graph.png`,
    fullPage: true,
  });
  await bottomIsReachable(page);
});

test('깊은 호출 트리·콜 스택과 코드가 잘리지 않고 단계 이동이 페이지를 끌어가지 않는다', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '예제·설정', exact: true }).click();
  await page.getByRole('textbox', { name: '입력값 n' }).fill('12');
  await page.getByRole('button', { name: '입력 적용', exact: true }).click();
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
  // 첫 호출 2단계 + 더 작은 문제마다 비교·대입·호출 3단계: 0의 호출은 38단계.
  for (let i = 0; i < 38; i++) await page.keyboard.press('ArrowRight');
  await panel(page, '자료구조');
  await expect(page.locator('.stack-list > li')).toHaveCount(13);
  await noVerticalClipping(page);
  if (test.info().project.name === 'mobile-edge') await panel(page, '시각화');
  await expect(page.locator('.tree-node')).toHaveCount(13);
  await noVerticalClipping(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-page-recursion.png`,
    fullPage: true,
  });
  await panel(page, '코드');
  await noVerticalClipping(page);
  await page.evaluate(() => window.scrollTo(0, 200));
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await expect(page.locator('.current-line')).toContainText('if n == 0:');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  await bottomIsReachable(page);
});

test('긴 실행 기록은 최근 기록만 보이며 펼치기·되돌리기·새 입력에도 기록을 보존한다', async ({
  page,
}) => {
  await page.goto('/');
  await end(page);
  await panel(page, '실행 기록');
  await expect(page.locator('.history-list > li')).toHaveCount(8);
  await expect(page.locator('.history-index').first()).toHaveText('23');
  await expect(page.locator('.history-index').last()).toHaveText('30');
  await page.getByRole('button', { name: '이전 기록 23개 펼치기', exact: true }).click();
  await expect(page.locator('.history-list > li')).toHaveCount(31);
  await expect(page.locator('[data-panel="history"]')).toHaveAttribute('data-step', '30');
  await noVerticalClipping(page);
  await page.locator('.history-list button').filter({ hasText: /^04/ }).click();
  await expect(page.locator('[data-panel="history"]')).toHaveAttribute('data-step', '4');
  await expect(page.locator('.history-list > li')).toHaveCount(5);
  await end(page);
  await expect(page.locator('.history-list > li')).toHaveCount(31);
  await page.getByRole('button', { name: '최근 8개만 보기', exact: true }).click();
  await expect(page.locator('.history-list > li')).toHaveCount(8);
  await page.getByRole('button', { name: '이전 기록 23개 펼치기', exact: true }).click();
  await page.getByRole('button', { name: '예제·설정', exact: true }).click();
  await page.getByRole('textbox', { name: '입력값 n' }).fill('3');
  await expect(page.locator('.history-list')).toContainText('실행 기록이 없습니다.');
  await page.getByRole('button', { name: '입력 적용', exact: true }).click();
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  await end(page);
  await expect(page.locator('.history-list > li')).toHaveCount(8);
  await expect(
    page.getByRole('button', { name: '이전 기록 17개 펼치기', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '모두 펼치기', exact: true }).click();
  await noVerticalClipping(page);
  await page.getByRole('button', { name: '간단히 보기', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-page-history.png`,
    fullPage: true,
  });
  await bottomIsReachable(page);
});

test('스택의 연산 전후 여섯 원소와 아래 학습 안내가 페이지에서 모두 보인다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '큐와 스택', exact: true }).click();
  await page.getByRole('button', { name: '예제·설정', exact: true }).click();
  await page.getByRole('combobox', { name: '자료구조 선택', exact: true }).selectOption('stack');
  await page.getByRole('button', { name: '설정 닫기', exact: true }).click();
  for (let i = 1; i <= 6; i++) {
    await page.getByRole('textbox', { name: '삽입할 값' }).fill(String(i));
    await page.getByRole('button', { name: '삽입 · Push', exact: true }).click();
  }
  if (test.info().project.name === 'mobile-edge') await panel(page, '시각화');
  await expect(
    page.getByRole('list', { name: '현재 원소', exact: true }).locator('li'),
  ).toHaveCount(6);
  await expect(
    page.getByRole('list', { name: '연산 전 원소', exact: true }).locator('li'),
  ).toHaveCount(5);
  await noVerticalClipping(page);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-page-stack.png`,
    fullPage: true,
  });
  await bottomIsReachable(page);
  await page.setViewportSize({ width: 620, height: 700 });
  await bottomIsReachable(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await bottomIsReachable(page);
});
