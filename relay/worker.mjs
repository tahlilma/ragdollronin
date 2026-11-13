// Ragdoll Ronin online duel relay on Cloudflare Workers.
// Each room code maps to one Durable Object, which holds that room's WebSockets in memory and relays
// snapshots between players. Deploy with `npm run deploy:relay` from the game folder.
import { DuelRoom, roomName } from './room.mjs';

const CORS = { 'Access-Control-Allow-Origin': '*' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = roomName(url.searchParams.get('room'));
    if (url.pathname === '/ws') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426, headers: CORS });
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }
    if (url.pathname === '/status') return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    return new Response('Ragdoll Ronin duel relay is running.', { headers: CORS });
  },
};

export class DuelRoomDO {
  constructor(ctx) {
    this.ctx = ctx;
    this.room = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (!this.room) this.room = new DuelRoom(roomName(url.searchParams.get('room')));
    if (url.pathname === '/status') return Response.json({ room: this.room.name, players: this.room.size }, { headers: CORS });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    server.accept();
    const p = this.room.connect({ send: (s) => server.send(s), close: () => server.close(1000, 'bye') });
    server.addEventListener('message', (e) => this.room.message(p, typeof e.data === 'string' ? e.data : ''));
    const bye = () => this.room.leave(p);
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
}
