import { expect, test } from '@playwright/test';

test.describe('Guest API - public personas and plans', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('can get active personas without authentication', async ({ request }) => {
    const response = await request.get(
      '/api/api-gateway/code-persona-service/personas?page=1&size=100'
    );

    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.message).toBeTruthy();

    const data = json.data ?? json;
    expect(data.total).toBe(11);
    expect(data.page).toBe(1);
    expect(data.size).toBe(100);
    expect(data.total_pages).toBe(1);
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(2);

    for (const persona of data.items) {
      expect(persona.id).toBeTruthy();
      expect(persona.name).toBeTruthy();
      expect(persona.voice_uuid).toBeTruthy();
      expect(persona.voice_code).toBeTruthy();
      expect(persona.is_active).toBe(true);
      expect(persona.avatar_url).toMatch(/^https:\/\//);
      expect(persona.greeting_audio_url).toMatch(/^https:\/\//);
      expect(persona.greeting_text).toBeTruthy();
    }
  });

  test('can get active plans without authentication', async ({ request }) => {
    const response = await request.get(
      '/api/api-gateway/code-payment-service/plans?skip=0&limit=10'
    );

    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    const plans = json.data ?? json;

    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);

    const activePlans = plans.filter((plan: any) => plan.isActive);
    expect(activePlans.length).toBeGreaterThan(0);

    for (const plan of activePlans) {
      expect(plan.id).toBeTruthy();
      expect(plan.name).toBeTruthy();
      expect(plan.durationMonths).toBeGreaterThan(0);
      expect(plan.price).toBeGreaterThanOrEqual(0);
      expect(plan.isActive).toBe(true);
      if (plan.features !== undefined) {
        expect(Array.isArray(plan.features)).toBe(true);
      }
    }
  });
});
