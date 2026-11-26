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

test('add, tag, filter, approve, cite, export', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('Does generative AI raise productivity?');
  await page.getByText('No AI', { exact: true }).click();
  await page.getByRole('button', { name: 'Start project' }).click();

  // Empty states
  await step(page, 'Library');
  await expect(page.getByText('Nothing here yet')).toBeVisible();
  await axe(page, 'library empty');
  await step(page, 'Export');
  await expect(page.getByText('Nothing to export yet')).toBeVisible();
  await step(page, 'Write');
  await expect(page.getByText('Nothing is ready to cite.')).toBeVisible();

  // Add by DOI
  await step(page, 'Library');
  await page.getByLabel('DOI, DOI link or title').fill('https://doi.org/10.1126/science.adh2586');
  await page.getByRole('button', { name: 'Check and add', exact: true }).click();
  await expect(page.getByText('0 of 1 ready to cite')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('You approved this source.')).toBeVisible();
  await expect(page.getByText('1 of 1 ready to cite')).toBeVisible();

  // The same DOI again is not a second source
  await page.getByRole('button', { name: 'Add a source' }).click();
  await page.getByLabel('DOI, DOI link or title').fill('10.1126/science.adh2586');
  await page.getByRole('button', { name: 'Check and add', exact: true }).click();
  // Siddal, 26 November: duplicates are reported in the list view, and never saved twice.
  await expect(page.getByText(/0 added, 1 duplicate not saved twice\./)).toBeVisible({ timeout: 20_000 });

  // BibTeX with a wrong year is flagged, and needs a reason
  await page.getByRole('button', { name: 'BibTeX or RIS' }).click();
  await page.getByLabel('Paste BibTeX or RIS, or choose a file').fill('@article{k,\n title={Increasing Returns and Economic Geography},\n author={Krugman, Paul},\n year={2004},\n doi={10.1086/261763}\n}');
  await page.getByRole('button', { name: 'Check and add all' }).click();
  await expect(page.getByText('1 of 2 ready to cite')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Keep with this reason' }).click();
  await expect(page.getByRole('alert')).toContainText('at least 12 characters');

  // A web page is never checked
  await page.getByRole('button', { name: 'Web page', exact: true }).click();
  await page.getByLabel('Address').fill('https://example.org/guidance');
  await page.getByLabel('Page title').fill('Guidance on Generative Tools');
  await page.getByLabel('Author or organisation').fill('Example University');
  await page.getByLabel('Year, if the page gives one').fill('2025');
  await page.getByRole('button', { name: 'Add web page' }).click();
  await expect(page.getByText('1 of 3 ready to cite')).toBeVisible();
  await page.getByLabel(/Why are you keeping this/).fill('The university wrote it and it is current.');
  await page.getByRole('button', { name: 'Keep with this reason' }).click();
  await expect(page.getByText('2 of 3 ready to cite')).toBeVisible();

  // Tags and filter
  await page.getByLabel('Source details').getByLabel('Folder').fill('Policy');
  await page.getByLabel('Tags, separated by commas').fill('rules, uni');
  await page.getByRole('button', { name: 'Save notes' }).click();
  await expect(page.getByText('#rules')).toBeVisible();
  await page.getByRole('combobox', { name: 'Tag', exact: true }).selectOption('rules');
  await expect(page.locator('main ul > li > button')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Tag', exact: true }).selectOption('all');
  await page.getByLabel('Search your library').fill('krugman');
  await expect(page.locator('main ul > li > button')).toHaveCount(1);
  await page.getByLabel('Search your library').fill('');
  await axe(page, 'library');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'library');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Write, by keyboard
  await step(page, 'Write');
  const area = page.getByLabel('Your draft');
  await area.fill('Writers were faster');
  await area.press('End');
  await page.getByRole('button', { name: 'Cite', exact: true }).press('Enter');
  await page.getByLabel('Search your library to cite').fill('noy');
  await expect(page.locator('#cite-list li')).toHaveCount(1);
  await expect(page.locator('#cite-list li')).toContainText('(Noy & Zhang, 2023)', { timeout: 15_000 });
  await axe(page, 'write picker');
  await page.keyboard.press('Enter');
  await expect(area).toHaveValue('Writers were faster (Noy & Zhang, 2023)');
  await page.keyboard.type('. Some say so (Okonjo, 2022). And (Krugman, 1991).');
  await expect(page.getByText('Not in your library (1)')).toBeVisible();
  await expect(page.getByText('In your library, not approved (1)')).toBeVisible();
  await expect(page.getByText('saved on this device')).toBeVisible();
  await axe(page, 'write');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'write');
  await page.setViewportSize({ width: 1280, height: 800 });

  // Export
  await step(page, 'Export');
  const sheet = page.getByLabel('Reference list preview');
  await expect(sheet).toContainText('Noy, S., & Zhang, W. (2023). Experimental evidence on the productivity effects of generative artificial intelligence. Science, 381(6654), 187–192. https://doi.org/10.1126/science.adh2586', { timeout: 15_000 });
  await expect(sheet.locator('i').first()).toHaveText(/Science|Guidance/);
  await expect(sheet).not.toContainText('Krugman');
  await expect(sheet).toContainText('Reason: The university wrote it and it is current.');
  await expect(page.getByText('What stays behind, and why')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Okonjo, 2022');
  await expect(page.getByLabel('AI-use statement').first()).toContainText('No calls to a generative AI service are recorded');
  await page.getByRole('button', { name: 'Verify log' }).click();
  await expect(page.getByText('Each one matches the entry before it.')).toBeVisible();
  await axe(page, 'export');
  await page.setViewportSize({ width: 375, height: 812 });
  await noSideways(page, 'export');
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [button, name] of [['Word', 'paper-trail.docx'], ['BibTeX', 'references.bib'], ['RIS', 'references.ris'], ['Plain text', 'references.txt']] as const) {
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()]);
    expect(file.suggestedFilename()).toBe(name);
    const body = readFileSync(await file.path());
    expect(body.length).toBeGreaterThan(100);
    if (name.endsWith('.docx')) expect(body.subarray(0, 2).toString()).toBe('PK');
    else expect(body.toString()).not.toContain('Krugman');
  }
  for (const style of ['harvard', 'mla', 'chicago', 'ieee']) {
    await page.getByRole('combobox', { name: 'Style', exact: true }).selectOption(style);
    await expect(sheet).toContainText('Zhang', { timeout: 15_000 });
    await expect(sheet.getByText('Formatting…')).toHaveCount(0, { timeout: 15_000 });
  }
  expect(errors).toEqual([]);
});

test('house rules: policy map, and delete everything asks first', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('A question to delete');
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('heading', { name: 'Plan the search' })).toBeVisible();
  await page.goto('/#/rules');
  await expect(page.getByText('s10(h)(ix)')).toBeVisible();
  await axe(page, 'rules');
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await page.getByRole('button', { name: 'Keep my data' }).click();
  await page.goto('/#/projects');
  await expect(page.getByText('A question to delete')).toBeVisible();
  await page.goto('/#/rules');
  await page.getByRole('button', { name: 'Delete everything' }).click();
  await page.getByRole('button', { name: 'Yes, delete everything' }).click();
  await expect(page.getByText('Everything in this library was deleted.')).toBeVisible();
  await page.goto('/#/projects');
  await expect(page.getByText('A question to delete')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/#/rules');
  await noSideways(page, 'rules');
  expect(errors).toEqual([]);
});
