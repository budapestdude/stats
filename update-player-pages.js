const fs = require('fs');
const path = require('path');

const players = [
  { slug: 'anatoly-karpov', name: 'Anatoly Karpov', title: 'World Champion 1975-1985 • The Python' },
  { slug: 'viswanathan-anand', name: 'Viswanathan Anand', title: 'World Champion 2007-2013 • The Tiger from Madras' },
  { slug: 'vladimir-kramnik', name: 'Vladimir Kramnik', title: 'World Champion 2000-2007 • Deep Positional Master' },
  { slug: 'fabiano-caruana', name: 'Fabiano Caruana', title: 'US #1 • Peak Rating 2844' },
  { slug: 'hikaru-nakamura', name: 'Hikaru Nakamura', title: '5-time US Champion • Speed Chess Legend' },
  { slug: 'ian-nepomniachtchi', name: 'Ian Nepomniachtchi', title: '2x World Championship Challenger' },
  { slug: 'levon-aronian', name: 'Levon Aronian', title: 'Peak Rating 2830 • Creative Genius' },
  { slug: 'bobby-fischer', name: 'Bobby Fischer', title: 'World Champion 1972-1975 • The American Legend' },
  { slug: 'ding-liren', name: 'Ding Liren', title: 'World Champion 2023-present' }
];

const pageTemplate = (playerName, playerSlug, playerTitle) => `'use client';

import PlayerProfile from '@/components/PlayerProfile';

export default function ${playerName.replace(/\s+/g, '')}Page() {
  return (
    <PlayerProfile 
      playerName="${playerName}"
      playerSlug="${playerSlug}"
      playerTitle="${playerTitle}"
    />
  );
}`;

const frontendDir = path.join(__dirname, 'frontend', 'app', 'players');

players.forEach(player => {
  const filePath = path.join(frontendDir, player.slug, 'page.tsx');
  const content = pageTemplate(player.name, player.slug, player.title);
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${player.name} page`);
});

console.log('\nAll player pages updated to use PlayerProfile component!');