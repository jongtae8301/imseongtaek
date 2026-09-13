import { expect, test, type Page } from '@playwright/test';
import { prepareWorkspace } from './display';

async function graphEditor(page: Page, tree = false) {
  await page.goto('/');
  await prepareWorkspace(page);
  await page
    .getByRole('button', { name: tree ? '트리와 탐색' : '그래프와 탐색', exact: true })
    .click();
  await page.locator('.graph-editor > summary').click();
}
const node = (page: Page, vertex: string) =>
  page.getByRole('button', { name: `미리보기에서 ${vertex} 선택 · 정점`, exact: true });
async function maze(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '그래프와 탐색', exact: true }).click();
  await page.getByRole('button', { name: '미로 BFS·DFS', exact: true }).click();
  await expect(page.getByRole('button', { name: '같이 탐색', exact: true })).toBeEnabled();
}

test('그림의 정점·간선 편집 ↔ 행렬·리스트 동기화와 미적용 문자 보호', async ({ page }) => {
  await graphEditor(page);
  await page.getByRole('button', { name: '연결하기', exact: true }).click();
  await node(page, 'A').press('Enter');
  await node(page, 'F').press('Space');
  await expect(
    page.getByRole('button', { name: 'A에서 F 연결 해제', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'F에서 A 연결 해제', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '인접리스트 편집', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '리스트 입력' })).toHaveValue(/A: B C F/);
  await page.getByRole('button', { name: '연결 지우기', exact: true }).click();
  await page.getByRole('button', { name: '편집 간선 A ↔ F 해제', exact: true }).press('Enter');
  await expect(page.getByRole('textbox', { name: '리스트 입력' })).toHaveValue(/A: B C\n/);
  const text = page.getByRole('textbox', { name: '리스트 입력' });
  await text.fill('A: B\nB: A\nC:');
  await expect(page.getByRole('button', { name: '정점 넣기', exact: true })).toBeDisabled();
  await node(page, 'A').press('Enter');
  await expect(text).toHaveValue('A: B\nB: A\nC:');
  await page.getByRole('button', { name: '표현 적용', exact: true }).click();
  await expect(node(page, 'C')).toBeVisible();
  await expect(node(page, 'F')).toHaveCount(0);
  await page.getByRole('button', { name: '정점 지우기', exact: true }).click();
  await node(page, 'C').press('Enter');
  await expect(text).toHaveValue('A: B\nB: A');
  await node(page, 'B').press('Enter');
  await node(page, 'A').press('Enter');
  await expect(page.getByRole('alert')).toContainText('1');
  await expect(node(page, 'A')).toBeVisible();
});

test('끌어 배치는 실행 기록을 보존하고 빈 곳을 누르면 정점을 넣는다', async ({ page }) => {
  await graphEditor(page);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  const before = await node(page, 'A').getAttribute('transform');
  await node(page, 'A').scrollIntoViewIfNeeded();
  const box = (await node(page, 'A').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 35, box.y + 75, { steps: 8 });
  await page.mouse.up();
  await expect(node(page, 'A')).not.toHaveAttribute('transform', before!);
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', '1');
  await page.getByRole('button', { name: '정점 넣기', exact: true }).click();
  const canvas = page.getByRole('group', { name: '편집 중인 그래프 연결', exact: true });
  const canvasBox = (await canvas.boundingBox())!;
  // 화면 크기에 따라 정점 위치가 달라지므로 공통 빈 여백을 누른다.
  await canvas.click({ position: { x: canvasBox.width - 12, y: canvasBox.height - 12 } });
  await expect(node(page, 'G')).toBeVisible();
  await expect(page.locator('[data-panel="state"]')).toHaveAttribute('data-step', 'empty');
  await expect(page.getByRole('textbox', { name: '행렬 입력' })).toHaveValue(/(?:[01] ){6}[01]/);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-graph-gui.png`,
    fullPage: true,
  });
});

test('트리 그림의 부모→자식 편집과 잘못된 트리 검증', async ({ page }) => {
  await graphEditor(page, true);
  await page.getByRole('button', { name: '연결하기', exact: true }).click();
  await node(page, 'B').press('Enter');
  await node(page, 'C').press('Enter');
  await expect(page.getByRole('button', { name: 'B에서 C 연결 해제', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'C에서 B 연결 추가', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '탐색 준비', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: '연결 지우기', exact: true }).click();
  await page.getByRole('button', { name: '편집 간선 B → C 해제', exact: true }).press('Enter');
  await page.getByRole('button', { name: '탐색 준비', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다음', exact: true })).toBeEnabled();
});

test('미로 비교 전용 화면에 두 편집 그림과 발견량·경로만 나란히 표시한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await maze(page);
  await expect(page.locator('.maze-board')).toHaveCount(2);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.locator('[data-panel], .playback')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '예제·설정', exact: true })).toHaveCount(0);
  const bfs = page.locator('[data-maze-comparison="bfs"]'),
    dfs = page.locator('[data-maze-comparison="dfs"]');
  const b = (await bfs.boundingBox())!,
    d = (await dfs.boundingBox())!;
  if (test.info().project.name === 'desktop-edge') {
    expect(Math.abs(b.y - d.y)).toBeLessThan(2);
    expect(d.x).toBeGreaterThan(b.x + b.width);
  } else expect(d.y).toBeGreaterThan(b.y + b.height);
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(bfs.locator('[data-maze-route]')).toHaveText('6회 이동');
  await expect(dfs.locator('[data-maze-route]')).toHaveText('10회 이동');
  await expect(bfs.locator('[data-maze-discoveries]')).toHaveText('18칸');
  await expect(dfs.locator('[data-maze-discoveries]')).toHaveText('11칸');
  const finished = await dfs.innerText();
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await expect(bfs.locator('[data-maze-discoveries]')).toHaveText('17칸');
  expect(await dfs.innerText()).toBe(finished);
  await page.getByRole('button', { name: '한 칸씩', exact: true }).click();
  await expect(bfs.locator('[data-maze-route]')).toHaveText('6회 이동');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'test-results/' + test.info().project.name + '-maze-duet.png',
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('어느 그림의 편집도 양쪽에 적용하고 키보드·끝점 보호·0회 이동을 유지한다', async ({
  page,
}) => {
  await maze(page);
  const left = page.getByRole('group', { name: 'BFS 비교 미로', exact: true });
  const right = page.getByRole('group', { name: 'DFS 비교 미로', exact: true });
  await left.getByRole('button', { name: /^3행 2열/ }).click();
  await expect(right.getByRole('button', { name: /^3행 2열/ })).toHaveAttribute(
    'aria-label',
    '3행 2열 · 벽',
  );
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
  await page.getByRole('button', { name: '길 열기', exact: true }).click();
  await right.getByRole('button', { name: /^3행 1열/ }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(left.getByRole('button', { name: /^3행 2열/ })).toHaveAttribute(
    'aria-label',
    '3행 2열 · 미발견',
  );
  await page.getByRole('button', { name: '출구 옮기기', exact: true }).click();
  await right.getByRole('button', { name: /^3행 1열/ }).click();
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(page.locator('[data-maze-route]')).toHaveText(['0회 이동', '0회 이동']);
  await page.getByRole('button', { name: '출발 옮기기', exact: true }).click();
  await left.getByRole('button', { name: /^1행 1열/ }).click();
  await expect(right.getByRole('button', { name: /^1행 1열/ })).toHaveAttribute(
    'aria-label',
    '1행 1열 · 출발 · 미발견',
  );
  await page.getByRole('button', { name: '벽 놓기', exact: true }).click();
  await right.getByRole('button', { name: /^1행 1열/ }).click();
  await expect(page.getByRole('alert')).toContainText('출발·출구');
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
});

test('공통 재생·일시 정지·이전→다음 복원과 재생 중 편집 초기화', async ({ page }) => {
  await maze(page);
  await page.getByRole('combobox', { name: '재생 속도', exact: true }).selectOption('500');
  await page.getByRole('button', { name: '같이 탐색', exact: true }).click();
  await expect(page.locator('[data-maze-discoveries]').first()).not.toHaveText('0칸');
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  const before = await page.locator('.maze-duet').innerText();
  const steps = await page
    .locator('[data-maze-comparison]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-step')));
  await page.waitForTimeout(800); // 정지한 두 그림에 예약된 재생이 남지 않는지 확인한다.
  expect(await page.locator('.maze-duet').innerText()).toBe(before);
  await page.getByRole('button', { name: '이전', exact: true }).click();
  await page.getByRole('button', { name: '한 칸씩', exact: true }).click();
  expect(await page.locator('.maze-duet').innerText()).toBe(before);
  expect(
    await page
      .locator('[data-maze-comparison]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-step'))),
  ).toEqual(steps);
  await page.getByRole('button', { name: '같이 탐색', exact: true }).click();
  await page
    .getByRole('group', { name: 'DFS 비교 미로', exact: true })
    .getByRole('button', { name: /^3행 2열/ })
    .click();
  await expect(page.getByRole('button', { name: '일시 정지', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
  await expect(page.locator('[data-maze-route]')).toHaveText(['아직 없음', '아직 없음']);
  await page.getByRole('button', { name: '한 칸씩', exact: true }).click();
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['1칸', '1칸']);
});

test('최대 격자·도달 불가·순서 변경·활동 전환과 페이지 잘림 방지', async ({ page }) => {
  await maze(page);
  const sample = page.getByRole('combobox', { name: '미로 예제', exact: true });
  await sample.selectOption('blank');
  await page.getByRole('button', { name: '같이 탐색', exact: true }).click();
  await sample.selectOption('blocked');
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(page.locator('.maze-outcome')).toHaveText(['도달 불가', '도달 불가']);
  await sample.selectOption('blank');
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(page.locator('[data-maze-comparison="bfs"] [data-maze-route]')).toHaveText(
    '12회 이동',
  );
  await expect(page.locator('.maze-cell')).toHaveCount(98);
  const clipped = await page.locator('#workspace *').evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const el = node as HTMLElement,
          css = getComputedStyle(el);
        return (
          el.clientHeight > 1 &&
          el.clientWidth > 1 &&
          !el.closest('.sr-only') &&
          ['hidden', 'auto', 'scroll', 'clip'].includes(css.overflowY) &&
          el.scrollHeight > el.clientHeight + 2
        );
      })
      .map((el) => el.className),
  );
  expect(clipped).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.maze-extra > summary').click();
  await page.getByRole('combobox', { name: '이웃 방문 순서', exact: true }).selectOption('true');
  await expect(page.locator('[data-maze-discoveries]')).toHaveText(['0칸', '0칸']);
  await page.getByRole('button', { name: '결과 비교', exact: true }).click();
  await expect(page.locator('[data-maze-comparison="bfs"] [data-maze-route]')).toHaveText(
    '12회 이동',
  );
  await page.screenshot({
    path: 'test-results/' + test.info().project.name + '-maze-duet-49.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: '그래프 편집·탐색', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('그래프');
  await expect(page.locator('[data-panel="code"]')).toHaveAttribute('data-step', '0');
});
