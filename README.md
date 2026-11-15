# Ragdoll Ronin

A wobbly, physics-driven samurai side-scroller. Your mouse swings the blade, and you can duel your friends online.

## Play locally

```
npm start
```

This serves the game with `npx serve` on http://localhost:3000 and starts a local duel relay on port 8787.
People on your Wi-Fi can join at the `http://<your-ip>:3000` address it prints.

## Put it online (free)

The game is static files, so it's hosted on **Vercel**.
Vercel can't keep WebSocket connections open, so online duels run on a small **Cloudflare** relay (`relay/`, a Durable Object).
Both have free plans.

1. **Deploy the duel relay** (once, plus again whenever `relay/` changes):
   ```
   npm run deploy:relay
   ```
   The first time, a browser window opens to log in to Cloudflare. A free account is fine.
   When it finishes, the script writes the relay address into `js/config.js`.

2. **Push to GitHub**: create an empty repo on github.com, then:
   ```
   git add -A
   git commit -m "Online relay"
   git remote add origin https://github.com/<you>/ragdoll-ronin.git
   git push -u origin main
   ```

3. **Import into Vercel**: go to vercel.com → Add New → Project → import the repo.
   Leave every setting at its default (Framework: Other, no build command) and click Deploy.
   Every later `git push` redeploys automatically.

Send friends the Vercel link. Leave the room box empty to fight in the public duel, or type the same room code to fight privately.

## How the netcode keeps lag down

- Every player's own samurai is simulated on their own machine, so your controls never wait for the network.
- Players send timestamped snapshots: about 30 a second while moving, about 8 while standing still.
- Rivals are replayed through a jitter buffer sized from measured jitter. That's about one send interval plus jitter, roughly 40–60 ms on a good connection. If a packet is late, rivals are briefly extrapolated so they don't freeze.
- Hits are judged by the attacker ("you hit what you see"), with instant blood and sound. The victim's game still respects dashes and invulnerability.
- Each room code gets its own Durable Object. Cloudflare creates it close to the first player who joins.
- The HUD shows your ping.

Cloudflare's free plan allows roughly 100k Durable Object requests per day.
Incoming WebSocket messages count 20 to 1, which works out to about 9 hours of continuous 2-player dueling (or 4–5 hours with 4 players) per day.

## Files

- `index.html`, `css/`, `js/`: the game (deployed to Vercel)
- `js/config.js`: the online relay address (written by `npm run deploy:relay`)
- `relay/`: the Cloudflare duel relay (`worker.mjs`), and the room logic it shares with the local relay (`room.mjs`)
- `server.js`: local/LAN duel relay (Node, no dependencies)
- `start.js`: `npm start` (npx serve + local relay)

Story mode is ten chapters in five acts: a road chapter (ambushes, then a gate) followed by that act's boss. Dev shortcuts: `?stage=1`..`?stage=10`, `?stage=4&boss`, `?room=code`, `?relay=host:port`
