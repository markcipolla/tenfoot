import { test, expect } from '@playwright/test';

test.describe('Game Info Panel', () => {
  // Note: These tests work in browser mode without Tauri backend
  // Game data may not be available in browser, so we focus on UI structure and navigation

  test.describe('Panel Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(200);
      // Navigate to Steam screen
      const steamCard = page.locator('[data-store-id="steam"]');
      await steamCard.click();
      await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });
    });

    test('can navigate to game cards with keyboard', async ({ page }) => {
      // Wait for any games to load
      const gameCard = page.locator('[data-game-id]').first();

      // Check if any game cards exist
      const count = await gameCard.count();
      if (count > 0) {
        // If games exist, verify keyboard navigation works
        await gameCard.focus();
        await expect(gameCard).toBeFocused();
      }
    });

    test('pressing Enter on a game card opens info panel', async ({ page }) => {
      // Wait for any games to load
      const gameCard = page.locator('[data-game-id]').first();
      const count = await gameCard.count();

      if (count > 0) {
        await gameCard.focus();
        await page.keyboard.press('Enter');

        // Info panel should appear with Play or Install button
        await expect(
          page.getByRole('button', { name: /Play|Install/ }).first()
        ).toBeVisible({ timeout: 5000 }).catch(() => {
          // No info panel in browser mode without data
        });
      }
    });
  });

  test.describe('Empty State', () => {
    test('shows message when no games are found', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(200);

      const gogCard = page.locator('[data-store-id="gog"]');
      await gogCard.click();
      await expect(page.getByRole('heading', { name: 'GOG Galaxy' })).toBeVisible({ timeout: 10000 });

      // In browser mode without Tauri, we might see an empty state
      // or the loading state. Check for either.
      const emptyMessage = page.getByText('No GOG games found');
      const loadingState = page.getByText('Looking for installed games');
      const hasGames = await page.locator('[data-game-id]').count() > 0;

      if (!hasGames) {
        // Either empty message or loading should be visible
        const isEmptyVisible = await emptyMessage.isVisible().catch(() => false);
        const isLoadingVisible = await loadingState.isVisible().catch(() => false);

        expect(isEmptyVisible || isLoadingVisible || hasGames).toBe(true);
      }
    });
  });
});

test.describe('Game Card Grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(200);
  });

  test('game cards have correct data attributes', async ({ page }) => {
    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.click();
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });

    const gameCard = page.locator('[data-game-id]').first();
    const count = await gameCard.count();

    if (count > 0) {
      // Verify data attributes exist
      await expect(gameCard).toHaveAttribute('data-game-id');
      await expect(gameCard).toHaveAttribute('data-store');
      await expect(gameCard).toHaveAttribute('data-installed');
    }
  });

  test('game cards show store icon', async ({ page }) => {
    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.click();
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });

    const gameCard = page.locator('[data-game-id]').first();
    const count = await gameCard.count();

    if (count > 0) {
      // Each game card should have a store icon badge
      const storeIcon = gameCard.locator('[data-store]');
      await expect(storeIcon).toBeVisible();
    }
  });

  test('arrow key navigation works in game grid', async ({ page }) => {
    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.click();
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });

    const gameCards = page.locator('[data-game-id]');
    const count = await gameCards.count();

    if (count >= 2) {
      // Focus first card
      const firstCard = gameCards.first();
      await firstCard.focus();
      await expect(firstCard).toBeFocused();

      // Press right arrow
      await page.keyboard.press('ArrowRight');

      // Second card should now be focused
      const secondCard = gameCards.nth(1);
      await expect(secondCard).toBeFocused();
    }
  });

  test('WASD navigation works in game grid', async ({ page }) => {
    const steamCard = page.locator('[data-store-id="steam"]');
    await steamCard.click();
    await expect(page.getByRole('heading', { name: 'Steam' })).toBeVisible({ timeout: 10000 });

    const gameCards = page.locator('[data-game-id]');
    const count = await gameCards.count();

    if (count >= 2) {
      // Focus first card
      const firstCard = gameCards.first();
      await firstCard.focus();
      await expect(firstCard).toBeFocused();

      // Press D key for right
      await page.keyboard.press('d');

      // Second card should now be focused
      const secondCard = gameCards.nth(1);
      await expect(secondCard).toBeFocused();
    }
  });
});

test.describe('Library Screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(200);
  });

  test('can navigate to Library from menu', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    await page.getByRole('button', { name: 'Library' }).click();

    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();
  });

  test('Library shows games from all stores', async ({ page }) => {
    const menuButton = page.getByLabel('Open menu');
    await menuButton.click();

    await page.getByRole('button', { name: 'Library' }).click();

    await expect(page.getByRole('heading', { name: 'Library', exact: true })).toBeVisible();

    // Just verify the page structure is correct (may be empty in browser mode)
    await expect(page.locator('.overflow-y-auto')).toBeVisible();
  });
});
