#!/usr/bin/env node
'use strict';
// Vercel build: the game is plain static files. Copy just those into dist/ (no server code).
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['index.html', 'css', 'js']) {
  fs.cpSync(path.join(__dirname, item), path.join(out, item), { recursive: true });
}
console.log('Static game copied to dist/');
