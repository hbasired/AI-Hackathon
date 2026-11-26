import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mockRegistries, watchErrors } from './mock';

/** Saving on our server, from two separate browsers. Made-up words, for these tests only. */
const WORDS = 'test only four words';
const NEWER = 'test only newer words';
const axe = async (page: Page, name: string) => {
  // Stamps fade in as they land. On a slow machine a half-faded stamp reads as low contrast, so measure once
  // every short animation has finished. Long or endless ones (the tour's timer, a spinner) are left alone.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity || Number(a.effect?.getTiming().duration) > 2000), undefined, { timeout: 5_000 });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${name}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
};
const unique = (n: string) => `${n} ${Date.now().toString(36)}`;

async function computer(page: Page) {
  await mockRegistries(page);
  await page.unroute('**/api/health');
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('pt-fresh')) {
      localStorage.removeItem('pt-session');
      sessionStorage.setItem('pt-fresh', '1');
      sessionStorage.setItem('pt-test-no-guest', '1');
    }
  });
}
async function create(page: Page, name: string) {
  await page.goto('/#/signin');
  await page.getByRole('button', { name: 'Create account' }).first().click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel(/^Passphrase, at least/).fill(WORDS);
  await page.getByLabel('The same passphrase again').fill(WORDS);
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 15_000 });
}
async function enter(page: Page, name: string, words = WORDS) {
  await page.goto('/#/signin');
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Passphrase', { exact: true }).fill(words);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
}
const project = async (page: Page, q: string) => {
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill(q);
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
};
const saved = (page: Page) => expect(page.getByRole('banner').getByText('Saved', { exact: true })).toBeVisible({ timeout: 20_000 });

test('work made on one computer opens on another, and only a locked copy travels', async ({ page, browser }) => {
  const errors = watchErrors(page);
  const sent: string[] = [];
  page.on('request', (r) => r.url().includes('/api/vault/') && sent.push(r.postData() ?? ''));
  await computer(page);
  const name = unique('Asha');
  await create(page, name);
  await project(page, 'Zebrafish behaviour in a quiet harbour');
  await page.waitForTimeout(3000);
  await saved(page);
  await page.goto('/#/account');
  await expect(page.getByText('Your work is saved')).toBeVisible();
  await axe(page, 'account saved online');
  expect(sent.length).toBeGreaterThan(1);
  for (const s of sent) for (const secret of [WORDS, 'Zebrafish', 'harbour', name]) expect(s).not.toContain(secret);

  const other: BrowserContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5199' });
  const there = await other.newPage();
  await computer(there);
  await enter(there, name, NEWER);
  await expect(there.getByRole('alert')).toContainText('do not match', { timeout: 15_000 });
  await there.getByLabel('Passphrase', { exact: true }).fill(WORDS);
  await there.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(there.getByText('Zebrafish behaviour in a quiet harbour')).toBeVisible({ timeout: 15_000 });
  await project(there, 'Added on the second computer');
  await there.waitForTimeout(3000);
  await saved(there);
  await other.close();

  // Back here: nothing new was done, so the newer work comes in by itself.
  await page.reload();
  await page.goto('/#/home');
  await expect(page.getByText('Added on the second computer')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('both computers changed: the student chooses, and a taken name is refused', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await computer(page);
  const name = unique('Ben');
  await create(page, name);
  await project(page, 'Shared question');
  await page.waitForTimeout(3000);
  await saved(page);

  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:5199' });
  const there = await other.newPage();
  await computer(there);
  await there.goto('/#/signin');
  await there.getByRole('button', { name: 'Create account' }).first().click();
  await there.getByLabel('Name', { exact: true }).fill(name);
  await there.getByLabel(/^Passphrase, at least/).fill(NEWER);
  await there.getByLabel('The same passphrase again').fill(NEWER);
  await there.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(there.getByRole('alert')).toContainText('That name is taken', { timeout: 15_000 });
  await enter(there, name);
  await expect(there.getByText('Shared question')).toBeVisible({ timeout: 15_000 });
  await project(there, 'Only on the second computer');
  await there.waitForTimeout(3000);
  await saved(there);
  await other.close();

  await project(page, 'Only on the first computer');
  await expect(page.getByText('Choose a copy')).toBeVisible({ timeout: 20_000 });
  await page.getByText('Choose a copy').click();
  await expect(page.getByText('Another computer saved newer work')).toBeVisible();
  await axe(page, 'conflict');
  await page.getByRole('button', { name: 'Open the newer work' }).click();
  await saved(page);
  await page.goto('/#/home');
  await expect(page.getByText('Only on the second computer')).toBeVisible();
  await expect(page.getByText('Only on the first computer')).toHaveCount(0);
});

test('the server is down: work stays here, says so, and is saved when it is back', async ({ page }) => {
  test.setTimeout(90_000);
  await computer(page);
  const name = unique('Cleo');
  await create(page, name);
  await saved(page);
  await page.route('**/api/vault/**', (r) => r.abort());
  await project(page, 'Written while the server was down');
  await expect(page.getByText('Not online')).toBeVisible({ timeout: 20_000 });
  await page.goto('/#/account');
  await expect(page.getByText('Your work is safe on this device')).toBeVisible();
  await page.unroute('**/api/vault/**');
  await page.getByRole('button', { name: 'Save now' }).click();
  await saved(page);
});
