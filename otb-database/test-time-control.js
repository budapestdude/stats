const { EnhancedPlayerAnalyzer } = require('./player-analyzer-enhanced');

const analyzer = new EnhancedPlayerAnalyzer('Test');

const tests = [
  ['3+2', null, 'Expected: blitz'],
  ['10+5', null, 'Expected: blitz/rapid'],
  ['15+10', null, 'Expected: rapid'],
  ['90+30', null, 'Expected: classical'],
  ['3600+30', null, 'Expected: classical'],
  ['90+30', 'World Blitz Championship', 'Expected: blitz (from event)'],
  ['15+10', 'Rapid Championship', 'Expected: rapid (from event)'],
  ['60+30', null, 'Expected: classical'],
  ['300+0', null, 'Expected: blitz (5 min)'],
  ['900+10', null, 'Expected: rapid (15 min)'],
  ['4+2', null, 'Expected: blitz'],
  ['30+30', null, 'Expected: rapid/classical'],
];

console.log('Time Control Categorization Tests:\n');
tests.forEach(([tc, event, expected]) => {
  const result = analyzer.categorizeTimeControl(tc, event);
  console.log(`TC: ${tc.padEnd(10)} Event: ${(event || 'none').padEnd(30)} → ${result.padEnd(10)} (${expected})`);
});

// Check some real game examples
console.log('\n\nChecking distribution from actual games:');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function checkSample() {
  const filePath = path.join(__dirname, 'pgn-files', 'lumbrasgigabase_2025.pgn');
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const distribution = {
    classical: 0,
    rapid: 0,
    blitz: 0,
    online: 0
  };

  let currentGame = {};
  let gamesChecked = 0;

  for await (const line of rl) {
    if (line.startsWith('[')) {
      const match = line.match(/\[(\w+)\s+"([^"]+)"\]/);
      if (match) {
        const [, key, value] = match;
        currentGame[key.toLowerCase()] = value;
      }
    } else if (line.trim() === '' && currentGame.white) {
      if (gamesChecked < 1000) {
        const category = analyzer.categorizeTimeControl(currentGame.timecontrol, currentGame.event);
        distribution[category]++;
        gamesChecked++;
      } else {
        break;
      }
      currentGame = {};
    }
  }

  console.log(`\nSampled ${gamesChecked} games from 2025:`);
  console.log('Classical:', distribution.classical);
  console.log('Rapid:', distribution.rapid);
  console.log('Blitz:', distribution.blitz);
  console.log('Online:', distribution.online);
}

checkSample().catch(console.error);