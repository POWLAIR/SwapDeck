const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  const axel    = await prisma.user.upsert({ where: { handle: 'axel_d'    }, update: {}, create: { name: 'Axel D.',    handle: 'axel_d',    avatar: '🔥' } });
  const mira    = await prisma.user.upsert({ where: { handle: 'mira_k'    }, update: {}, create: { name: 'Mira K.',    handle: 'mira_k',    avatar: '✨' } });
  const soren   = await prisma.user.upsert({ where: { handle: 'soren_l'   }, update: {}, create: { name: 'Soren L.',   handle: 'soren_l',   avatar: '⚡' } });
  const camille = await prisma.user.upsert({ where: { handle: 'camille_t' }, update: {}, create: { name: 'Camille T.', handle: 'camille_t', avatar: '🌙' } });

  console.log('Users:', [axel, mira, soren, camille].map((u) => u.handle));

  // ── Cartes ────────────────────────────────────────────────────────────────
  // createMany sans contrainte unique sur le nom : acceptable car le seed
  // tourne sur une DB fraîche (prisma db push --accept-data-loss).
  await prisma.card.createMany({
    data: [
      // ── Axel — Pokémon (7 cartes) ──
      {
        name:        'Charizard ex',
        description: 'Le dragon cracheur de feu légendaire en version ex Full Art. Pièce maîtresse de toute collection Pokémon sérieuse.',
        game:        'POKEMON',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },
      {
        name:        'Pikachu',
        description: 'Édition spéciale illustrée par Ken Sugimori. L\'une des cartes les plus recherchées par les collectionneurs.',
        game:        'POKEMON',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },
      {
        name:        'Mewtwo V',
        description: 'Puissante carte V avec l\'attaque Psycho Drive (230 dégâts). Incontournable dans les decks compétitifs.',
        game:        'POKEMON',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },
      {
        name:        'Eevee',
        description: 'Carte commune de base idéale pour initier une collection. Se décline en 8 évolutions différentes.',
        game:        'POKEMON',
        rarity:      'COMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },
      {
        name:        'Rayquaza ex',
        description: 'Dragon céleste maître du ciel. Sa version ex Full Art est l\'une des plus spectaculaires du jeu.',
        game:        'POKEMON',
        rarity:      'SECRET_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },
      {
        name:        'Snorlax GX',
        description: 'Le géant endormi. Sa GX Attaque "Sieste Absolue" permet de soigner 180 PV. Très solide en défense.',
        game:        'POKEMON',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },
      {
        name:        'Charmander',
        description: 'Starter feu de la 1ère édition, 1999. Reconnaissable au tampon "édition 1" sous l\'illustration.',
        game:        'POKEMON',
        rarity:      'UNCOMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     axel.id,
      },

      // ── Mira — Magic: The Gathering (7 cartes) ──
      {
        name:        'Black Lotus (Proxy)',
        description: 'Proxy de la légendaire Black Lotus. Génère 3 manas de n\'importe quelle couleur pour 0 mana. Symbole absolu du pouvoir en Magic.',
        game:        'MAGIC',
        rarity:      'SECRET_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },
      {
        name:        'Lightning Bolt',
        description: 'Inflige 3 blessures à n\'importe quelle cible pour 1 mana rouge. Pilier de tout deck rouge depuis Alpha (1993).',
        game:        'MAGIC',
        rarity:      'UNCOMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },
      {
        name:        'Counterspell',
        description: 'Contre un sort adverse pour 2 manas bleus. La réponse universelle. Indispensable dans les decks contrôle.',
        game:        'MAGIC',
        rarity:      'UNCOMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },
      {
        name:        'Llanowar Elves',
        description: 'Elfe 1/1 qui génère un mana vert supplémentaire. Accélère vos plans dès le tour 1. Classique absolu des decks verts.',
        game:        'MAGIC',
        rarity:      'COMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },
      {
        name:        'Force of Will',
        description: 'Contre-sort jouable sans mana (coût alternatif : exiler une bleue + payer 1 PV). Pilier du format Legacy depuis 1996.',
        game:        'MAGIC',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },
      {
        name:        'Wrath of God',
        description: 'Détruit toutes les créatures. Aucune carte ne peut régénérer. Le reset de terrain de référence en blanc.',
        game:        'MAGIC',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },
      {
        name:        'Shivan Dragon',
        description: 'Dragon 5/5 vol hâte. Symbole de la puissance rouge depuis l\'Alpha. Icône historique du jeu.',
        game:        'MAGIC',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     mira.id,
      },

      // ── Soren — Yu-Gi-Oh! (7 cartes) ──
      {
        name:        'Blue-Eyes White Dragon',
        description: 'Le dragon légendaire de Seto Kaiba. 3000 ATK / 2500 DEF. L\'une des cartes les plus emblématiques de toute l\'histoire du jeu.',
        game:        'YUGIOH',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },
      {
        name:        'Dark Magician',
        description: 'Le maître de la magie obscure, compagnon fidèle de Yugi Muto. 2500 ATK / 2100 DEF. Cœur de nombreux decks thématiques.',
        game:        'YUGIOH',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },
      {
        name:        'Mirror Force',
        description: 'Piège redoutable : détruit tous les monstres adverses en position d\'attaque quand ils déclarent une attaque.',
        game:        'YUGIOH',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },
      {
        name:        'Pot of Greed',
        description: 'Permet de piocher 2 cartes supplémentaires gratuitement. Bannie en compétition officielle pour son avantage démesuré.',
        game:        'YUGIOH',
        rarity:      'UNCOMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },
      {
        name:        'Raigeki',
        description: 'Détruit tous les monstres sur le terrain adverse. Effet dévastateur, bannie en compétition. Version originale très recherchée.',
        game:        'YUGIOH',
        rarity:      'SECRET_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },
      {
        name:        'Red-Eyes Black Dragon',
        description: 'Dragon aux yeux rouges, fidèle compagnon de Joey Wheeler. 2400 ATK / 2000 DEF. Symbole du potentiel non réalisé.',
        game:        'YUGIOH',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },
      {
        name:        'Pot of Desires',
        description: 'Bannissez 10 cartes du haut de votre deck face cachée, puis piochez 2 cartes. Risqué mais puissant dans les decks rapides.',
        game:        'YUGIOH',
        rarity:      'COMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     soren.id,
      },

      // ── Camille — Toutes catégories (7 cartes) ──
      {
        name:        'Agumon',
        description: 'WarGreymon en pleine puissance. Carte foil de l\'édition anniversaire 25 ans. Très recherchée par les fans de la première génération.',
        game:        'DIGIMON',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
      {
        name:        'Gabumon Promo',
        description: 'Carte promotionnelle exclusive distribuée lors du Digimon Card Game World Championship 2023. Tirage très limité.',
        game:        'DIGIMON',
        rarity:      'SECRET_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
      {
        name:        'Bulbasaur',
        description: 'Le starter Plante de la 1ère édition, 1999. Côté collectionneur, la version avec le tampon édition 1 vaut bien plus que la commune standard.',
        game:        'POKEMON',
        rarity:      'UNCOMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
      {
        name:        'Exodia the Forbidden One',
        description: 'La jambe gauche du Sceau Interdit. L\'une des cinq pièces d\'Exodia — réunissez-les toutes pour une victoire instantanée.',
        game:        'YUGIOH',
        rarity:      'ULTRA_RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
      {
        name:        'Terramon Promo',
        description: 'Digimon de type Reptile, édition promotionnelle exclusive tournoi automne 2023. Artwork inédit non disponible en boîte standard.',
        game:        'DIGIMON',
        rarity:      'RARE',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
      {
        name:        'Dracomon',
        description: 'Digimon Bébé II de type Dragon. Point de départ de la chaîne d\'évolution Dracomons → Coredramon → Groundramon.',
        game:        'DIGIMON',
        rarity:      'COMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
      {
        name:        'Squirtle',
        description: 'Le starter Eau original, 1ère impression 1999, reconnaissable à l\'absence de logo édition et au texte avec ombre portée.',
        game:        'POKEMON',
        rarity:      'UNCOMMON',
        imageUrl:    '/assets/placeholder-card.png',
        ownerId:     camille.id,
      },
    ],
  });

  console.log('Cards created: 28 total (7 per user)');

  // ── Trades de démonstration ───────────────────────────────────────────────
  // Récupère toutes les cartes par nom pour les lier aux trades.
  const allCards   = await prisma.card.findMany();
  const byName = (name) => allCards.find((c) => c.name === name);

  // Trade 1 — Axel → Mira, PENDING
  // Axel propose son Charizard ex contre le Black Lotus de Mira.
  const charizard  = byName('Charizard ex');
  const blackLotus = byName('Black Lotus (Proxy)');

  if (charizard && blackLotus) {
    await prisma.trade.create({
      data: {
        initiatorId: axel.id,
        recipientId: mira.id,
        status:      'PENDING',
        tradeCards: {
          create: [
            { cardId: charizard.id,  direction: 'OFFERED'   },
            { cardId: blackLotus.id, direction: 'REQUESTED' },
          ],
        },
        messages: {
          create: {
            authorId: axel.id,
            body:     'Salut Mira ! Je te propose mon Charizard ex (Ultra Rare, quasi-mint) contre ton Black Lotus Proxy. Je sais que c\'est un proxy mais l\'artwork est superbe et c\'est un objet collector à part entière. Dis-moi ce que tu en penses, je suis ouvert à la discussion !',
            action:   'PROPOSE',
          },
        },
      },
    });
    console.log('Demo trade 1 created: Axel → Mira (PENDING)');
  }

  // Trade 2 — Mira → Soren, ACCEPTED
  // Mira a échangé son Counterspell contre le Mirror Force de Soren.
  const counterspell = byName('Counterspell');
  const mirrorForce  = byName('Mirror Force');

  if (counterspell && mirrorForce) {
    await prisma.trade.create({
      data: {
        initiatorId: mira.id,
        recipientId: soren.id,
        status:      'ACCEPTED',
        tradeCards: {
          create: [
            { cardId: counterspell.id, direction: 'OFFERED'   },
            { cardId: mirrorForce.id,  direction: 'REQUESTED' },
          ],
        },
        messages: {
          createMany: {
            data: [
              {
                authorId:  mira.id,
                body:      'Soren, je te propose mon Counterspell contre ton Mirror Force. Les deux sont des pièges incontournables dans leurs univers respectifs — un contre-sort et un contre-attaque. Valeur très similaire selon moi. Deal ?',
                action:    'PROPOSE',
              },
              {
                authorId:  soren.id,
                body:      'Proposition acceptée.',
                action:    'ACCEPT',
              },
            ],
          },
        },
      },
    });
    console.log('Demo trade 2 created: Mira → Soren (ACCEPTED)');
  }

  // Trade 3 — Soren → Camille, PENDING avec contre-proposition en cours
  // Soren propose son Red-Eyes contre Exodia. Camille a contre-proposé.
  const redEyes = byName('Red-Eyes Black Dragon');
  const exodia  = byName('Exodia the Forbidden One');

  if (redEyes && exodia) {
    const parentTrade = await prisma.trade.create({
      data: {
        initiatorId: soren.id,
        recipientId: camille.id,
        status:      'COUNTERED',
        tradeCards: {
          create: [
            { cardId: redEyes.id, direction: 'OFFERED'   },
            { cardId: exodia.id,  direction: 'REQUESTED' },
          ],
        },
        messages: {
          createMany: {
            data: [
              {
                authorId: soren.id,
                body:     'Camille, mon Red-Eyes Black Dragon contre ton Exodia — deux pièces légendaires de Yu-Gi-Oh!. Ça me semble équitable, non ?',
                action:   'PROPOSE',
              },
              {
                authorId: camille.id,
                body:     'Contre-proposition émise.',
                action:   'COUNTER',
              },
            ],
          },
        },
      },
    });

    // Contre-proposition : Camille demande aussi le Dark Magician
    const darkMagician = byName('Dark Magician');
    const terramon     = byName('Terramon Promo');

    if (darkMagician && terramon) {
      await prisma.trade.create({
        data: {
          initiatorId:  camille.id,
          recipientId:  soren.id,
          status:       'PENDING',
          parentTradeId: parentTrade.id,
          tradeCards: {
            create: [
              { cardId: terramon.id,     direction: 'OFFERED'   },
              { cardId: darkMagician.id, direction: 'REQUESTED' },
            ],
          },
          messages: {
            create: {
              authorId: camille.id,
              body:     'Je préfère te proposer mon Terramon Promo (artwork exclusif, tournoi 2023) contre ton Dark Magician. Valeur collector similaire et ça complète mieux nos collections respectives !',
              action:   'PROPOSE',
            },
          },
        },
      });
      console.log('Demo trade 3 created: Soren → Camille (COUNTERED) + counter (PENDING)');
    }
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
