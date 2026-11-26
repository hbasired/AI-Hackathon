import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mockRegistries, watchErrors } from './mock';

/** The draft check, the retraction check, duplicates, missing papers and page numbers, used the way a student would. */
const ABSTRACT: Record<string, string> = JSON.parse(readFileSync('tests/unit/fixtures/abstracts.json', 'utf8'));
const BLOOM = '10.1093/qje/qju032';
const NOY = '10.1126/science.adh2586';

const axe = async (page: Page, name: string) => {
  // Stamps fade in as they land. On a slow machine a half-faded stamp reads as low contrast, so measure once
  // every short animation has finished. Long or endless ones (the tour's timer, a spinner) are left alone.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity || Number(a.effect?.getTiming().duration) > 2000), undefined, { timeout: 5_000 });
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${name}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
};
const phone = async (page: Page, name: string) => {
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), name).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1280, height: 800 });
};
const step = (page: Page, name: string | RegExp) => page.getByLabel('Your trail').getByRole('link', { name }).click();

async function start(page: Page, dois: string[]): Promise<string> {
  await page.goto('/#/projects');
  await page.getByLabel('What are you researching?').fill('Does working from home improve employee performance?');
  await page.getByText('No AI', { exact: true }).click();
  await page.getByRole('button', { name: 'Start project' }).click();
  await step(page, 'Library');
  for (const [i, d] of dois.entries()) {
    if (!(await page.getByLabel('DOI, DOI link or title').isVisible())) await page.getByRole('button', { name: 'Add a source' }).click();
    await page.getByLabel('DOI, DOI link or title').fill(d);
    await page.getByRole('button', { name: 'Check and add', exact: true }).click();
    await expect(page.getByText(new RegExp(`of ${i + 1} ready to cite`))).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByText(`${i + 1} of ${i + 1} ready to cite`)).toBeVisible();
  }
  return page.url().match(/\/p\/([^/]+)/)![1]!;
}
/** Puts the real abstracts in, as the Get the abstract button would. */
const withText = (page: Page) =>
  page.evaluate(async (abs) => {
    const path = '/src/store/db.ts';
    const { db } = await import(/* @vite-ignore */ path);
    for (const s of await db.sources.toArray()) if (abs[s.record?.doi]) await db.sources.update(s.id, { text: abs[s.record.doi], textOrigin: 'abstract' });
  }, ABSTRACT);

test('draft check: copied words, a false quotation, a page, slips, undo, and the Reviewer', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await start(page, [BLOOM, NOY]);
  await withText(page);
  await step(page, 'Write');
  const area = page.getByLabel('Your draft');
  await expect(page.getByRole('button', { name: 'Check my draft' })).toBeDisabled();
  await area.fill('Home working led to a 13% performance increase, of which 9% was from working more minutes per shift. Staff at home did about an eighth more work (Bloom et al., 2015). “The average time taken decreased by 40%” (Bloom et al., 2015, p. 170). This had a effect on the the firm.');
  await page.getByRole('button', { name: 'Check my draft' }).click();
  const box = page.getByRole('region', { name: 'Draft check' });
  await expect(box.getByText('Compared with 2 sources in your library.')).toBeVisible();
  await expect(box.getByText('this is not a plagiarism verdict')).toBeVisible();
  await expect(box.getByText('with no quotation marks and no citation')).toBeVisible();
  await expect(box.getByText('These words are in another source')).toBeVisible();
  await expect(box.getByText('2 about your sources, 1 said more than once, 1 about wording.')).toBeVisible();
  await axe(page, 'draft check');
  await phone(page, 'draft check');

  // One click adds the marks and the citation. The words stay the student's choice.
  await box.getByRole('button', { name: 'Add quotation marks and the citation' }).click();
  await expect(area).toHaveValue(/^“Home working led to a 13% performance increase, of which 9% was from working more minutes per shift” \(Bloom et al\., 2015\)\. Staff/);
  await expect(box.getByText('with no quotation marks and no citation')).toHaveCount(0);
  await expect(box.getByText('A direct quotation needs a page')).toBeVisible();
  await box.getByRole('button', { name: 'Undo that change' }).click();
  await expect(area).toHaveValue(/^Home working led/);
  await expect(box.getByText('with no quotation marks and no citation')).toBeVisible();

  // Slips
  await box.getByRole('button', { name: 'Remove one' }).click();
  await box.getByRole('button', { name: 'Change to “an”' }).click();
  await expect(area).toHaveValue(/This had an effect on the firm\.$/);
  // Show selects the words in the draft
  await box.getByRole('button', { name: 'Show in the draft' }).first().click();
  expect(await area.evaluate((e: HTMLTextAreaElement) => e.value.slice(e.selectionStart, e.selectionEnd))).toContain('Home working led to a 13% performance increase');
  await box.getByRole('button', { name: 'Leave it' }).last().click();
  await expect(box.getByText('These words are in another source')).toHaveCount(0);

  // Changing one digit of a real quotation makes it a false one
  await area.fill('“Home working led to a 31% performance increase” (Bloom et al., 2015, p. 167).');
  await expect(box.getByText('We could not see these words')).toBeVisible();
  await area.fill('“Home working led to a 13% performance increase” (Bloom et al., 2015, p. 167).');
  await expect(box.getByText('1 quotation matches its source.')).toBeVisible();

  // The Reviewer sees the same things, and the AI-use statement says what was used
  await area.fill('Their attrition rate halved, but their promotion rate conditional on performance fell. This had a effect on the firm.');
  await expect(page.getByText('saved on this device')).toBeVisible();
  await step(page, 'Review');
  await expect(page.getByText('1 passage in a source’s own words, without quotation marks')).toBeVisible();
  await expect(page.getByText('1 slip or repetition in your wording')).toBeVisible();
  await axe(page, 'review with draft check');
  await step(page, 'Export');
  await expect(page.getByLabel('AI-use statement').first()).toContainText('A rule-based check, which is not AI');
  expect(errors).toEqual([]);
});

test('cite with a page, in three styles', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await start(page, [BLOOM]);
  await step(page, 'Write');
  const area = page.getByLabel('Your draft');
  const cite = async (text: string, p: string) => {
    await area.fill(text);
    await area.press('End');
    await page.getByRole('button', { name: 'Cite', exact: true }).click();
    await expect(page.locator('#cite-list li')).toContainText('Bloom et al.', { timeout: 15_000 });
    await page.getByLabel('Page, if you are quoting').fill(p);
  };
  await cite('It rose', 'page ten');
  await expect(page.getByText('Write the page as 167, 167-168 or e12.')).toBeVisible();
  await page.locator('#cite-list li').click();
  await expect(area).toHaveValue('It rose');
  await page.getByLabel('Page, if you are quoting').fill('167-168');
  await axe(page, 'cite with page');
  await page.locator('#cite-list li').click();
  await expect(area).toHaveValue('It rose (Bloom et al., 2015, pp. 167–168)');
  await page.getByRole('combobox', { name: 'Style', exact: true }).selectOption('mla');
  await page.waitForTimeout(600);
  await cite('It rose', '167');
  await page.keyboard.press('Enter');
  await expect(area).toHaveValue('It rose (Bloom et al. 167)');
  await expect(page.getByText('Cited (1)')).toBeVisible();
  expect(errors).toEqual([]);
});

/** A PDF written by hand, one entry per page, so the test needs no file. */
function pdf(pages: string[][]): Buffer {
  const objs: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for (const [i, lines] of pages.entries()) {
    const body = `BT /F1 11 Tf 50 740 Td ${lines.map((l) => `(${l.replace(/[()\\]/g, (c) => `\\${c}`)}) Tj 0 -16 Td`).join(' ')} ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`, `<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  }
  let out = '%PDF-1.4\n';
  const at: number[] = [];
  objs.forEach((o, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

test('a quote says which page of the PDF it is on, in Evidence, the claim, Ask, Read and the draft check', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await start(page, []);
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  await page.getByLabel(/Already have a PDF/).setInputFiles({
    name: 'paper.pdf',
    mimeType: 'application/pdf',
    // SAMPLE pages written for this test. Only the DOI is real.
    buffer: pdf([['SAMPLE page for a test. https://doi.org/10.1126/science.adh2586', 'We examined writing tasks in an online experiment.'], ['The second page of this sample file says very little of note.'], ['The results show that sample workers finished forty percent sooner in this test.']]),
  });
  await expect(page.getByText('3 pages read.')).toBeVisible({ timeout: 30_000 });
  // The document has no title of its own, so only the DOI was checked.
  await page.locator('main ul > li > button').first().click();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await step(page, 'Evidence');
  await page.getByLabel('Your claim').fill('Sample workers finished forty percent sooner in this test.');
  await page.getByRole('button', { name: 'Find the sentence' }).click();
  await expect(page.getByText('Page 3 of the PDF', { exact: true })).toBeVisible();
  const reason = page.getByLabel(/To keep this anyway/);
  if (await reason.isVisible()) await reason.fill('It is a test of page numbers.');
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText(/· Page 3 of the PDF/)).toBeVisible();
  await step(page, /^Ask/);
  await page.getByLabel('Your question').fill('Did sample workers finish sooner?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText('Page 3 of the PDF')).toBeVisible();
  await step(page, /^Read/);
  await expect(page.getByText('Page 3 of the PDF').first()).toBeVisible();
  await step(page, 'Write');
  await page.getByLabel('Your draft').fill('“sample workers finished forty percent sooner” (Noy & Zhang, 2023). “sample workers finished ninety percent sooner” (Noy & Zhang, 2023, p. 3).');
  await page.getByRole('button', { name: 'Check my draft' }).click();
  await expect(page.getByText('A direct quotation needs a page')).toBeVisible();
  await expect(page.getByText(/· Page 3 of the PDF/)).toBeVisible();
  // The whole PDF was read, so a wording it does not have is a fix, not a maybe.
  await expect(page.getByText('These words are not in the source you cite')).toBeVisible();
  expect(errors).toEqual([]);
});

test('retraction check: news since last time, and a silent registry keeps the old answer', async ({ page }) => {
  // A silent registry is asked three times, with pauses.
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await mockRegistries(page);
  await start(page, [BLOOM, NOY]);
  const panel = page.getByRole('region', { name: 'Retraction check' });
  await expect(panel.getByText('Not done yet.')).toBeVisible();

  // 1. Nothing new
  await panel.getByRole('button', { name: 'Check all for retractions' }).click();
  await expect(panel.getByText('No retraction, warning or correction found.')).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText(/Last done/)).toBeVisible();
  await expect(page.getByText('2 of 2 ready to cite')).toBeVisible();

  // 2. Today one is retracted, the other is under concern and cites retracted work. SAMPLE answers, for this test only.
  await page.route('**/api/registry?*', async (r) => {
    const q = new URL(r.request().url()).searchParams;
    const url = q.get('url') ?? '';
    expect(q.get('fresh'), 'asks again instead of using an old copy').toBe('1');
    if (url.includes('cited_by:')) return r.fulfill({ json: { results: url.includes('W2161708711') ? [] : [{ id: 'https://openalex.org/W1', title: 'SAMPLE withdrawn study', doi: 'https://doi.org/10.5555/sample', publication_year: 2001, is_retracted: true }] } });
    if (url.startsWith('https://api.crossref.org/works/10.')) {
      const body = JSON.parse(readFileSync('tests/unit/fixtures/registry.json', 'utf8'))[url].body;
      body.message['updated-by'] = [{ DOI: '10.5555/notice', type: url.includes('qju032') ? 'retraction' : 'expression_of_concern', label: url.includes('qju032') ? 'Retraction' : 'Expression of concern', source: 'retraction-watch', updated: { 'date-parts': [[2026, 11, 25]] } }];
      return r.fulfill({ json: body });
    }
    return r.fallback();
  });
  await panel.getByRole('button', { name: 'Check all for retractions' }).click();
  await expect(panel.getByText('Retracted (1)')).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText('Expression of concern (1)')).toBeVisible();
  await expect(panel.getByText('Cites retracted work (1)')).toBeVisible();
  await expect(page.getByText('0 of 2 ready to cite')).toBeVisible();
  await axe(page, 'library with notices');
  await phone(page, 'library with notices');
  await page.locator('main ul > li > button').filter({ hasText: 'productivity effects' }).click();
  const detail = page.getByLabel('Source details');
  await expect(detail.getByText('This source cites a work that was retracted.')).toBeVisible();
  await expect(detail.getByText('from Retraction Watch')).toBeVisible();
  await expect(detail.getByRole('link', { name: 'Read the notice' })).toHaveAttribute('href', 'https://doi.org/10.5555/notice');
  await expect(detail.getByText('The journal has published an expression of concern about this work (2026-11-25).')).toBeVisible();
  await axe(page, 'detail with notices');

  // 3. Registries silent: nothing changes, nothing turns green
  await page.unroute('**/api/registry?*');
  await page.route('**/api/registry?*', (r) => r.fulfill({ status: 503, json: {} }));
  await panel.getByRole('button', { name: 'Check all for retractions' }).click();
  await expect(panel.getByText('Not answered, earlier result kept (2)')).toBeVisible({ timeout: 120_000 });
  await expect(panel.getByText('The registries are not answering')).toBeVisible();
  await expect(panel.getByText('Nothing found')).toHaveCount(0);
  await expect(page.locator('main ul > li > button').filter({ hasText: 'Chinese Experiment' }).getByText('Retracted')).toBeVisible();
  expect(errors).toEqual([]);
});

test('duplicates: side by side, keep one, or say they are different', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  const id = await start(page, [BLOOM, NOY]);
  // SAMPLE preprints of the two real papers, put in for this test only.
  await page.evaluate(async (project) => {
    const path = '/src/store/db.ts';
    const { db } = await import(/* @vite-ignore */ path);
    for (const s of await db.sources.toArray()) await db.sources.add({ ...s, id: `pre-${s.id}`, projectId: project, notes: 'Read the preprint first.', keys: { found: true, checked: true, approved: false }, record: { ...s.record, id: `10.5555/${s.id}`, doi: `10.5555/${s.id}`, type: 'posted-content', container: 'SAMPLE preprints', year: s.record.year - 1 } });
  }, id);
  const box = page.getByRole('region', { name: 'Possible duplicates' });
  await expect(box.getByText('2 possible duplicates')).toBeVisible();
  await expect(box.getByText('One looks like the preprint of the other.').first()).toBeVisible();
  await axe(page, 'duplicates');
  await phone(page, 'duplicates');
  await step(page, 'Review');
  await expect(page.getByText('you have not approved', { exact: false }).or(page.getByText('will stay behind on export')).first()).toBeVisible();
  await step(page, 'Library');
  await box.getByRole('button', { name: 'Keep this one: The Quarterly Journal of Economics' }).click();
  await expect(box.getByText('1 possible duplicate')).toBeVisible();
  await expect(box.getByText('Kept one, removed one.')).toBeVisible();
  await page.locator('main ul > li > button').filter({ hasText: 'Chinese Experiment' }).click();
  await expect(page.getByLabel('Source details').getByLabel('Notes')).toHaveValue('Read the preprint first.');
  await box.getByRole('button', { name: 'They are different works' }).click();
  await expect(page.getByRole('region', { name: 'Possible duplicates' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('of 3 ready to cite')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Possible duplicates' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('papers you may be missing: counted from reference lists, checked, kept or skipped', async ({ page }) => {
  const errors = watchErrors(page);
  await mockRegistries(page);
  await start(page, [BLOOM, NOY]);
  await step(page, 'Map');
  await expect(page.getByText('This needs at least two sources with a reference list')).toBeVisible();
  // W2081155210 and W4386510404 are real records in the recorded answers.
  await page.evaluate(async () => {
    const path = '/src/store/db.ts';
    const { db } = await import(/* @vite-ignore */ path);
    for (const s of await db.sources.toArray()) await db.sources.update(s.id, { record: { ...s.record, references: ['W2081155210', 'W4386510404', s.id] } });
  });
  const box = page.getByRole('region', { name: 'Papers you may be missing' });
  await expect(box.getByText('Counted from 2 reference lists.')).toBeVisible();
  await box.getByRole('button', { name: 'Show them' }).click();
  await expect(box.getByText('Cited by 2 of your sources: Bloom et al. 2015; Noy et al. 2023').first()).toBeVisible({ timeout: 20_000 });
  await expect(box.getByRole('button', { name: 'Keep' }).first()).toBeEnabled({ timeout: 20_000 });
  await axe(page, 'missing papers');
  await phone(page, 'missing papers');
  const before = await box.getByRole('button', { name: 'Keep' }).count();
  await box.getByRole('button', { name: 'Keep' }).first().click();
  await expect(box.getByText('In your library')).toBeVisible();
  if (before > 1) {
    await box.getByRole('button', { name: 'Skip' }).last().click();
    await expect(box.getByText('Skipped')).toBeVisible();
  }
  await step(page, 'Library');
  await expect(page.getByText(/of 3 ready to cite/)).toBeVisible();
  expect(errors).toEqual([]);
});
