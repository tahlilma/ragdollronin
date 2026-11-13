#!/usr/bin/env node
'use strict';
// Deploys the online duel relay to Cloudflare (free plan) and points the game at it.
//   npm run deploy:relay
// First run opens your browser to log in to Cloudflare. Afterwards js/config.js holds the relay URL;
// commit and push so Vercel redeploys the game with it.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const relayDir = path.join(__dirname, 'relay');
const configFile = path.join(__dirname, 'js', 'config.js');
console.log('Deploying the duel relay to Cloudflare (a browser window may open to log in)...\n');
const p = spawn('npx --yes wrangler@4 deploy', { cwd: relayDir, shell: true, stdio: ['inherit', 'pipe', 'inherit'] });
let out = '';
p.stdout.on('data', (d) => { process.stdout.write(d); out += d; });
p.on('exit', (code) => {
  if (code) { console.error(`\nwrangler exited with code ${code}. Nothing was changed.`); process.exit(code); }
  const m = out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i);
  if (!m) { console.error('\nDeployed, but could not find the workers.dev URL in the output. Put it in js/config.js by hand (as wss://...).'); process.exit(1); }
  const relay = m[0].replace(/^https:/, 'wss:');
  fs.writeFileSync(configFile,
    '// Where online duels connect. `npm run deploy:relay` fills this in with your Cloudflare relay\n' +
    '// (wss://....workers.dev). Leave it empty to use the local relay (npm start, port 8787).\n' +
    `window.RR_CONFIG = { relay: '${relay}' };\n`);
  console.log(`\nRelay is live at ${relay}`);
  console.log('js/config.js now points the game at it. Commit and push so Vercel picks it up:');
  console.log('  git add js/config.js && git commit -m "Point the game at the online relay" && git push');
});
