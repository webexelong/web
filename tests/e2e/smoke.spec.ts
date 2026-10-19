import { expect, test } from '@playwright/test';

test('guest can open the landing page without authentication', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AI-SMARTSERVE|Handcrafted Menu/i);
  await expect(page.locator('body')).toBeVisible();
});

test('protected admin route redirects an anonymous user to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('guest menu still shows products and opens AI chat after deferred loading', async ({ page }) => {
  let menuRequests = 0;
  await page.route('**/api/Menu/store/1', async route => {
    menuRequests += 1;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: '',
        data: {
          storeId: 1,
          tenantId: 1,
          storeName: 'Quán thử',
          brandName: 'Quán thử',
          categories: [{ categoryId: 1, tenantId: 1, name: 'Cà Phê Pha Máy', sortOrder: 1, isActive: true }],
          menuItems: [{ menuItemId: 1, tenantId: 1, categoryId: 1, categoryName: 'Cà Phê Pha Máy', name: 'Cà phê sữa', basePrice: 35000, imageUrl: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&q=80', rating: 4.8, isFeatured: true, isAvailable: true, sortOrder: 1, sizes: [], toppings: [] }],
        },
      }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('guestSession', JSON.stringify({ guestId: 'guest-test', storeId: 1, tableId: 1, tableNumber: 'D01', timestamp: new Date().toISOString() }));
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cà phê sữa' })).toBeVisible();
  await expect(page.locator('img[alt="Cà phê sữa"]')).toBeVisible();
  expect(menuRequests).toBe(1);

  await page.getByRole('button', { name: 'Khung Chat với AI Sommelier' }).click();
  await expect(page.getByRole('button', { name: 'Đóng khung chat' })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng khung chat' }).click();
  await expect(page.getByRole('button', { name: 'Khung Chat với AI Sommelier' })).toBeVisible();
});
