import { expect, test } from '@playwright/test';

const PUBLIC_SHARE_URLS = [
  '/share/e334e566-834a-46b2-ab01-5399eb4ce8e0/b4840dbc',
  '/share/d51942b0-0aff-4ead-88ae-e813c47a9a9c/2f96a259',
  '/share/0a65a3ff-e2e9-4943-920a-483fab52bfc8/eade4ab7',
  '/share/8dc3c4e1-b63d-4d70-98f7-a89bfacefadc/2d022228',
  '/share/80a989ad-6b2e-46b6-84ec-baf843c70e14/0fcaa121',
];

test.describe('Guest - home, personas, plans, public shares', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('can open home, view personas/plans, and rotate all personas twice', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);

    const personaResponse = await request.get(
      '/api/api-gateway/code-persona-service/personas?page=1&size=100'
    );
    expect(personaResponse.ok()).toBeTruthy();
    const personaJson = await personaResponse.json();
    const personaData = personaJson.data ?? personaJson;
    const personas = personaData.items.filter((item: any) => item.is_active);

    expect(personaData.total).toBe(11);
    expect(personas.length).toBeGreaterThanOrEqual(2);

    const plansResponse = await request.get(
      '/api/api-gateway/code-payment-service/plans?skip=0&limit=10'
    );
    expect(plansResponse.ok()).toBeTruthy();
    const plansJson = await plansResponse.json();
    const plans = (plansJson.data ?? plansJson).filter((plan: any) => plan.isActive);
    expect(plans.length).toBeGreaterThan(0);

    await page.goto('/');
    await expect(page).toHaveURL('https://20206205.tech/');

    await page.locator('#personas').scrollIntoViewIfNeeded();
    await expect(page.locator('#personas img').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(async () => {
        const text = (await page.locator('#personas').innerText()).trim();
        return personas.some((persona: any) => text.includes(persona.name));
      })
      .toBeTruthy();

    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.locator('#pricing')).toBeVisible();
    await expect(page.getByText(plans[0].name, { exact: true })).toBeVisible();

    await page.locator('#personas').scrollIntoViewIfNeeded();
    const nextPersona = page.getByLabel('Next persona');
    await expect(nextPersona).toBeVisible();

    for (let i = 0; i < personaData.total * 2; i++) {
      await nextPersona.click();
      await page.waitForTimeout(2_000);
    }

    await expect
      .poll(async () => {
        const text = (await page.locator('#personas').innerText()).trim();
        return personas.some((persona: any) => text.includes(persona.name));
      })
      .toBeTruthy();
  });

  for (const shareUrl of PUBLIC_SHARE_URLS) {
    test(`can view public share ${shareUrl}`, async ({ page }) => {
      const response = await page.goto(shareUrl);
      expect(response?.status()).toBeLessThan(400);

      await expect(page.locator('header')).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('main')).toBeVisible();
    });
  }
});
