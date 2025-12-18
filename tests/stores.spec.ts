import { test, expect } from '@playwright/test';

test.describe('Stores Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays all three store cards', async ({ page }) => {
    await expect(page.locator('[data-store-id="steam"]')).toBeVisible();
    await expect(page.locator('[data-store-id="epic"]')).toBeVisible();
    await expect(page.locator('[data-store-id="gog"]')).toBeVisible();
  });

  test('store cards have correct aria labels', async ({ page }) => {
    await expect(page.getByLabel('Steam store')).toBeVisible();
    await expect(page.getByLabel('Epic Games store')).toBeVisible();
    await expect(page.getByLabel('GOG Galaxy store')).toBeVisible();
  });

  test('first card is focused on load', async ({ page }) => {
    // Wait for auto-focus
    await page.waitForTimeout(200);
    const steamCard = page.locator('[data-store-id="steam"]');
    await expect(steamCard).toBeFocused();
  });

  test('arrow keys navigate between cards', async ({ page }) => {
    await page.waitForTimeout(200);

    // Start on Steam, press right to go to Epic
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="epic"]')).toBeFocused();

    // Press right to go to GOG
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="gog"]')).toBeFocused();

    // Press left to go back to Epic
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-store-id="epic"]')).toBeFocused();
  });

  test('WASD keys navigate between cards', async ({ page }) => {
    await page.waitForTimeout(200);

    // Start on Steam, press D to go to Epic
    await page.keyboard.press('d');
    await expect(page.locator('[data-store-id="epic"]')).toBeFocused();

    // Press A to go back to Steam
    await page.keyboard.press('a');
    await expect(page.locator('[data-store-id="steam"]')).toBeFocused();
  });

  test('Enter key shows active state and navigates', async ({ page }) => {
    await page.waitForTimeout(200);

    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.focus();

    // Press and hold Enter
    await page.keyboard.down('Enter');

    // Card should have active class
    await expect(steamCard).toHaveClass(/store-card--active/);

    // Release Enter - navigates to Steam connect screen
    await page.keyboard.up('Enter');

    // Should now be on Steam connect screen (shows scanning first, then results with Steam title)
    await expect(page.locator('.steam-connect')).toBeVisible();
  });

  test('Space key shows active state and navigates', async ({ page }) => {
    await page.waitForTimeout(200);

    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.focus();

    await page.keyboard.down(' ');
    await expect(steamCard).toHaveClass(/store-card--active/);

    await page.keyboard.up(' ');

    // Should now be on Steam connect screen
    await expect(page.locator('.steam-connect')).toBeVisible();
  });

  test('cards wrap around when navigating', async ({ page }) => {
    await page.waitForTimeout(200);

    // Go to last card (GOG)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="gog"]')).toBeFocused();

    // Press right again, should wrap to Steam
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="steam"]')).toBeFocused();
  });
});

test.describe('Menu and Side Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('menu button opens side panel', async ({ page }) => {
    const menuButton = page.locator('.bottom-bar__menu-btn');
    await menuButton.click();

    const sidePanel = page.locator('.side-panel');
    await expect(sidePanel).toHaveClass(/side-panel--open/);
  });

  test('clicking backdrop closes side panel', async ({ page }) => {
    const menuButton = page.locator('.bottom-bar__menu-btn');
    await menuButton.click();

    const backdrop = page.locator('.side-panel-backdrop');
    await backdrop.click();

    const sidePanel = page.locator('.side-panel');
    await expect(sidePanel).not.toHaveClass(/side-panel--open/);
  });

  test('Escape key closes side panel', async ({ page }) => {
    const menuButton = page.locator('.bottom-bar__menu-btn');
    await menuButton.click();

    await page.keyboard.press('Escape');

    const sidePanel = page.locator('.side-panel');
    await expect(sidePanel).not.toHaveClass(/side-panel--open/);
  });

  test('navigation items are present', async ({ page }) => {
    const menuButton = page.locator('.bottom-bar__menu-btn');
    await menuButton.click();

    await expect(page.getByRole('button', { name: 'Stores' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  });

  test('can navigate to Library screen', async ({ page }) => {
    const menuButton = page.locator('.bottom-bar__menu-btn');
    await menuButton.click();

    await page.getByRole('button', { name: 'Library' }).click();

    // Library screen shows the page header with Library title
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
  });

  test('can navigate to Settings screen', async ({ page }) => {
    const menuButton = page.locator('.bottom-bar__menu-btn');
    await menuButton.click();

    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});
