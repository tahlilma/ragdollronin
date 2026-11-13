// Duel room logic shared by the local Node relay (server.js) and the Cloudflare Durable Object (worker.mjs).
// A connection only needs { send(string), close() }.
export const MAX_PLAYERS = 8;
export const KILLS_TO_WIN = 10;
const COLORS = ['#e5323d', '#3d8bff', '#3ddc84', '#ffb02e', '#c44dff', '#ff6ac1', '#2ee6d6', '#f2f2f2'];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export class DuelRoom {
  constructor(name = 'public', log = () => {}) {
    this.name = name; this.log = log;
    this.players = new Map();
    this.nextId = 1; this.mapIdx = Math.floor(Math.random() * 5); this.matchOver = false;
  }
  get size() { return this.players.size; }
  roster() { return [...this.players.values()].map(({ id, name, color, kills, deaths }) => ({ id, name, color, kills, deaths })); }
  sendTo(p, obj) { try { p.conn.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) { /* socket gone */ } }
  broadcast(obj, exceptId = 0) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    for (const p of this.players.values()) if (p.id !== exceptId) this.sendTo(p, s);
  }

  connect(conn) { return { id: 0, conn, name: '', color: '', kills: 0, deaths: 0, gone: false }; }
  message(p, raw) {
    if (typeof raw !== 'string' || raw.length > 64 * 1024 || p.gone) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') { this.sendTo(p, { t: 'pong', c: num(m.c) }); return; }
    if (!p.id) { if (m.t === 'hello') this.hello(p, m); return; }
    switch (m.t) {
      case 's': // movement snapshot -> everyone else, tagged with the sender (no re-serialising)
        if (raw[0] === '{') this.broadcast(`{"id":${p.id},${raw.slice(1)}`, p.id);
        break;
      case 'hit': { // attacker says it cut someone; only the victim's client decides if it lands
        const q = this.players.get(m.to | 0);
        if (q && q !== p) this.sendTo(q, { t: 'hit', from: p.id, dmg: Math.min(3, Math.max(1, m.dmg | 0)), kx: num(m.kx), ky: num(m.ky), x: num(m.x), y: num(m.y) });
        break;
      }
      case 'ouch': this.broadcast({ t: 'ouch', id: p.id, by: m.by | 0, dmg: m.dmg | 0, x: num(m.x), y: num(m.y) }, p.id); break;
      case 'parry': this.broadcast({ t: 'parry', from: p.id, to: m.to | 0, x: num(m.x), y: num(m.y) }, p.id); break;
      case 'say': this.broadcast({ t: 'say', id: p.id, i: m.i | 0 }, p.id); break;
      case 'died': this.died(p, m); break;
    }
  }
  hello(p, m) {
    if (this.players.size >= MAX_PLAYERS) { this.sendTo(p, { t: 'full' }); try { p.conn.close(); } catch (e) { /* closed */ } return; }
    p.id = this.nextId++;
    p.name = String(m.name || '').replace(/[^\p{L}\p{N} _\-.!?']/gu, '').trim().slice(0, 16) || 'Ronin ' + p.id;
    const used = new Set([...this.players.values()].map((q) => q.color));
    p.color = COLORS.find((c) => !used.has(c)) || COLORS[p.id % COLORS.length];
    this.players.set(p.id, p);
    this.sendTo(p, { t: 'welcome', id: p.id, color: p.color, map: this.mapIdx, roster: this.roster(), target: KILLS_TO_WIN, over: this.matchOver, room: this.name });
    this.broadcast({ t: 'join', id: p.id, roster: this.roster() }, p.id);
    this.log(`[${this.name}] ${p.name} joined (${this.players.size} in the duel)`);
  }
  leave(p) {
    if (p.gone) return;
    p.gone = true;
    if (!p.id || !this.players.has(p.id)) return;
    this.players.delete(p.id);
    this.broadcast({ t: 'leave', id: p.id, roster: this.roster() });
    this.log(`[${this.name}] ${p.name} left (${this.players.size} in the duel)`);
  }
  died(p, m) {
    p.deaths++;
    const k = this.players.get(m.killer | 0);
    const killer = k && k !== p ? k : null;
    if (killer && !this.matchOver) killer.kills++;
    this.broadcast({ t: 'kill', victim: p.id, killer: killer ? killer.id : 0, cause: String(m.cause || '').slice(0, 40), roster: this.roster() });
    if (killer && !this.matchOver && killer.kills >= KILLS_TO_WIN) {
      this.matchOver = true;
      this.broadcast({ t: 'over', winner: killer.id, roster: this.roster() });
      this.log(`[${this.name}] ${killer.name} wins the duel`);
      setTimeout(() => this.newMatch(), 8000);
    }
  }
  newMatch() {
    this.matchOver = false; this.mapIdx++;
    for (const q of this.players.values()) { q.kills = 0; q.deaths = 0; }
    this.broadcast({ t: 'match', map: this.mapIdx, roster: this.roster() });
  }
}

export const roomName = (s) => (String(s || 'public').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)) || 'public';
