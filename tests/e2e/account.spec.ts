import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockRegistries, watchErrors } from './mock';

const axe = async (page: Page, name: string) => {
  // Stamps fade in as they land. On a slow machine a half-faded stamp reads as low contrast, so measure once
  // every short animation has finished. Long or endless ones (the tour's timer, a spinner) are left alone.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity || Number(a.effect?.getTiming().duration) > 2000), undefined, { timeout: 5_000 });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${name}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
};
const noSideways = async (page: Page, name: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), name).toBeLessThanOrEqual(1);
/** Made-up words for these tests only. */
const WORDS = 'test only four words';
const NEWER = 'test only newer words';

async function fresh(page: Page) {
  await mockRegistries(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('pt-fresh')) {
      localStorage.removeItem('pt-session');
      sessionStorage.setItem('pt-fresh', '1');
      sessionStorage.setItem('pt-test-no-guest', '1');
    }
  });
}
async function create(page: Page, name: string, words = WORDS) {
  await page.getByRole('button', { name: 'Create account' }).first().click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel(/^Passphrase, at least/).fill(words);
  await page.getByLabel('The same passphrase again').fill(words);
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 15_000 });
}

test('sign up, reload, sign out, wrong passphrase, sign in, separate libraries', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
  // A private page asks you to sign in, then takes you where you were going.
  await page.goto('/#/projects');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await axe(page, 'sign up');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'sign up');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByLabel('Name', { exact: true }).fill('Asha');
  await page.getByLabel(/^Passphrase, at least/).fill('short');
  await page.getByLabel('The same passphrase again').fill('short');
  await page.locator('form').getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 10 characters');
  await create(page, 'Asha');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await page.getByLabel('What are you researching?').fill('A question only Asha should see');
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
  await page.goto('/#/home');
  await expect(page.getByRole('heading', { name: 'Hello, Asha' })).toBeVisible();
  await expect(page.getByText('A question only Asha should see')).toBeVisible();
  await axe(page, 'home');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'home');
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByRole('link', { name: 'Asha', exact: true }).click();
  await axe(page, 'account');
  await page.getByRole('button', { name: 'Sign out and lock' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  // Nothing readable is left behind.
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).filter((n) => n!.startsWith('paper-trail-') && n !== 'paper-trail-accounts'))).toEqual([]);

  await create(page, 'Ben', NEWER);
  await page.goto('/#/projects');
  await expect(page.getByText('No projects yet.')).toBeVisible();
  await page.goto('/#/account');
  await page.getByRole('button', { name: 'Sign out and lock' }).click();

  await page.getByLabel('Name', { exact: true }).fill('asha');
  await page.getByLabel('Passphrase', { exact: true }).fill(NEWER);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.getByLabel('Passphrase', { exact: true }).fill(WORDS);
  await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Asha' })).toBeVisible();
  await expect(page.getByText('A question only Asha should see')).toBeVisible();
  expect(errors).toEqual([]);
});

test('change passphrase, backup, restore, delete account', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
  await page.goto('/#/signin');
  await create(page, 'Asha');
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('Kept in the backup file');
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
  await page.goto('/#/account');
  await page.getByLabel('Passphrase for this file').fill(NEWER);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
  const path = await file.path();
  expect(readFileSync(path, 'utf8')).not.toContain('Kept in the backup');

  await page.getByLabel('Passphrase now').fill(WORDS);
  await page.getByLabel('New passphrase', { exact: true }).fill(NEWER);
  await page.getByLabel('New passphrase again').fill(NEWER);
  await page.getByRole('button', { name: 'Change passphrase' }).click();
  await expect(page.getByText('Passphrase changed.')).toBeVisible();

  // Empty the library, then bring it back.
  await page.goto('/#/rules');
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await page.goto('/#/account');
  await expect(page.getByText('0 projects')).toBeVisible();
  await page.getByLabel('Backup file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: readFileSync(path) });
  await page.getByLabel('Passphrase of the file').fill(NEWER);
  await page.getByRole('button', { name: 'Open backup' }).click();
  await expect(page.getByRole('alert')).toContainText('Tick the box first');
  await page.getByLabel('Replace what is in this library now').check();
  await page.getByLabel('Passphrase of the file').fill('not the right words');
  await page.getByRole('button', { name: 'Open backup' }).click();
  await expect(page.getByRole('alert')).toContainText('does not open this file');
  await page.getByLabel('Passphrase of the file').fill(NEWER);
  await page.getByRole('button', { name: 'Open backup' }).click();
  await expect(page.getByText('Backup opened.')).toBeVisible();
  await expect(page.getByText('1 project,')).toBeVisible();

  await page.getByLabel('Type your passphrase to delete').fill(WORDS);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('alert').last()).toContainText('do not match');
  await page.getByLabel('Type your passphrase to delete').fill(NEWER);
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('guest, then an account that keeps the guest work', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
  await page.goto('/#/home');
  await page.getByRole('button', { name: 'Continue as guest' }).click();
  await expect(page.getByRole('heading', { name: 'Your desk' })).toBeVisible();
  await page.getByRole('link', { name: 'New project' }).click();
  await page.getByLabel('What are you researching?').fill('Started before signing up');
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
  await page.getByRole('link', { name: 'Guest: sign in' }).click();
  await create(page, 'Chen');
  await expect(page.getByRole('heading', { name: 'Hello, Chen' })).toBeVisible();
  await expect(page.getByText('Started before signing up')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a sign-in link can never send you to another site', async ({ page }) => {
  await fresh(page);
  for (const next of ['https://evil.example/', '//evil.example', '/p/../../x', 'javascript:alert(1)', '/home%E0%A4%A']) {
    await page.goto(`/#/signin?next=${encodeURIComponent(next)}`);
    await page.reload();
    await page.getByRole('button', { name: 'Continue as guest' }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:5199\/#\/home$/);
  }
});

test('Back goes where you came from, and never leaves the site', async ({ page }) => {
  await mockRegistries(page);
  await page.goto('/#/rules');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/home');
  await page.getByRole('link', { name: 'Projects' }).first().click();
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('link', { name: 'Integrity Lab' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#\/projects$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/#\/home$/);
  // Opened straight on a deep page in a new tab.
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('A question for the back button');
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
  const url = page.url().replace('/plan', '/evidence');
  const tab = await page.context().newPage();
  await mockRegistries(tab);
  await tab.goto(url);
  await tab.getByRole('button', { name: 'Back' }).click();
  // Up to the project's own address, which opens on Plan while the plan is not approved.
  await expect(tab).toHaveURL(/#\/p\/[^/]+$/);
  await expect(tab.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
  await tab.close();
});
