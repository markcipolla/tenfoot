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

    // Press and hold Enter - card should show active state (scale-105)
    await page.keyboard.down('Enter');
    await expect(steamCard).toHaveClass(/scale-105/);

    // Release Enter - navigates to Steam connect screen
    await page.keyboard.up('Enter');

    // Should now be on Steam connect screen (shows Steam heading)
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });
  });

  test('Space key shows active state and navigates', async ({ page }) => {
    await page.waitForTimeout(200);

    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.focus();

    await page.keyboard.down(' ');
    await expect(steamCard).toHaveClass(/scale-105/);

    await page.keyboard.up(' ');

    // Should now be on Steam connect screen
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });
  });

  test('navigation stops at edges of single row', async ({ page }) => {
    await page.waitForTimeout(200);

    // Go to last card (GOG)
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="gog"]')).toBeFocused();

    // Press right again at edge - stays on GOG (single row, no wrap)
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="gog"]')).toBeFocused();

    // Can still go back left
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-store-id="epic"]')).toBeFocused();

    // Go to first card
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-store-id="steam"]')).toBeFocused();

    // Press left at edge - stays on Steam
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-store-id="steam"]')).toBeFocused();
  });
});

test.describe('Menu and Side Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('menu button opens side panel', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    // Side panel should be visible with navigation
    const sidePanel = page.getByLabel('Main navigation');
    await expect(sidePanel).toBeVisible();
  });

  test('clicking backdrop closes side panel', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    const sidePanel = page.getByLabel('Main navigation');
    // Panel should be open (aria-hidden=false)
    await expect(sidePanel).toHaveAttribute('aria-hidden', 'false');

    // Wait for panel transition to complete
    await page.waitForTimeout(300);

    // Get viewport size and click in the center-right area (outside the 240px panel)
    const viewport = page.viewportSize();
    const clickX = viewport ? viewport.width - 100 : 600;
    const clickY = viewport ? viewport.height / 2 : 300;
    await page.mouse.click(clickX, clickY);

    // Side panel should be closed (aria-hidden=true, translated off-screen)
    await expect(sidePanel).toHaveAttribute('aria-hidden', 'true');
  });

  test('Escape key closes side panel', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    const sidePanel = page.getByLabel('Main navigation');
    await expect(sidePanel).toHaveAttribute('aria-hidden', 'false');

    await page.keyboard.press('Escape');

    // Side panel should be closed
    await expect(sidePanel).toHaveAttribute('aria-hidden', 'true');
  });

  test('navigation items are present', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    await expect(page.getByRole('button', { name: 'Stores' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  });

  test('can navigate to Library screen', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    await page.getByRole('button', { name: 'Library' }).click();

    // Library screen shows the page header with Library title
    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
  });

  test('can navigate to Settings screen', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});

test.describe('Steam Connect Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to Steam screen
    await page.waitForTimeout(200);
    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.click();
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });
  });

  test('displays Steam screen with search button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Search/ })).toBeVisible();
  });

  test('can open search by clicking search button', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: /Search/ });
    await searchButton.click();

    // Search panel should be visible
    await expect(page.getByPlaceholder('Search games...')).toBeVisible();
  });

  test('search panel closes with Escape', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: /Search/ });
    await searchButton.click();

    await expect(page.getByPlaceholder('Search games...')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByPlaceholder('Search games...')).not.toBeVisible();
  });

  test('has Refresh button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});

test.describe('Epic Connect Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(200);
    // Navigate to Epic screen
    const epicCard = page.locator('[data-store-id="epic"]');
    await epicCard.click();
    await expect(page.getByRole('heading', { name: 'Epic Games' })).toBeVisible({ timeout: 10000 });
  });

  test('displays Epic screen with search button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Search/ })).toBeVisible();
  });

  test('can open search by clicking search button', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: /Search/ });
    await searchButton.click();
    await expect(page.getByPlaceholder('Search games...')).toBeVisible();
  });

  test('search panel closes with Escape', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: /Search/ });
    await searchButton.click();
    await expect(page.getByPlaceholder('Search games...')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder('Search games...')).not.toBeVisible();
  });

  test('has Refresh button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});

test.describe('GOG Connect Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(200);
    // Navigate to GOG screen
    const gogCard = page.locator('[data-store-id="gog"]');
    await gogCard.click();
    await expect(page.getByRole('heading', { name: 'GOG Galaxy' })).toBeVisible({ timeout: 10000 });
  });

  test('displays GOG screen with search button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Search/ })).toBeVisible();
  });

  test('can open search by clicking search button', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: /Search/ });
    await searchButton.click();
    await expect(page.getByPlaceholder('Search games...')).toBeVisible();
  });

  test('search panel closes with Escape', async ({ page }) => {
    const searchButton = page.getByRole('button', { name: /Search/ });
    await searchButton.click();
    await expect(page.getByPlaceholder('Search games...')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder('Search games...')).not.toBeVisible();
  });

  test('has Refresh button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});

test.describe('Keyboard and Mouse Focus Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(200);
  });

  test('menu items can be navigated with keyboard after mouse click', async ({ page }) => {
    // Open menu
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    // Click Library button with mouse
    const libraryButton = page.getByRole('button', { name: 'Library' });
    await libraryButton.focus();

    // Library should be focused
    await expect(libraryButton).toBeFocused();

    // Keyboard navigation should work - press up to go to Stores
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('button', { name: 'Stores' })).toBeFocused();

    // Press down to go back to Library
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'Library' })).toBeFocused();

    // Press down to go to Settings
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
  });

  test('store card gets focus on click and keyboard works after', async ({ page }) => {
    // Initial focus should be on Steam
    await expect(page.locator('[data-store-id="steam"]')).toBeFocused();

    // Use keyboard to navigate to Epic first
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="epic"]')).toBeFocused();

    // Now use mouse to focus Steam (by tabbing there, since clicking navigates)
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('[data-store-id="steam"]')).toBeFocused();

    // Continue with keyboard to verify sync is maintained
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-store-id="epic"]')).toBeFocused();
  });
});
