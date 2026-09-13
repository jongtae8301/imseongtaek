import { prepareWorkspace, compactWorkspace } from './display';
import { expect, test, type Page } from '@playwright/test';

async function next(page: Page, count: number) {
  for (let i = 0; i < count; i++)
    await page.getByRole('button', { name: '다음', exact: true }).click();
}
async function expectStep(page: Page, index: number | 'empty') {
  expect(
    await page
      .locator('[data-panel]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-step'))),
  ).toEqual(Array(6).fill(String(index)));
}

test('반복 방식의 학습 안내는 실제 변수에 맞고 비교 전환을 따라간다', async ({ page }) => {
  await page.goto('/');
  await prepareWorkspace(page);
  for (const problem of ['sum', 'factorial', 'fibonacci']) {
    await page.getByRole('combobox', { name: '예제 선택', exact: true }).selectOption(problem);
    await page.getByRole('combobox', { name: '실행 방식', exact: true }).selectOption('iterative');
    await page.getByRole('button', { name: '입력 적용', exact: true }).click();
    if (
      !(await page.locator('.lesson-guide').evaluate((node) => (node as HTMLDetailsElement).open))
    )
      await page.locator('.lesson-guide summary').click();
    await expect(page.locator('.lesson-guide')).toContainText(
      problem === 'fibonacci' ? 'a, b, i, next_value' : 'total, i, i ≤ n',
    );
    await expect(page.locator('.lesson-guide')).not.toContainText('left·right');
    await expect(page.locator('.learning-prompt')).toContainText(
      problem === 'fibonacci' ? 'next_value=a+b' : problem === 'factorial' ? 'total=1' : 'total=0',
    );
  }
  await page.getByRole('button', { name: '같은 입력으로 재귀·반복 비교', exact: true }).click();
  await page.getByRole('button', { name: '재귀 단계 보기', exact: true }).click();
  await expect(page.locator('.lesson-guide')).toContainText('left·right');
  await expect(page.locator('[data-panel="code"]')).toBeFocused();
  await page.getByRole('button', { name: '반복 과정', exact: true }).click();
  await expect(page.locator('.lesson-guide')).toContainText('next_value');
  await expect(page.locator('[data-panel="code"]')).toBeInViewport();
});

test('편집 미리보기는 실행 기록과 분리되고 미적용 문자·잘못된 트리에도 연결을 보존한다', async ({
  page,
}) => {
  await page.goto('/');
  await prepareWorkspace(page);
  await page.getByRole('button', { name: '그래프와 탐색' }).click();
  await page.locator('.graph-editor > summary').click();
  const preview = page.getByRole('region', { name: '편집 중인 그래프', exact: true });
  await expect(preview.locator('.graph-edge')).toHaveCount(6);
  await page.getByRole('button', { name: 'A에서 B 연결 해제', exact: true }).click();
  await expectStep(page, 'empty');
  await expect(preview.locator('.graph-edge')).toHaveCount(5);
  await expect(preview.locator('.draft-connections')).toContainText('선택 A · 연결된 정점: C');
  await expect(preview).not.toContainText('미발견');
  await page.getByRole('textbox', { name: '행렬 입력', exact: true }).fill('0 1');
  await expect(preview).toContainText('마지막으로 적용한 연결');
  await page.getByRole('button', { name: '표현 적용', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(preview.locator('.graph-edge')).toHaveCount(5);
  await expect(page.getByRole('button', { name: '탐색 준비', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '문자 입력 취소', exact: true }).click();
  await expect(preview).not.toContainText('마지막으로 적용한 연결');
  await page.getByRole('button', { name: '트리와 탐색' }).click();
  await page.locator('.graph-editor > summary').click();
  await page.getByRole('combobox', { name: '간선 시작', exact: true }).selectOption('D');
  await page.getByRole('combobox', { name: '간선 끝', exact: true }).selectOption('A');
  await page.getByRole('button', { name: '간선 연결', exact: true }).click();
  await page.getByRole('button', { name: '탐색 준비', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('루트는 부모가 없어야');
  await expect(preview.locator('.graph-edge')).toHaveCount(6);
  await expectStep(page, 'empty');
  await page.getByRole('button', { name: '간선 해제', exact: true }).click();
  await page.getByRole('button', { name: '탐색 준비', exact: true }).click();
  await expectStep(page, 0);
});

for (const workspace of ['그래프와 탐색', '트리와 탐색']) {
  test(`${workspace} 비교는 BFS 큐·DFS 프레임·독립된 위치를 복원하고 입력 변경을 반영한다`, async ({
    page,
  }) => {
    await page.goto('/');
    await prepareWorkspace(page);
    await page.getByRole('button', { name: workspace }).click();
    await next(page, 5);
    await page.getByRole('button', { name: 'BFS·DFS 결과 비교', exact: true }).click();
    await page.getByRole('button', { name: 'DFS 단계 보기', exact: true }).click();
    await expectStep(page, 0);
    await expect(page.locator('[data-panel="code"]')).toBeFocused();
    await expect(page.locator('[data-panel="code"]')).toBeInViewport();
    await next(page, 8);
    await expect(page.locator('.dfs-frames li')).toHaveCount(2);
    await expect(page.locator('.current-line')).toContainText('dfs(v)');
    await page.getByRole('button', { name: 'BFS 과정', exact: true }).click();
    await expectStep(page, 5);
    await expect(page.locator('[data-frontier]')).toContainText('빈 큐');
    await page.getByRole('button', { name: 'DFS 과정', exact: true }).click();
    await expectStep(page, 8);
    await page.getByRole('button', { name: '이전', exact: true }).click();
    await next(page, 1);
    await expect(page.locator('.dfs-frames li')).toHaveCount(2);
    await page.getByRole('button', { name: '자동 실행', exact: true }).click();
    await page.getByRole('button', { name: 'BFS 과정', exact: true }).click();
    await expect(page.getByRole('button', { name: '자동 실행', exact: true })).toBeVisible();
    await page.waitForTimeout(1100);
    await expectStep(page, 5);
    await page.getByRole('button', { name: '예제·설정', exact: true }).click();
    await expect(page.getByRole('combobox', { name: '실행 한도', exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: '이웃 방문 순서', exact: true }).selectOption('true');
    await expectStep(page, 'empty');
    await expect(page.locator('[data-comparison]')).toHaveCount(0);
    await page.getByRole('button', { name: '탐색 준비', exact: true }).click();
    await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
    await page.keyboard.press('End');
    await expect(page.locator('.run-summary')).toContainText('정상 종료');
    await page.getByRole('button', { name: 'BFS·DFS 결과 비교', exact: true }).click();
    await page.getByRole('button', { name: 'DFS 단계 보기', exact: true }).click();
    await expectStep(page, 0);
    await next(page, 3);
    await page.getByRole('button', { name: 'BFS 과정', exact: true }).click();
    await expect(page.locator('.run-summary')).toContainText('정상 종료');
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'DFS 과정', exact: true }).click();
    await expectStep(page, 3);
    await expect(page.getByRole('button', { name: '다음', exact: true })).toBeEnabled();
  });
}

test('관찰 화면은 학교 PC에서 시각화·선택 탭을 나란히, 모바일에서 한 영역씩 보여 준다', async ({
  page,
}) => {
  const mobile = page.viewportSize()!.width < 900;
  if (!mobile) await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await prepareWorkspace(page);
  await next(page, 3);
  await compactWorkspace(page);
  await expectStep(page, 3);
  await expect(page.getByRole('textbox', { name: '입력값 n' })).toBeHidden();
  if (mobile) {
    await expect(page.getByRole('tab')).toHaveCount(6);
    await expect(page.locator('[data-panel]:visible')).toHaveCount(1);
    await page.getByRole('tab', { name: '코드', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '현재 상태', exact: true })).toBeFocused();
    await expect(page.locator('[data-panel="state"]')).toBeVisible();
    await expectStep(page, 3);
    await next(page, 1);
    await page.getByRole('tab', { name: '실행 기록', exact: true }).click();
    await expect(page.locator('[data-panel="history"]')).toBeVisible();
    await page.getByRole('tab', { name: '실행 기록', exact: true }).press('Home');
    await expect(page.locator('.current-line')).toContainText('smaller = n - 1');
    await expectStep(page, 4);
    await page.getByRole('tab', { name: '분석', exact: true }).click();
    await page.getByRole('slider', { name: '실행 단계 이동' }).focus();
    await page.keyboard.press('End');
    await expectStep(page, 30);
    await page.getByRole('button', { name: '이전', exact: true }).click();
    await expectStep(page, 29);
    await page.getByRole('tab', { name: '코드', exact: true }).click();
    await expect(page.locator('.current-line')).toContainText('result = sum_to(n)');
    await expect
      .poll(async () => {
        const line = (await page.locator('.current-line').boundingBox())!;
        const code = (await page.locator('.source-code').boundingBox())!;
        return line.y >= code.y && line.y + line.height <= code.y + code.height;
      })
      .toBe(true);
  } else {
    await expect(page.locator('[data-panel]:visible')).toHaveCount(2);
    const clipped = await page
      .locator('[data-panel]:visible')
      .evaluateAll(
        (nodes) => nodes.filter((node) => node.scrollHeight > node.clientHeight + 2).length,
      );
    expect(clipped).toBe(0);
  }
  await page.screenshot({ path: `test-results/${test.info().project.name}-observation.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '예제·설정', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '입력값 n' })).toBeVisible();
  await expectStep(page, mobile ? 29 : 3);
});
