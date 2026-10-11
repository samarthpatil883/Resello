import { expect, test, type Page } from '@playwright/test';

const user = {
  _id: '64b000000000000000000001',
  name: 'Campus Seller',
  email: 'seller@pccoepune.org',
  role: 'STUDENT',
  emailVerifiedAt: '2026-10-07T00:00:00.000Z',
  lastActiveMode: 'SELL',
  sellerOnboardedAt: '2026-10-07T00:00:00.000Z',
  campusLocation: null,
  pickupPreference: null,
  phone: null,
  isSuspended: false,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

const item = {
  id: 'mock-item',
  seller_id: '64b000000000000000000001',
  title: 'Campus Physics Textbook',
  description: 'Excellent condition with clear diagrams.',
  price: 350,
  image_url: '/items/mock-item/image',
  image_urls: ['/items/mock-item/images/0', '/items/mock-item/images/1'],
  status: 'ACTIVE',
  created_at: '2026-10-07T00:00:00.000Z',
};

async function mockMarketplaceApi(page: Page, onUpload?: (body: string) => void) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();

    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, badgeCounts: { buy: 0, sell: 0 } }),
      });
    }
    if (pathname.endsWith('/items/mock-item/images/0')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#dcfce7"/><text x="50%" y="50%" text-anchor="middle" font-size="40">Photo 1</text></svg>',
      });
    }
    if (pathname.endsWith('/items/mock-item/images/1')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#dbeafe"/><text x="50%" y="50%" text-anchor="middle" font-size="40">Photo 2</text></svg>',
      });
    }
    if (pathname.endsWith('/items/mock-item')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ item }),
      });
    }
    if (pathname.endsWith('/items/mine')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [item] }),
      });
    }
    if (pathname.endsWith('/items') && method === 'POST') {
      onUpload?.(request.postData() ?? '');
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ item }),
      });
    }
    if (pathname.endsWith('/items') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [item] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
}

test('seller can preview and publish multiple listing photos', async ({ page }, testInfo) => {
  let uploadedBody = '';
  await mockMarketplaceApi(page, (body) => {
    uploadedBody = body;
  });
  await page.goto('/sell/listings/new');

  await page.getByLabel('Title').fill(item.title);
  await page.getByLabel('Description').fill(item.description);
  await page.getByLabel('Price (₹)').fill(String(item.price));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64',
  );
  await page.locator('#listing-images').setInputFiles([
    { name: 'cover.png', mimeType: 'image/png', buffer: png },
    { name: 'detail.png', mimeType: 'image/png', buffer: png },
  ]);

  await expect(page.getByText('Cover', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Selected product photos' }).getByRole('listitem'),
  ).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath('seller-multiple-photo-preview.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Publish item' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Your item and photos are live in the Buy marketplace.',
  );
  expect(uploadedBody.match(/name="images"/g)).toHaveLength(2);
});

test('buyer can scroll through the item photo gallery', async ({ page }, testInfo) => {
  await mockMarketplaceApi(page);
  await page.goto('/buy/listing/mock-item');

  await expect(page.getByRole('heading', { name: item.title })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.getByText('2 / 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous photo' })).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath('buyer-multiple-photo-gallery.png'),
    fullPage: true,
  });
});

test('seller can find an owned listing and edit its details and photos', async ({
  page,
}, testInfo) => {
  let updateBody = '';
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, badgeCounts: { buy: 0, sell: 0 } }),
      });
    }
    if (pathname.endsWith('/items/mine')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [item] }),
      });
    }
    if (pathname.endsWith('/items/mock-item') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ item }),
      });
    }
    if (pathname.endsWith('/items/mock-item') && request.method() === 'PATCH') {
      updateBody = request.postData() ?? '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: { ...item, title: 'Updated Campus Physics Textbook', price: 325 },
        }),
      });
    }
    if (pathname.endsWith('/images/0') || pathname.endsWith('/images/1')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#dcfce7"/></svg>',
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/sell/listings');
  await expect(page.getByRole('heading', { name: 'Your listings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: item.title })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('seller-my-listings.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Edit listing' }).click();

  await expect(page).toHaveURL(/\/sell\/listings\/mock-item\/edit$/);
  await page.screenshot({
    path: testInfo.outputPath('seller-edit-listing.png'),
    fullPage: true,
  });
  await page.getByLabel('Title', { exact: true }).fill('Updated Campus Physics Textbook');
  await page.getByLabel('Price (₹)').fill('325');
  await page.locator('#edit-listing-images').setInputFiles({
    name: 'extra.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page).toHaveURL(/\/sell\/listings$/);
  expect(updateBody).toContain('name="images"');
  expect(updateBody).toContain('Updated Campus Physics Textbook');
});

test('seller dashboard displays the live stats response', async ({ page }, testInfo) => {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, badgeCounts: { buy: 0, sell: 0 } }),
      });
    }
    if (pathname.endsWith('/me/seller-stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activeListings: 3,
          needsYourAction: 2,
          completedSales: 4,
          averageRating: null,
          ratingCount: 0,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto('/sell');
  await expect(page.getByText('3 active listings')).toBeVisible();
  await expect(page.getByText('No ratings yet')).toBeVisible();
  const statCards = page.locator('.stat-card');
  await expect(statCards.nth(0)).toContainText('3');
  await expect(statCards.nth(1)).toContainText('2');
  await expect(statCards.nth(2)).toContainText('4');
  await page.screenshot({
    path: testInfo.outputPath('seller-dashboard-live-stats.png'),
    fullPage: true,
  });
});

test('buyer completion approval waits for the seller approval', async ({ page }, testInfo) => {
  const order = {
    id: 'mock-order',
    itemId: item.id,
    title: item.title,
    price: item.price,
    status: 'PLACED',
    createdAt: '2026-10-07T00:00:00.000Z',
    completionApprovals: { buyer: false, seller: false },
    rating: null,
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, badgeCounts: { buy: 0, sell: 0 } }),
      });
    }
    if (pathname.endsWith('/orders') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [order] }),
      });
    }
    if (pathname.endsWith('/completion-approval')) {
      order.completionApprovals.buyer = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: order.id,
          status: order.status,
          completionApprovals: order.completionApprovals,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/buy/orders');
  await page.getByRole('button', { name: 'Approve completion' }).click();
  await expect(page.getByRole('status')).toContainText('Your approval is saved');
  await expect(page.getByRole('status')).toContainText('seller approves too');
  await page.screenshot({
    path: testInfo.outputPath('buyer-completion-approval.png'),
    fullPage: true,
  });
});

test('seller approval completes an order when buyer already approved', async ({
  page,
}, testInfo) => {
  const order = {
    id: 'mock-order',
    itemId: item.id,
    title: item.title,
    price: item.price,
    status: 'PLACED',
    createdAt: '2026-10-07T00:00:00.000Z',
    completionApprovals: { buyer: true, seller: false },
    rating: null,
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, badgeCounts: { buy: 0, sell: 0 } }),
      });
    }
    if (pathname.endsWith('/orders') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [order] }),
      });
    }
    if (pathname.endsWith('/completion-approval')) {
      order.completionApprovals.seller = true;
      order.status = 'COMPLETED';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          orderId: order.id,
          status: order.status,
          completionApprovals: order.completionApprovals,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/sell/orders');
  await page.getByRole('button', { name: 'Approve completion' }).click();
  await expect(page.getByRole('article').getByText('Completed', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('seller-completion-approval.png'),
    fullPage: true,
  });
});

test('buyer can rate the seller after the order is completed', async ({ page }, testInfo) => {
  const order = {
    id: 'mock-order',
    itemId: item.id,
    title: item.title,
    price: item.price,
    status: 'COMPLETED',
    createdAt: '2026-10-07T00:00:00.000Z',
    completionApprovals: { buyer: true, seller: true },
    rating: null as number | null,
  };
  let submittedRating: unknown;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user, badgeCounts: { buy: 0, sell: 0 } }),
      });
    }
    if (pathname.endsWith('/orders') && request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orders: [order] }),
      });
    }
    if (pathname.endsWith('/rating')) {
      submittedRating = request.postDataJSON();
      const body = request.postDataJSON() as { rating: number };
      order.rating = body.rating;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ review: { rating: body.rating } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/buy/orders');
  await page.getByLabel('Your rating').selectOption('4');
  await page.getByLabel('Comment (optional)').fill('Easy handover');
  await page.getByRole('button', { name: 'Submit rating' }).click();
  await expect(page.getByRole('status')).toContainText('You rated the seller 4/5');
  expect(submittedRating).toEqual({ rating: 4, comment: 'Easy handover' });
  await page.screenshot({
    path: testInfo.outputPath('buyer-seller-rating.png'),
    fullPage: true,
  });
});
