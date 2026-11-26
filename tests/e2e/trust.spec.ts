import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockRegistries, watchErrors } from './mock';

const axe = async (page: Page, name: string) => {
  // Stamps fade in as they land. On a slow machine a half-faded stamp reads as low contrast, so measure once
  // every short animation has finished. Long or endless ones (the tour's timer, a spinner) are left alone.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity || Number(a.effect?.getTiming().duration) > 2000), undefined, { timeout: 5_000 });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${name}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
};
const noSideways = async (page: Page, name: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), name).toBeLessThanOrEqual(1);
const step = (page: Page, name: string | RegExp) => page.getByLabel('Your trail').getByRole('link', { name }).click();

test('whatever is typed into Check gets a label, and nothing unchecked looks real', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/check');
  for (const t of ['Zyxwv Qwertyson', 'asdf qwer zxcv', '!!!']) {
    await page.getByLabel('Text to check').fill(t);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'This could not be verified' })).toBeVisible();
    await expect(page.locator('main [role=status] .stamp')).toHaveText(/Not yet verified$/);
    await expect(page.locator('main [role=status]')).toContainText(t);
    await expect(page.locator('main .t-ok:visible')).toHaveCount(0);
  }
  await axe(page, 'check, nothing to look up');
  await page.getByText('What the labels mean').click();
  for (const t of ['Confirmed', 'Not yet verified', 'AI suggestion', 'Disputed']) await expect(page.locator('details[open] .stamp', { hasText: t }).first()).toBeVisible();
  await axe(page, 'check, labels open');
  await page.getByLabel('Text to check').fill('10.1073/pnas.1523821113');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('This could not be verified. None of the registries').first()).toBeVisible({ timeout: 20_000 });
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'check');
  expect(errors).toEqual([]);
});

test('every reference in Write and Export carries its label, and the exported list does not', async ({ page, context }) => {
  const errors = watchErrors(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockRegistries(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('Does working from home improve employee performance?');
  await page.getByRole('button', { name: 'Start project' }).click();
  await step(page, 'Library');
  await page.getByLabel('DOI, DOI link or title').fill('10.1093/qje/qju032');
  await page.getByRole('button', { name: 'Check and add', exact: true }).click();
  await expect(page.getByText('0 of 1 ready to cite')).toBeVisible({ timeout: 20_000 });
  // Added is not approved: the reference list is still empty.
  await step(page, 'Export');
  await expect(page.getByRole('heading', { name: 'Nothing to export yet' })).toBeVisible();
  await expect(page.locator('main li .stamp', { hasText: 'Confirmed' }).first()).toBeVisible();
  await step(page, 'Library');
  await page.locator('main ul > li > button').first().click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('1 of 1 ready to cite')).toBeVisible();

  await step(page, 'Write');
  await page.getByLabel('Your draft').fill('It helped (Bloom et al., 2015). It faded (Hargrove, 2024).');
  const margin = page.getByLabel('Citation checks');
  await expect(margin.locator('li', { hasText: 'Hargrove' }).locator('.stamp')).toHaveText(/Not yet verified$/);
  await expect(margin.locator('li', { hasText: 'Does Working from Home Work' }).locator('.stamp')).toHaveText(/Confirmed$/);
  await page.getByRole('button', { name: 'Cite', exact: true }).click();
  await expect(page.locator('#cite-list [role=option] .stamp')).toHaveText(/Confirmed$/);
  await axe(page, 'write labels');
  await page.keyboard.press('Escape');

  await step(page, 'Export');
  const sheet = page.getByLabel('Reference list preview');
  await expect(sheet.locator('.stamp')).toHaveText(/Confirmed$/);
  await expect(sheet.getByText('Approved by you')).toBeVisible();
  await axe(page, 'export labels');
  await page.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByText('Copied list ready.')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('https://doi.org/10.1093/qje/qju032');
  expect(copied).not.toMatch(/Confirmed|Approved by you/);
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'export');
  expect(errors).toEqual([]);
});

test('the tour approves nothing', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await page.goto('/#/home');
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: 'Take the tour', exact: true }).click();
  const bar = page.getByLabel('Tour', { exact: true });
  for (const h of ['Check references', 'Plan the search', 'Library']) {
    if (h === 'Plan the search') await bar.getByRole('button', { name: 'Next' }).click();
    if (h !== 'Check references') await bar.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible({ timeout: 15_000 });
  }
  await bar.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(/^0 of 3 ready to cite/)).toBeVisible({ timeout: 25_000 });
  expect(errors).toEqual([]);
});

test('phone: two rows at the top, and Search is in the menu', async ({ page }) => {
  await mockRegistries(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/check');
  expect((await page.locator('header').first().boundingBox())!.height).toBeLessThan(96);
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeHidden();
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /Find a page/ })).toBeFocused();
});
