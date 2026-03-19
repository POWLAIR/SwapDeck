const { test, expect } = require('@playwright/test');

/**
 * Tests fonctionnels — Négociation
 *
 * Cas couverts :
 *   - Cas usuels    : proposition, acceptation, refus, contre-proposition
 *   - Cas extrêmes  : contre-proposition en chaîne, long message
 *   - Cas d'erreurs : proposition sans cartes, proposition sans message
 */

async function login(page, handle) {
  await page.goto('/');
  await page.waitForSelector('.user-picker');
  await page.click(`[data-handle="${handle}"]`);
  await page.waitForSelector('#card-grid-container .card-grid');
}

async function logout(page) {
  await page.click('#btn-logout');
  await page.waitForSelector('.user-picker');
}

// ────────────────────────────────────────────────────────
// Cas usuels
// ────────────────────────────────────────────────────────
test.describe('Négociation — cas usuels', () => {
  test('Axel peut proposer un échange à Mira', async ({ page }) => {
    await login(page, 'axel_d');

    // Clique sur "Proposer un échange" sur une carte de Mira
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();

    // Le modal de proposition doit s'ouvrir
    await expect(page.locator('#trade-form')).toBeVisible();
    await expect(page.locator('#recipient-select')).toBeVisible();

    // Sélectionne une carte à offrir
    const offeredCheckbox = page.locator('input[name="offered"]').first();
    if (await offeredCheckbox.count()) await offeredCheckbox.check();

    // Rédige un message
    await page.fill('#trade-message', 'Je te propose cet échange, qu\'en penses-tu ?');

    // Soumet
    await page.click('#trade-form button[type="submit"]');

    // Redirigé vers le fil de négociation
    await page.waitForURL(/#trade\/\d+/);
    await expect(page.locator('.thread-header')).toBeVisible();
  });

  test('Mira voit la proposition dans ses échanges reçus', async ({ page }) => {
    // D'abord créer un échange depuis Axel
    await login(page, 'axel_d');
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Proposition test');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/\d+/);

    // Se connecter en tant que Mira
    await logout(page);
    await login(page, 'mira_k');

    // Aller dans les échanges
    await page.click('[data-page="trades"]');
    await page.waitForSelector('.trade-list');

    // Filtrer sur "Reçus"
    await page.click('[data-role="received"]');
    await page.waitForTimeout(500);

    const tradeItems = page.locator('.trade-item');
    await expect(tradeItems.first()).toBeVisible();
  });

  test('Mira peut accepter une proposition', async ({ page }) => {
    // Axel crée une proposition
    await login(page, 'axel_d');
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Proposition à accepter');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/(\d+)/);

    const url = page.url();
    const tradeId = url.match(/#trade\/(\d+)/)[1];

    // Mira accepte
    await logout(page);
    await login(page, 'mira_k');
    await page.goto(`/#trade/${tradeId}`);
    await page.waitForSelector('.thread-header');

    await page.click('#btn-accept');
    await page.waitForTimeout(300);

    // Confirmation dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Le badge doit passer à "Accepté"
    await expect(page.locator('.badge-accepted')).toBeVisible({ timeout: 5000 });
  });

  test('Mira peut refuser une proposition', async ({ page }) => {
    await login(page, 'axel_d');
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Proposition à refuser');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/(\d+)/);

    const tradeId = page.url().match(/#trade\/(\d+)/)[1];

    await logout(page);
    await login(page, 'mira_k');
    await page.goto(`/#trade/${tradeId}`);
    await page.waitForSelector('#btn-refuse');

    page.once('dialog', (d) => d.accept());
    await page.click('#btn-refuse');

    await expect(page.locator('.badge-refused')).toBeVisible({ timeout: 5000 });
  });

  test('Mira peut faire une contre-proposition', async ({ page }) => {
    await login(page, 'axel_d');
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Proposition initiale');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/(\d+)/);

    const tradeId = page.url().match(/#trade\/(\d+)/)[1];

    await logout(page);
    await login(page, 'mira_k');
    await page.goto(`/#trade/${tradeId}`);
    await page.waitForSelector('#btn-counter');

    await page.click('#btn-counter');
    await page.waitForSelector('#counter-form');

    await page.fill('#counter-form [name="message"]', 'Ma contre-offre est meilleure !');
    await page.click('#counter-form button[type="submit"]');

    // Redirigé vers la nouvelle trade (contre-proposition)
    await page.waitForURL(/#trade\/(\d+)/);
    const newTradeId = page.url().match(/#trade\/(\d+)/)[1];
    expect(parseInt(newTradeId)).toBeGreaterThan(parseInt(tradeId));

    // La trade originale doit afficher "Contre-proposition"
    await page.goto(`/#trade/${tradeId}`);
    await page.waitForSelector('.badge-countered');
    await expect(page.locator('.badge-countered')).toBeVisible();
  });

  test("l'historique des messages est préservé", async ({ page }) => {
    await login(page, 'axel_d');
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Message initial de la proposition');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/(\d+)/);

    // Le message doit apparaître dans le fil
    await expect(page.locator('.thread-messages')).toContainText('Message initial de la proposition');
  });
});

// ────────────────────────────────────────────────────────
// Cas extrêmes
// ────────────────────────────────────────────────────────
test.describe('Négociation — cas extrêmes', () => {
  test('un long message est accepté et affiché correctement', async ({ page }) => {
    await login(page, 'axel_d');

    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');

    const longMessage = 'A'.repeat(1000);
    await page.fill('#trade-message', longMessage);
    await page.click('#trade-form button[type="submit"]');

    await page.waitForURL(/#trade\/\d+/);
    await expect(page.locator('.thread-messages')).toContainText('A'.repeat(20));
  });

  test('une même trade ne peut pas être acceptée deux fois', async ({ page }) => {
    await login(page, 'axel_d');
    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Double accept test');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/(\d+)/);

    const tradeId = page.url().match(/#trade\/(\d+)/)[1];

    await logout(page);
    await login(page, 'mira_k');
    await page.goto(`/#trade/${tradeId}`);
    await page.waitForSelector('#btn-accept');

    page.once('dialog', (d) => d.accept());
    await page.click('#btn-accept');
    await page.waitForSelector('.badge-accepted');

    // Le bouton d'action ne doit plus exister
    await expect(page.locator('#btn-accept')).toHaveCount(0);
  });
});

// ────────────────────────────────────────────────────────
// Cas d'erreur
// ────────────────────────────────────────────────────────
test.describe('Négociation — cas d\'erreur', () => {
  test('impossible de proposer sans sélectionner de cartes', async ({ page }) => {
    await login(page, 'axel_d');

    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');

    // Ne coche aucune carte
    await page.fill('#trade-message', 'Message sans carte');

    // Intercepte l'alerte
    page.once('dialog', (d) => {
      expect(d.message()).toContain('carte');
      d.dismiss();
    });
    await page.click('#trade-form button[type="submit"]');

    // Le modal doit rester ouvert
    await expect(page.locator('#trade-form')).toBeVisible();
  });

  test('impossible de proposer sans message', async ({ page }) => {
    await login(page, 'axel_d');

    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');

    const offeredCheckbox = page.locator('input[name="offered"]').first();
    if (await offeredCheckbox.count()) await offeredCheckbox.check();
    // Ne remplit pas le message

    page.once('dialog', (d) => {
      expect(d.message()).toContain('message');
      d.dismiss();
    });
    await page.click('#trade-form button[type="submit"]');

    await expect(page.locator('#trade-form')).toBeVisible();
  });

  test("l'initiateur ne peut pas accepter sa propre proposition", async ({ page }) => {
    await login(page, 'axel_d');

    const proposeBtn = page.locator('[data-propose-card]').first();
    await proposeBtn.click();
    await page.waitForSelector('#trade-form');
    await page.fill('#trade-message', 'Test auto-accept');
    await page.click('#trade-form button[type="submit"]');
    await page.waitForURL(/#trade\/\d+/);

    // Axel (initiateur) ne doit pas voir les boutons d'action
    await expect(page.locator('#btn-accept')).toHaveCount(0);
    await expect(page.locator('#btn-refuse')).toHaveCount(0);
  });
});
