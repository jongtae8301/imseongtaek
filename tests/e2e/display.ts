import type { Page } from '@playwright/test';

/** 기존 전체 실행 검사는 공개 UI의 펼치기 기능으로 여섯 영역을 관찰한다. */
export async function prepareWorkspace(page: Page) {
  const settings = page.getByRole('button', { name: '예제·설정', exact: true });
  if (await settings.isVisible()) await settings.click();
  const all = page.getByRole('button', { name: '모두 펼치기', exact: true });
  if (await all.isVisible()) await all.click();
}
export async function compactWorkspace(page: Page) {
  const settings = page.getByRole('button', { name: '설정 닫기', exact: true });
  if (await settings.isVisible()) await settings.click();
  const compact = page.getByRole('button', { name: '간단히 보기', exact: true });
  if (await compact.isVisible()) await compact.click();
  await page.getByRole('tab', { name: '코드', exact: true }).click();
}
