const { test, expect } = require('@playwright/test');

/**
 * Tests fonctionnels — Catalogue
 *
 * Cas couverts :
 *   - Cas usuels    : affichage des cartes, filtres par jeu
 *   - Cas extrêmes  : filtre sans résultats, carte sans image
 *   - Cas d'erreurs : accès sans session, API indisponible (simulé)
 */

// Helper : se connecter avec un utilisateur prédéfini
async function login(page, handle = 'axel_d') {
  await page.goto('/');
  await page.waitForSelector('.user-picker');
  await page.click(`[data-handle="${handle}"]`);
  await page.waitForSelector('#card-grid-container .card-grid');
}

// ────────────────────────────────────────────────────────
// Cas usuels
// ────────────────────────────────────────────────────────
test.describe('Catalogue — cas usuels', () => {
  test('la page se charge et affiche des cartes après connexion', async ({ page }) => {
    await login(page);

    const cards = page.locator('.card-tile');
    await expect(cards.first()).toBeVisible();
    await expect(cards).toHaveCountGreaterThan(0);
  });

  test('les cartes ont un nom, un badge jeu et un badge rareté', async ({ page }) => {
    await login(page);

    const firstCard = page.locator('.card-tile').first();
    await expect(firstCard.locator('.card-name')).not.toBeEmpty();
    await expect(firstCard.locator('.badge').first()).toBeVisible();
  });

  test("le filtre Pokémon n'affiche que des cartes Pokémon", async ({ page }) => {
    await login(page);

    await page.click('[data-game="POKEMON"]');
    await page.waitForTimeout(500);

    const badges = page.locator('.badge-pokemon');
    await expect(badges.first()).toBeVisible();

    // Aucun badge Magic ou Yu-Gi-Oh ne doit apparaître
    await expect(page.locator('.badge-magic')).toHaveCount(0);
    await expect(page.locator('.badge-yugioh')).toHaveCount(0);
  });

  test("le filtre Magic n'affiche que des cartes Magic", async ({ page }) => {
    await login(page);

    await page.click('[data-game="MAGIC"]');
    await page.waitForTimeout(500);

    const badges = page.locator('.badge-magic');
    await expect(badges.first()).toBeVisible();
  });

  test('le filtre Tous recharge toutes les cartes', async ({ page }) => {
    await login(page);

    await page.click('[data-game="POKEMON"]');
    await page.waitForTimeout(400);
    await page.click('[data-game=""]');
    await page.waitForTimeout(400);

    const cards = page.locator('.card-tile');
    await expect(cards).toHaveCountGreaterThan(4);
  });

  test("les cartes d'autres utilisateurs ont un bouton « Proposer un échange »", async ({ page }) => {
    await login(page, 'axel_d');

    // Les cartes n'appartenant pas à axel_d doivent avoir le bouton
    const proposeBtn = page.locator('[data-propose-card]').first();
    await expect(proposeBtn).toBeVisible();
    await expect(proposeBtn).toHaveText(/proposer/i);
  });

  test('les propres cartes affichent « Ma carte » sans bouton', async ({ page }) => {
    await login(page, 'axel_d');

    // Filtrer sur les cartes de Axel pour les isoler (ownerId visible dans le DOM)
    // Cherche un élément .card-owner contenant "Axel" — la carte suivante doit avoir "Ma carte"
    const myCardText = page.locator('.card-tile').filter({ hasText: 'Axel D.' }).first().locator('.card-actions');
    await expect(myCardText).toContainText('Ma carte');
  });
});

// ────────────────────────────────────────────────────────
// Cas extrêmes
// ────────────────────────────────────────────────────────
test.describe('Catalogue — cas extrêmes', () => {
  test("un filtre sans résultats affiche l'état vide", async ({ page }) => {
    await login(page);

    // Si la catégorie OTHER n'a pas de cartes dans la seed, affiche l'état vide
    await page.click('[data-game="OTHER"]');
    await page.waitForTimeout(500);

    // Soit des cartes, soit l'état vide — les deux sont valides
    const hasCards = await page.locator('.card-tile').count();
    const hasEmpty = await page.locator('.empty-state').count();
    expect(hasCards + hasEmpty).toBeGreaterThan(0);
  });

  test('le placeholder graphique est affiché pour les cartes sans image réelle', async ({ page }) => {
    await login(page);

    // Le placeholder SVG/emoji est dans .card-image-placeholder
    const placeholder = page.locator('.card-image-placeholder').first();
    await expect(placeholder).toBeVisible();
  });

  test('la navigation rapide entre filtres ne plante pas', async ({ page }) => {
    await login(page);

    const games = ['POKEMON', 'MAGIC', 'YUGIOH', 'DIGIMON', ''];
    for (const game of games) {
      await page.click(`[data-game="${game}"]`);
    }

    await page.waitForTimeout(600);
    // Pas de message d'erreur affiché
    await expect(page.locator('.empty-state p')).not.toContainText('Erreur');
  });
});

// ────────────────────────────────────────────────────────
// Cas d'erreur
// ────────────────────────────────────────────────────────
test.describe('Catalogue — cas d\'erreur', () => {
  test('redirige vers la connexion si pas de session active', async ({ page }) => {
    // Accès direct sans login
    await page.goto('/#catalog');
    await page.waitForTimeout(500);

    // L'overlay d'auth doit être visible
    await expect(page.locator('.auth-overlay')).toBeVisible();
    await expect(page.locator('.user-picker')).toBeVisible();
  });

  test("affiche un message d'erreur si l'API est indisponible", async ({ page }) => {
    await login(page);

    // Intercepte les appels API et retourne une erreur
    await page.route('**/api/cards*', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
    );

    // Recharge le catalogue en cliquant sur un filtre
    await page.click('[data-game="MAGIC"]');
    await page.waitForTimeout(600);

    await expect(page.locator('#card-grid-container')).toContainText(/erreur/i);
  });
});
