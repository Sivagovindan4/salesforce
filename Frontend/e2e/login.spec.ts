import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
test('admin workspace shows the real sign-in screen when no session exists', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Work email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});

test('seeded development admin can sign in', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Work email').fill(process.env.SEED_ADMIN_EMAIL || 'admin@scanzaa.local');
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD || 'Scanzaa-Dev-2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Platform Overview' })).toBeVisible();
});

test('filtered reports download valid CSV, XLSX, and PDF files', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Work email').fill(process.env.SEED_ADMIN_EMAIL || 'admin@scanzaa.local');
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD || 'Scanzaa-Dev-2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Reports & Exports' }).click();
  await page.locator('.report-controls select').nth(0).selectOption({ label: 'Restaurant performance' });
  await page.locator('.report-controls select').nth(2).selectOption({ label: "Anbu'de Cafe" });
  await page.getByRole('button', { name: 'Generate report' }).click();
  await expect(page.locator('.report-preview').getByText('Anbu\'de Cafe', { exact: false })).toBeVisible();

  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  const csv = await csvDownload;
  const csvText = await readFile((await csv.path())!, 'utf8');
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  expect(csvText).toContain('Restaurant');
  expect(csvText).toContain("Anbu'de Cafe");

  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'XLSX' }).click();
  const excel = await excelDownload;
  expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await excel.path())!);
  expect(workbook.worksheets[0].getRow(2).getCell(1).text).toBe("Anbu'de Cafe");

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF' }).click();
  const pdf = await pdfDownload;
  const pdfBytes = await readFile((await pdf.path())!);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdfBytes.length).toBeGreaterThan(500);
  expect(pdfBytes.toString('latin1')).toContain('Restaurant performance');
  expect(pdfBytes.toString('latin1')).toContain("Anbu'de Cafe");
});

test('restaurant QR opens its own restaurant and table menu', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Work email').fill(process.env.SEED_ADMIN_EMAIL || 'admin@scanzaa.local');
  await page.getByLabel('Password').fill(process.env.SEED_ADMIN_PASSWORD || 'Scanzaa-Dev-2026!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Restaurants & QRs' }).click();
  await page.getByRole('row').filter({ hasText: "Anbu'de Cafe" }).getByTitle('QR studio').click();
  await expect(page.getByRole('heading', { name: 'QR Studio' })).toBeVisible();
  await expect(page.locator('.qr-studio')).toContainText("Anbu'de Cafe");
  await expect(page.locator('.qr-studio')).toContainText('Table 01');
  const destination = await page.locator('.qr-dest').innerText();
  const token = destination.match(/\/menu\/([\w-]+)/)?.[1];
  expect(token).toBeTruthy();
  await page.goto(`/menu/${token}`);
  await expect(page.getByRole('heading', { name: "Anbu'de Cafe" })).toBeVisible();
  await expect(page.locator('.customer-header')).toContainText('Table 01');
  await expect(page.getByText('Chicken Biryani')).toBeVisible();
});
