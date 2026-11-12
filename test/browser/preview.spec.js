import { test, expect } from '@playwright/test';

const node = (key) => `kepler-card g.node[data-key="${key}"]`;
const chip = (tag) => `kepler-card button.chip[data-tag="${tag}"]`;
const playing = 'kepler-card .wrap[data-reveal="playing"]';

test.beforeEach(async ({ page }) => {
  await page.goto('/preview/index.html');
});

test('home sample draws and the reveal finishes', async ({ page }) => {
  await expect(page.locator(node('router'))).toBeVisible();
  await expect(page.locator(playing)).toBeHidden();
});

test('filters off shows no chips', async ({ page }) => {
  await expect(page.locator(node('router'))).toBeVisible();
  await expect(page.locator(playing)).toBeHidden();
  await expect(page.locator('kepler-card button.chip')).toHaveCount(0);
  await expect(page.locator(chip('area:den'))).toBeHidden();
});

test('filters on: picking and clearing a tag', async ({ page }) => {
  await expect(page.locator(playing)).toBeHidden();
  await page.locator('#filters').check();
  await expect(page.locator(chip('area:den'))).toBeVisible();
  await page.locator(chip('area:den')).click();
  await expect(page.locator(node('soundbar'))).toBeHidden();
  await expect(page.locator(node('air-purifier'))).toBeVisible();
  await expect(page.locator(node('core-switch'))).toBeVisible();
  await page.locator(chip('area:den')).click();
  await expect(page.locator(node('soundbar'))).toBeVisible();
});

test('deep sample: two chips combine', async ({ page }) => {
  await page.locator('#sample').selectOption('deep');
  await expect(page.locator(node('gw'))).toBeVisible();
  await expect(page.locator(playing)).toBeHidden();
  await page.locator('#filters').check();
  await page.locator(chip('topology:wired')).click();
  await page.locator(chip('floor:up')).click();
  await expect(page.locator(node('sw2'))).toBeVisible();
  await expect(page.locator(node('sw1'))).toBeVisible();
  await expect(page.locator(node('tv'))).toBeHidden();
  await expect(page.locator(node('zb'))).toBeHidden();
});

test('lovelace host draws the same node count as the element host', async ({ page }) => {
  const nodes = page.locator('kepler-card g.node');
  await expect(page.locator(node('router'))).toBeVisible();
  await expect(page.locator(playing)).toBeHidden();
  const elementCount = await nodes.count();
  expect(elementCount).toBeGreaterThan(0);

  await page.locator('#host').selectOption('lovelace');
  await expect(page.locator(node('router'))).toBeVisible();
  await expect(page.locator(playing)).toBeHidden();
  await expect(nodes).toHaveCount(elementCount);
});
