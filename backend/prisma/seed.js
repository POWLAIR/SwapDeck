const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Users
  const axel = await prisma.user.upsert({
    where: { handle: 'axel_d' },
    update: {},
    create: { name: 'Axel D.', handle: 'axel_d', avatar: '🔥' },
  });
  const mira = await prisma.user.upsert({
    where: { handle: 'mira_k' },
    update: {},
    create: { name: 'Mira K.', handle: 'mira_k', avatar: '✨' },
  });
  const soren = await prisma.user.upsert({
    where: { handle: 'soren_l' },
    update: {},
    create: { name: 'Soren L.', handle: 'soren_l', avatar: '⚡' },
  });
  const camille = await prisma.user.upsert({
    where: { handle: 'camille_t' },
    update: {},
    create: { name: 'Camille T.', handle: 'camille_t', avatar: '🌙' },
  });

  console.log('Users created:', [axel, mira, soren, camille].map((u) => u.handle));

  // Cards for Axel (Pokémon)
  await prisma.card.createMany({
    data: [
      {
        name: 'Charizard ex',
        description: 'Le dragon cracheur de feu légendaire. Rare et très convoité.',
        game: 'POKEMON',
        rarity: 'ULTRA_RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: axel.id,
      },
      {
        name: 'Pikachu illustré',
        description: 'Edition spéciale illustrée par Ken Sugimori. Objet de collection.',
        game: 'POKEMON',
        rarity: 'RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: axel.id,
      },
      {
        name: 'Mewtwo V',
        description: 'Puissante carte V avec attaque Psycho Drive.',
        game: 'POKEMON',
        rarity: 'RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: axel.id,
      },
      {
        name: 'Évoli de base',
        description: 'Carte commune de base, idéale pour évoluer.',
        game: 'POKEMON',
        rarity: 'COMMON',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: axel.id,
      },
    ],
  });

  // Cards for Mira (Magic: The Gathering)
  await prisma.card.createMany({
    data: [
      {
        name: 'Black Lotus (Proxy)',
        description: 'Proxy de la légendaire Black Lotus. Symbole du pouvoir en Magic.',
        game: 'MAGIC',
        rarity: 'SECRET_RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: mira.id,
      },
      {
        name: 'Lightning Bolt',
        description: 'Instants classique qui inflige 3 blessures. Pilier de tout deck rouge.',
        game: 'MAGIC',
        rarity: 'UNCOMMON',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: mira.id,
      },
      {
        name: 'Counterspell',
        description: 'Contre un sort adverse. Indispensable dans les decks bleus.',
        game: 'MAGIC',
        rarity: 'UNCOMMON',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: mira.id,
      },
      {
        name: 'Llanowar Elves',
        description: 'Elfe de base qui génère un mana vert supplémentaire.',
        game: 'MAGIC',
        rarity: 'COMMON',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: mira.id,
      },
    ],
  });

  // Cards for Soren (Yu-Gi-Oh!)
  await prisma.card.createMany({
    data: [
      {
        name: 'Blue-Eyes White Dragon',
        description: 'Le dragon légendaire de Seto Kaiba. 3000 ATK / 2500 DEF.',
        game: 'YUGIOH',
        rarity: 'ULTRA_RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: soren.id,
      },
      {
        name: 'Dark Magician',
        description: 'Le maître de la magie obscure. Carte emblématique de Yugi.',
        game: 'YUGIOH',
        rarity: 'RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: soren.id,
      },
      {
        name: 'Mirror Force',
        description: 'Piège redoutable qui détruit tous les monstres attaquants.',
        game: 'YUGIOH',
        rarity: 'RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: soren.id,
      },
      {
        name: 'Pot of Greed',
        description: 'Permet de piocher 2 cartes supplémentaires. Bannie en compétition.',
        game: 'YUGIOH',
        rarity: 'UNCOMMON',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: soren.id,
      },
    ],
  });

  // Cards for Camille (mixed)
  await prisma.card.createMany({
    data: [
      {
        name: 'Agumon (Méga)',
        description: "WarGreymon en pleine puissance. Carte foil de l'édition anniversaire.",
        game: 'DIGIMON',
        rarity: 'ULTRA_RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: camille.id,
      },
      {
        name: 'Gabumon Promo',
        description: 'Carte promotionnelle exclusive distribuée lors du World Championship.',
        game: 'DIGIMON',
        rarity: 'SECRET_RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: camille.id,
      },
      {
        name: 'Bulbizarre de base',
        description: 'Le starter emblématique, édition originale 1999.',
        game: 'POKEMON',
        rarity: 'UNCOMMON',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: camille.id,
      },
      {
        name: "Exodia l'Interdit",
        description: 'La pièce gauche du poing. Une des cinq pièces pour la victoire instantanée.',
        game: 'YUGIOH',
        rarity: 'ULTRA_RARE',
        imageUrl: '/assets/placeholder-card.png',
        ownerId: camille.id,
      },
    ],
  });

  console.log('Cards created: 4 per user (16 total)');
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
