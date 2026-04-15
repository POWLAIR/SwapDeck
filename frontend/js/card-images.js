import { api } from './api.js';

/**
 * Injecte progressivement les vraies illustrations de cartes dans un conteneur.
 *
 * Cherche tous les éléments portant [data-card-game] et [data-card-name],
 * appelle le proxy backend pour chaque carte en parallèle, puis remplace
 * l'emoji placeholder par un <img> si une URL est disponible.
 *
 * Fallback silencieux : si l'API ne répond pas ou renvoie null, l'emoji
 * reste visible — aucune régression visuelle.
 *
 * @param {Element} container - L'élément DOM contenant les placeholders
 */
export async function injectCardImages(container) {
  const placeholders = [
    ...container.querySelectorAll('[data-card-game][data-card-name]'),
  ];

  if (!placeholders.length) return;

  await Promise.allSettled(
    placeholders.map(async (el) => {
      el.classList.add('loading');

      const url = await api.getCardImage(
        el.dataset.cardGame,
        el.dataset.cardName
      );

      el.classList.remove('loading');

      if (url) {
        const img = document.createElement('img');
        img.className   = 'card-image-real';
        img.src         = url;
        img.alt         = el.dataset.cardName;
        img.loading     = 'lazy';
        // Si l'image CDN échoue au chargement, on revient à l'emoji
        img.onerror = () => {
          el.classList.remove('has-image');
          el.innerHTML = el.dataset.fallbackEmoji || '🃏';
        };

        // Sauvegarde l'emoji pour le cas onerror
        el.dataset.fallbackEmoji = el.textContent.trim() || '🃏';

        el.innerHTML = '';
        el.appendChild(img);
        el.classList.add('has-image');
      }
    })
  );
}
