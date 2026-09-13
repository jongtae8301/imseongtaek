import { expect, test, type Locator, type Page } from '@playwright/test';

const board = (page: Page) => page.locator('.maze-board').first();
const cell = (page: Page, coordinate: string) =>
  board(page).locator(`[data-maze-cell="${coordinate}"]`);
const undo = (page: Page) => page.getByRole('button', { name: '편집 되돌리기', exact: true });
const redo = (page: Page) => page.getByRole('button', { name: '편집 다시하기', exact: true });
async function center(locator: Locator) {
  const rect = (await locator.boundingBox())!;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
async function drag(page: Page, from: string, through: string[]) {
  await board(page).scrollIntoViewIfNeeded();
  const start = await center(cell(page, from));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const coordinate of through) {
    const point = await center(cell(page, coordinate));
    // 중간 pointermove 없이 빨리 끌어도 지나온 칸을 채워야 한다.
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
}
async function walls(page: Page) {
  return board(page)
    .locator('.is-wall')
    .evaluateAll((cells) => cells.map((element) => element.getAttribute('data-maze-cell')));
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '그래프와 탐색', exact: true }).click();
  await page.getByRole('button', { name: '미로 BFS·DFS', exact: true }).click();
  await expect(page.getByRole('button', { name: '같이 탐색', exact: true })).toBeEnabled();
});

test('넓어진 기본 미로와 최대 315칸의 탐색·반응형 배치', async ({ page }) => {
  await expect(page.locator('.maze-cell')).toHaveCount(234);
  await expect(undo(page)).toBeDisabled();
  if (test.info().project.name === 'desktop-edge')
    expect((await board(page).boundingBox())!.width).toBeGreaterThan(550);
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(page.locator('[data-maze-comparison="bfs"] [data-maze-route]')).toHaveText(
    '12회 이동',
  );
  await page.screenshot({
    path: `test-results/${test.info().project.name}-maze-large-default.png`,
    fullPage: true,
  });
  await page.getByRole('combobox', { name: '미로 예제', exact: true }).selectOption('large');
  await expect(page.locator('.maze-cell')).toHaveCount(630);
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(page.locator('[data-maze-comparison="bfs"] [data-maze-route]')).toHaveText(
    '18회 이동',
    { timeout: 15000 },
  );
  await expect(page.locator('.maze-outcome')).toHaveText(['출구 발견', '출구 발견']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await board(page).evaluate((el) => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('첫 칸으로 생성·삭제를 고정하고 한 드래그를 한 번에 되돌린다', async ({ page }) => {
  await page.getByRole('combobox', { name: '미로 예제', exact: true }).selectOption('blank');
  await cell(page, '2,4').click();
  await drag(page, '2,2', ['2,6', '2,3', '2,6']);
  expect(await walls(page)).toEqual(['2,2', '2,3', '2,4', '2,5', '2,6']);
  await expect(page.locator('.maze-board').last().locator('.is-wall')).toHaveCount(5);
  await undo(page).click();
  expect(await walls(page)).toEqual(['2,4']);
  await redo(page).click();
  expect(await walls(page)).toEqual(['2,2', '2,3', '2,4', '2,5', '2,6']);
  await cell(page, '2,4').click(); // 삭제 중 지나갈 빈 칸
  await drag(page, '2,2', ['2,6', '2,2']);
  expect(await walls(page)).toEqual([]);
  await cell(page, '2,2').press('Control+z');
  expect(await walls(page)).toEqual(['2,2', '2,3', '2,5', '2,6']);
  await page.keyboard.press('Control+Shift+z');
  expect(await walls(page)).toEqual([]);
  await undo(page).click();
  await cell(page, '3,4').click();
  await expect(redo(page)).toBeDisabled();
});

test('끝점은 놓은 칸으로만 이동하고 지나간 벽과 취소한 이동을 보존한다', async ({ page }) => {
  await page.getByRole('combobox', { name: '미로 예제', exact: true }).selectOption('detour');
  const before = await walls(page);
  await drag(page, '3,1', ['2,2', '1,4']);
  await expect(cell(page, '1,4')).toHaveClass(/is-start/);
  expect(await walls(page)).toEqual(before);
  await undo(page).click();
  await expect(cell(page, '3,1')).toHaveClass(/is-start/);
  await drag(page, '3,7', ['2,6', '2,5']);
  await expect(cell(page, '2,5')).toHaveClass(/is-target/);
  expect(await walls(page)).toEqual(before.filter((coordinate) => coordinate !== '2,5'));
  await undo(page).click();
  expect(await walls(page)).toEqual(before);
  await expect(cell(page, '3,7')).toHaveClass(/is-target/);
  await board(page).scrollIntoViewIfNeeded();
  const start = await center(cell(page, '3,1'));
  const end = await center(cell(page, '1,3'));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(cell(page, '3,1')).toHaveClass(/is-start/);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const bounds = (await board(page).boundingBox())!;
  await page.mouse.move(bounds.x - 5, bounds.y + 10);
  await page.mouse.up();
  await expect(cell(page, '3,1')).toHaveClass(/is-start/);
  expect(await walls(page)).toEqual(before);
});

test('전체 지우기와 예제 변경도 되돌리고 새 편집은 비교 재생을 초기화한다', async ({ page }) => {
  const before = await walls(page);
  await page.getByRole('button', { name: '벽 모두 지우기', exact: true }).click();
  expect(await walls(page)).toEqual([]);
  await undo(page).click();
  expect(await walls(page)).toEqual(before);
  await page.getByRole('combobox', { name: '미로 예제', exact: true }).selectOption('blank');
  await undo(page).click();
  await expect(page.locator('.maze-cell')).toHaveCount(234);
  expect(await walls(page)).toEqual(before);
  await page.getByRole('button', { name: '같이 탐색', exact: true }).click();
  await expect(page.locator('[data-maze-discoveries]').first()).not.toHaveText('0칸');
  await cell(page, '1,2').click();
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
  await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toHaveCount(0);
  await undo(page).click();
  expect(await walls(page)).toEqual(before);
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
});

test.describe('터치 입력', () => {
  test.use({ hasTouch: true });
  test('한 번 탭하면 한 번만 토글한다', async ({ page }) => {
    await cell(page, '1,2').tap();
    await expect(cell(page, '1,2')).toHaveClass(/is-wall/);
    await cell(page, '1,2').tap();
    await expect(cell(page, '1,2')).not.toHaveClass(/is-wall/);
    await expect(
      page.locator('.maze-board').last().locator('[data-maze-cell="1,2"]'),
    ).not.toHaveClass(/is-wall/);
    await undo(page).click();
    await expect(cell(page, '1,2')).toHaveClass(/is-wall/);
  });
});
