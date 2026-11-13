#!/usr/bin/env node
'use strict';
// Deploys the online duel relay to Cloudflare (free plan) and points the game at it.
//   npm run deploy:relay
// Pass 1 runs wrangler interactively, so it can open the browser to log you in and ask first-time
// questions (like your workers.dev subdomain). Pass 2 re-deploys quietly just to read the relay URL,
// which is written into js/config.js. Then commit and push so Vercel redeploys the game with it.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const relayDir = path.join(__dirname, 'relay');
const configFile = path.join(__dirname, 'js', 'config.js');
const WRANGLER = 'npx --yes wrangler@4';

function run(cmd, capture) {
  return new Promise((resolve) => {
    const p = spawn(cmd, { cwd: relayDir, shell: true, stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit' });
    let out = '';
    if (capture) { p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); }
    p.on('exit', (code) => resolve({ code, out }));
  });
}

(async () => {
  console.log('Step 1/2: deploying the duel relay to Cloudflare.');
  console.log('If you are not logged in, a browser window opens: log in (or sign up, it is free) and click Allow.\n');
  const first = await run(`${WRANGLER} deploy`, false);
  if (first.code) { console.error(`\nwrangler exited with code ${first.code}. Nothing in the game was changed.`); process.exit(first.code); }

  console.log('\nStep 2/2: reading the relay address...');
  const second = await run(`${WRANGLER} deploy`, true);
  const m = second.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i);
  if (second.code || !m) {
    console.error('Deployed, but could not read the workers.dev address. Copy it from the output above into js/config.js as wss://...');
    process.exit(1);
  }
  const relay = m[0].replace(/^https:/, 'wss:');
  fs.writeFileSync(configFile,
    '// Where online duels connect. `npm run deploy:relay` fills this in with your Cloudflare relay\n' +
    '// (wss://....workers.dev). Leave it empty to use the local relay (npm start, port 8787).\n' +
    `window.RR_CONFIG = { relay: '${relay}' };\n`);
  console.log(`\nRelay is live at ${relay}`);
  console.log('js/config.js now points the game at it. Commit and push so Vercel picks it up:');
  console.log('  git add js/config.js && git commit -m "Point the game at the online relay" && git push');
})();
