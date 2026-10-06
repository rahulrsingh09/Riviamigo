import { expect, test } from '@playwright/test';

test('login page renders the auth shell', async ({ page }) => {
  await page.routeWebSocket('**/v1/vehicles/live**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (!/^\/v[12]\//.test(url.pathname)) return route.continue();
    if (url.pathname === '/v1/auth/bootstrap') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'No fixture session' } }),
      });
    }
    const responses: Record<string, unknown> = {
      '/v1/auth/setup': { setup_required: false },
      '/v1/auth/config': {
        password_login_enabled: true,
        oidc_enabled: false,
        oidc_ready: false,
        oidc_auto_login: false,
      },
    };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responses[url.pathname] ?? {}),
    });
  });
  await page.goto('/login');

  await expect(page.getByRole('img', { name: 'Riviamigo', exact: true })).toBeVisible();
  await expect(page.getByText("Your Rivian's data companion.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
});
