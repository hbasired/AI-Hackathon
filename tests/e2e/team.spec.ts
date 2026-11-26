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
const step = (page: Page, name: string | RegExp) => page.getByLabel('Your trail').getByRole('link', { name }).click();
const ABSTRACT: Record<string, string> = JSON.parse(readFileSync('tests/unit/fixtures/abstracts.json', 'utf8'));

async function withAbstracts(page: Page) {
  await mockRegistries(page);
  const store = JSON.parse(readFileSync('tests/unit/fixtures/registry.json', 'utf8'));
  const dress = (w: any) => {
    const t = ABSTRACT[String(w.doi ?? '').replace('https://doi.org/', '')];
    return t ? { ...w, abstract_inverted_index: Object.fromEntries(Object.entries(Object.groupBy(t.split(' ').map((x, i) => [x, i] as const), ([x]) => x)).map(([k, v]) => [k, v!.map(([, i]) => i)])) } : w;
  };
  const works = Object.entries(store).filter(([u, r]: any) => u.startsWith('https://api.openalex.org/works/doi:') && r.status === 200).map(([, r]: any) => dress(r.body));
  await page.route(/\/api\/registry\?url=https%3A%2F%2Fapi\.openalex\.org/, (r) => {
    const url = new URL(r.request().url()).searchParams.get('url') ?? '';
    if (url.includes('/works?')) return r.fulfill({ json: { results: works } });
    const hit = store[url];
    return hit ? r.fulfill({ status: hit.status, json: hit.status === 200 ? dress(hit.body) : {} }) : r.fulfill({ status: 503, json: {} });
  });
}

test('the team goes round, stops at every gate, and cannot open one', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await withAbstracts(page);
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('Does working from home improve employee performance?');
  await page.getByText('No AI', { exact: true }).click();
  await page.getByRole('button', { name: 'Start project' }).click();
  await step(page, 'Team');
  await expect(page.getByRole('listitem').filter({ hasText: 'You approve the searches' })).toContainText('Closed');
  await expect(page.locator('li[data-state=locked]')).toHaveCount(3);
  await axe(page, 'team idle');

  // Gate 1: pressing Start again and again never searches.
  let searches = 0;
  page.on('request', (r) => { if (r.url().includes('api.openalex.org%2Fworks%3F')) searches++; });
  await page.getByRole('button', { name: 'Start the team' }).click();
  await expect(page.getByRole('heading', { name: 'Gate 1. Approve the searches' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Gate 1. Approve the searches' })).toBeVisible();
  expect(searches).toBe(0);
  await axe(page, 'team gate 1');
  await page.getByRole('button', { name: 'Approve and go on' }).click();

  // Gate 2: the Analyst reads nothing before something is kept.
  await expect(page.getByRole('heading', { name: 'Gate 2. Keep or skip' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByLabel('Agents in order')).toContainText(/\d+ of \d+ confirmed/);
  await page.getByRole('link', { name: 'Choose papers' }).click();
  // Find shows the team's results and does not search again.
  const before = searches;
  await expect(page.getByText(/works found, \d+ waiting for you/)).toBeVisible();
  expect(searches).toBe(before);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Keep', exact: true }).first().click();
  await step(page, 'Team');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Agents in order')).toContainText(/\d of \d papers read/, { timeout: 60_000 });
  await expect(page.getByLabel('Agents in order')).toContainText(/to fix, \d+ to look at again/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: 'Gate 3. Your claims' })).toBeVisible();
  await axe(page, 'team done');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'team');
  await page.setViewportSize({ width: 1280, height: 800 });
  // After a reload the board still knows.
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: 'You approve the searches' })).toContainText('Opened by you');
  await expect(page.locator('li[data-state=done]').filter({ hasText: 'Reviewer' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('read, compare, check a sentence, review a draft with three mistakes', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await withAbstracts(page);
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('Does working from home improve employee performance?');
  await page.getByRole('button', { name: 'Start project' }).click();
  await step(page, 'Read');
  await expect(page.getByText('No papers to read yet')).toBeVisible();
  await step(page, 'Library');
  for (const [i, d] of ['10.1093/qje/qju032', '10.1126/science.adh2586'].entries()) {
    if (i) await page.getByRole('button', { name: 'Add a source' }).click();
    await page.getByLabel('DOI, DOI link or title').fill(d);
    await page.getByRole('button', { name: 'Check and add', exact: true }).click();
    await expect(page.getByText(`${i} of ${i + 1} ready to cite`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
  }
  await step(page, 'Read');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('combobox', { name: 'Paper' }).selectOption({ index: i });
    const get = page.getByRole('button', { name: 'Get the abstract' });
    if (await get.isVisible()) await get.click();
    await expect(page.getByText(/sentences sorted/)).toBeVisible({ timeout: 15_000 });
  }
  await axe(page, 'read');
  await page.getByRole('combobox', { name: 'Paper' }).selectOption({ index: 0 });
  await page.getByRole('button', { name: 'What are the main findings?' }).click();
  await expect(page.locator('dl blockquote').first()).toContainText(/13% performance increase|raised productivity/);
  await page.getByRole('button', { name: 'Everything' }).click();
  await page.getByRole('button', { name: 'Save passage' }).first().click();
  await expect(page.getByText('Passage saved to your notes.')).toBeVisible();
  await expect(page.getByText(/^Not found\./).first()).toBeVisible();

  await page.getByRole('button', { name: 'Compare papers' }).click();
  await expect(page.getByLabel('Comparison').locator('tbody tr')).toHaveCount(11);
  await axe(page, 'compare');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download as a spreadsheet' }).click()]);
  expect(readFileSync(await csv.path(), 'utf8')).toContain('13% performance increase');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'compare');
  await page.setViewportSize({ width: 1280, height: 800 });

  // A sentence sent to Evidence arrives with its source, and is called the source's own words.
  await page.getByRole('button', { name: 'Read one paper' }).click();
  await page.getByRole('combobox', { name: 'Paper' }).selectOption({ label: 'Does Working from Home Work? Evidence from a Chinese Experiment' });
  await page.locator('dd', { hasText: '13% performance increase' }).getByRole('button', { name: 'Check in Evidence' }).click();
  await expect(page.getByLabel('Your claim')).toHaveValue(/13% performance increase/);
  await page.getByRole('button', { name: 'Find the sentence' }).click();
  await expect(page.getByLabel('Result').locator('.stamp')).toHaveText(/Verified$/);
  await expect(page.getByText('These are the source’s own words.')).toBeVisible();

  await step(page, 'Write');
  await page.getByLabel('Your draft').fill('Home working led to a 13% performance increase (Bloom et al., 2015). ChatGPT cut the average time taken by 18% (Noy & Zhang, 2023). Trust falls over time (Okonjo, 2022). Output rose by 12% in other firms.');
  await expect(page.getByText('saved on this device')).toBeVisible();
  await step(page, 'Review');
  await expect(page.getByText('1 citation in your draft is not in your library')).toBeVisible();
  await expect(page.getByText('A sentence says something its source does not')).toBeVisible();
  await expect(page.getByText('1 sentence with a result or a figure and no citation')).toBeVisible();
  const line = (t: string) => page.locator('li[data-label]').filter({ hasText: t });
  await expect(line('13% performance increase').first()).toHaveAttribute('data-label', 'verified');
  await expect(line('by 18%')).toHaveAttribute('data-label', 'disputed');
  await expect(line('Okonjo')).toHaveAttribute('data-label', 'not-found');
  await axe(page, 'review');
  await page.getByRole('button', { name: 'I have read this review' }).click();
  await expect(page.getByText('Recorded in your log.')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'review');
  expect(errors).toEqual([]);
});
