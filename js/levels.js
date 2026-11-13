'use strict';
// Stage layouts. Rows are 0 (top) .. 17 (bottom); default ground top row is 14.
// ground(len, top) / pit(len) advance the cursor; dx offsets are relative to the latest segment start.
const STAGES = [
  {
    name: 'Moonlit Ruins', kanji: '月の遺跡', pal: 'ruins', theme: 'ruins', boss: 'ronin',
    build(b) {
      b.ground(18).start(3).lantern(8)
        .sign(5, 'A / D to move.  SPACE to jump - press it again in mid-air to double jump.')
        .sign(13, 'Your blade follows the MOUSE. Swing it FAST to cut. Slow swings just bonk.');
      b.ground(14).enemy('samurai', 9).lantern(2);
      b.pit(3);
      b.ground(12, 12).sign(2, 'SHIFT to dash (with a direction). You are invincible while dashing.').enemy('archer', 9);
      b.ground(4, 13);
      b.ground(16).plat(4, 10, 4).enemy('archer', 5).enemy('samurai', 9).enemy('samurai', 13);
      b.ground(8).lantern(2)
        .sign(1, 'Hit an enemy blade WHILE swinging to PARRY. Swat arrows with a fast swing to send them back.')
        .sign(6, 'Big wall? Hold RIGHT-CLICK with your blade touching stone to plant it. W/S climb, SPACE vaults.');
      b.ground(10, 8).enemy('archer', 6);
      b.ground(8, 11).enemy('samurai', 4);
      b.pit(5).plat(1, 12, 3);
      b.ground(18).spikes(3, 3).plat(8, 10, 3).enemy('archer', 9).enemy('samurai', 12).enemy('samurai', 15);
      b.pit(4).plat(1, 11, 2);
      b.ground(12).enemy('samurai', 6, { hp: 6, combo: 2 }).enemy('archer', 10);
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'Shrines restore your health. Dying anywhere restarts the WHOLE stage. Good luck.');
      b.arena(32, 'ronin');
    },
  },
  {
    name: 'Ember Pass', kanji: '炎の峠', pal: 'ember', theme: 'ember', boss: 'oni',
    build(b) {
      b.ground(14).start(3).lantern(10);
      b.ground(10, 12).enemy('samurai', 6);
      b.pit(4).plat(1, 11, 2);
      b.ground(14).enemy('archer', 3).spikes(6, 2).enemy('heavy', 11);
      b.ground(6, 10).enemy('archer', 3);
      b.pit(6).plat(1, 9, 2).plat(4, 11, 1);
      b.ground(16).enemy('samurai', 4).enemy('samurai', 8).enemy('archer', 13, { volley: 3 });
      b.ground(4, 9);
      b.ground(12, 12).spikes(2, 4).plat(2, 9, 4).enemy('heavy', 9);
      b.pit(3);
      b.ground(14).enemy('archer', 3, { volley: 3 }).enemy('samurai', 7).enemy('samurai', 10).lantern(12);
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'The Oni\'s club cannot be parried. Jump the shockwaves. A FAST swing can bat boulders back.');
      b.arena(32, 'oni');
    },
  },
  {
    name: 'Crow Peaks', kanji: '烏の峰', pal: 'peaks', theme: 'peaks', boss: 'tengu',
    build(b) {
      b.ground(12).start(3);
      b.pit(4).plat(1, 11, 2);
      b.ground(8, 12).enemy('archer', 5);
      b.ground(6, 10);
      b.ground(6, 8).enemy('samurai', 3);
      b.pit(6).plat(0, 8, 2).plat(4, 9, 2);
      b.ground(14, 11).enemy('archer', 3, { volley: 2 }).enemy('samurai', 8).enemy('heavy', 11);
      b.ground(10).plat(2, 11, 3).plat(6, 8, 3).enemy('archer', 7);
      b.pit(5).plat(1, 12, 3);
      b.ground(16).spikes(4, 4).enemy('samurai', 10).enemy('samurai', 13).enemy('archer', 14, { volley: 3 });
      b.ground(10).shrine(5).sign(3, 'When the wind howls, plant your blade (RIGHT-CLICK) to hold your ground. Feathers fly back if you swing hard.');
      b.arena(32, 'tengu', { spikeWalls: true, plats: [[7, 10, 4], [21, 10, 4]] });
    },
  },
  {
    name: 'Fox Shrine', kanji: '狐の社', pal: 'shrine', theme: 'shrine', boss: 'kitsune',
    build(b) {
      b.ground(14).start(3).lantern(6).lantern(11);
      b.ground(12).enemy('samurai', 5).enemy('archer', 10);
      b.pit(3);
      b.ground(10, 11).enemy('heavy', 6);
      b.pit(4).plat(1, 10, 2);
      b.ground(16, 12).plat(5, 8, 4).enemy('archer', 6, { volley: 3 }).enemy('samurai', 10).enemy('samurai', 13);
      b.ground(8, 14).spikes(2, 4);
      b.ground(14).enemy('heavy', 5).enemy('heavy', 10).enemy('archer', 13, { volley: 2 });
      b.pit(5).plat(1, 11, 3);
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'Only the real fox casts a shadow.');
      b.arena(32, 'kitsune');
    },
  },
  {
    name: 'Blood Moon Castle', kanji: '血月城', pal: 'castle', theme: 'castle', boss: 'shogun',
    build(b) {
      b.ground(14).start(3).lantern(8);
      b.ground(12, 12).enemy('heavy', 6).enemy('archer', 10, { volley: 3 });
      b.pit(4).plat(1, 10, 2);
      b.ground(14).spikes(2, 3).enemy('samurai', 7).enemy('samurai', 9).enemy('samurai', 11);
      b.ground(6, 9).enemy('archer', 3, { volley: 3 });
      b.ground(12, 12).plat(3, 9, 3).enemy('archer', 4, { volley: 2 }).enemy('heavy', 8);
      b.pit(6).plat(1, 11, 2).plat(4, 9, 1);
      b.ground(16).spikes(6, 2).enemy('heavy', 3).enemy('heavy', 10).enemy('archer', 13, { volley: 3 });
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'The Shogun waits. Everything you have learned, all at once.');
      b.arena(32, 'shogun');
    },
  },
];

// LAN duel arenas. Walls on both ends; pits are instant death (and count as a kill for whoever hit you last).
const PVP_MAPS = [
  {
    name: 'Moonlit Courtyard', kanji: '月庭', pal: 'ruins', theme: 'ruins',
    build(b) {
      b.wall();
      b.ground(10).spawn(3).spawn(7).lantern(5);
      b.ground(4, 11).spawn(2);
      b.ground(8).plat(1, 10, 3).plat(4, 7, 3);
      b.pit(4).plat(0, 11, 4);
      b.ground(8).plat(3, 10, 3).spawn(5);
      b.ground(4, 11).spawn(2);
      b.ground(10).spawn(3).spawn(7).lantern(5);
      b.wall();
    },
  },
  {
    name: 'Ember Bridge', kanji: '炎橋', pal: 'ember', theme: 'ember',
    build(b) {
      b.wall();
      b.ground(9, 10).spawn(3).spawn(6).lantern(1);
      b.pit(16).plat(0, 10, 16).plat(5, 6, 6).spawn(8);
      b.ground(9, 10).spawn(3).spawn(6).lantern(7);
      b.wall();
    },
  },
  {
    name: 'Crow Summit', kanji: '烏頂', pal: 'peaks', theme: 'peaks',
    build(b) {
      b.wall();
      b.ground(8, 12).spawn(3);
      b.pit(7).plat(1, 10, 3).plat(4, 6, 2);
      b.ground(6, 9).spawn(3).plat(1, 5, 4);
      b.pit(7).plat(3, 10, 3).plat(1, 6, 2);
      b.ground(8, 12).spawn(4);
      b.wall();
    },
  },
  {
    name: 'Fox Shrine Grounds', kanji: '狐境', pal: 'shrine', theme: 'shrine',
    build(b) {
      b.wall();
      b.ground(12).spawn(3).spawn(9).lantern(6);
      b.ground(3, 12);
      b.ground(8, 10).plat(2, 6, 4).spawn(4);
      b.ground(3, 12);
      b.ground(5).spikes(1, 3);
      b.ground(12).spawn(3).spawn(9).lantern(6);
      b.wall();
    },
  },
  {
    name: 'Castle Rooftops', kanji: '城屋', pal: 'castle', theme: 'castle',
    build(b) {
      b.wall();
      b.ground(8, 12).spawn(3);
      b.ground(6, 10).spawn(3);
      b.pit(3).plat(0, 9, 3);
      b.ground(8, 8).spawn(4).lantern(2);
      b.pit(3).plat(0, 9, 3);
      b.ground(6, 10).spawn(3);
      b.ground(8, 12).spawn(4);
      b.wall();
    },
  },
];

const TAUNTS = {
  ronin: ['The Ronin barely broke a sweat.', 'Kaito sheathes his blade. Slowly. Smugly.', 'Watch for the glint. Or don\'t. He enjoys this.', 'Blue means do NOT hit him. You hit him.'],
  oni: ['The Oni would like a rematch. Mostly to laugh at you.', 'You were tenderized.', 'Pro tip: shockwaves are not trampolines.', 'Gōki is using you as a club now.'],
  tengu: ['Blown away. Literally.', 'The Tengu caws in a mocking tone.', 'Right-click. Plant. Hold. Live.', 'Gravity remains undefeated.'],
  kitsune: ['You hit the wrong fox. Probably several times.', 'Kuzunoha giggles from three places at once.', 'Shadows. Look for the shadow.', 'Foxfire: warm, cozy, fatal.'],
  shogun: ['The Shogun did not even remove his helmet.', 'Kneel, it said. You did. Permanently.', 'So close. Or so far. Hard to tell from the floor.', 'The archers send their regards.'],
  stage: ['You died in the warm-up.', 'The bosses are further ahead. Just saying.', 'An archer is writing a poem about you.', 'Your ancestors are watching. They are wincing.'],
};
