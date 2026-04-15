/**
 * Proxy centralisé pour les images de cartes TCG.
 *
 * Résout l'URL d'illustration d'une carte via les APIs publiques
 * de chaque licence (PokéTCG, Scryfall, YGOPRODeck, Digimon).
 *
 * • Route publique (pas d'auth requise)
 * • Cache en mémoire (TTL 24h) pour ne jamais appeler deux fois la même API
 * • Répond toujours HTTP 200 avec { imageUrl: string|null }
 *   — jamais de 5xx visible par le client
 */

const https = require('https');

// ── Cache en mémoire ──────────────────────────────────────────────────────────
const cache = new Map(); // clé: "GAME:nom_en_minuscules" → { url, ts }
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures

// ── Utilitaire fetch JSON via https natif (pas de dépendance externe) ─────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: {
        'User-Agent': 'SwapDeck/1.0 (academic project)',
        'Accept':     'application/json',
      } }, (res) => {
        // Gère les redirections 301/302
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJson(res.headers.location).then(resolve).catch(reject);
          res.resume();
          return;
        }
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`JSON parse error for ${url}: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });
}

// ── Résolution d'URL par licence ──────────────────────────────────────────────
async function resolveImageUrl(game, rawName) {
  const cacheKey = `${game}:${rawName.toLowerCase()}`;

  // Vérifie le cache
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return hit.url;
  }

  let url = null;

  try {
    if (game === 'POKEMON') {
      // Retire les suffixes descriptifs ("1ère édition", "de base") pour la recherche
      const name = rawName
        .replace(/\s*(1[eè]re?\s*[eé]dition|de base)/gi, '')
        .trim();
      const q = encodeURIComponent(`name:"${name}"`);
      const json = await fetchJson(
        `https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=1`
      );
      url = json.data?.[0]?.images?.small ?? null;

    } else if (game === 'MAGIC') {
      // Retire les parenthèses (ex. "(Proxy)") avant l'appel Scryfall
      const name = rawName.replace(/\s*\([^)]*\)/g, '').trim();
      const json = await fetchJson(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`
      );
      // Certaines cartes MTG sont double-face → card_faces[0].image_uris
      url =
        json.image_uris?.small ??
        json.card_faces?.[0]?.image_uris?.small ??
        null;

    } else if (game === 'YUGIOH') {
      const json = await fetchJson(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(rawName)}`
      );
      url = json.data?.[0]?.card_images?.[0]?.image_url_small ?? null;

    } else if (game === 'DIGIMON') {
      // N'envoie que le premier mot du nom ("Gabumon Promo" → "Gabumon")
      const firstName = rawName.split(/[\s(]/)[0];
      const json = await fetchJson(
        `https://digimoncard.io/api/search.php?n=${encodeURIComponent(firstName)}&num=1`
      );
      url = (Array.isArray(json) ? json[0]?.image : null) ?? null;
    }
  } catch (_err) {
    // Silencieux — l'emoji reste affiché comme fallback
    url = null;
  }

  cache.set(cacheKey, { url, ts: Date.now() });
  return url;
}

// ── Handler Express ───────────────────────────────────────────────────────────
exports.getCardImage = async (req, res) => {
  const { game, name } = req.query;

  if (!game || !name) {
    return res.json({ imageUrl: null });
  }

  const imageUrl = await resolveImageUrl(game, name).catch(() => null);
  res.json({ imageUrl: imageUrl ?? null });
};
