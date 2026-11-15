'use strict';
// The campaign: five acts, two chapters each. A "road" chapter ends at a gate (b.goal) after its ambushes;
// the chapter after it ends in that act's boss arena.
// Rows are 0 (top) .. 17 (bottom); default ground top row is 14.
// ground(len, top) / pit(len) advance the cursor; dx offsets are relative to the latest segment start.
const ACTS = ['Ashes', 'Embers', 'The Climb', 'Foxfire', 'Blood Moon'];
const STAGES = [
  {
    name: 'The Burned Road', kanji: '焼け道', pal: 'road', theme: 'road', music: 'ruins',
    story: [
      'You were the worst student the Harukaze dojo ever had. Master Harukaze said so often, and fondly.',
      'The night the Shogun\'s men came, you were out buying noodles. You came home to embers, a broken gate, and your master\'s sword hand closed around nothing.',
      'They took the Moonless Scroll: the one technique he never taught anyone. You take the road after them, with a borrowed blade and no plan at all.',
    ],
    build(b) {
      b.ground(20).start(3).lantern(9)
        .sign(5, 'A / D to move.  SPACE to jump - press it again in mid-air to double jump.')
        .sign(14, 'Your blade follows the MOUSE. Swing it FAST to cut. Slow swings just bonk.');
      b.ground(14).enemy('samurai', 9, { hp: 3 }).lantern(3);
      b.pit(3);
      b.ground(12, 12).sign(2, 'SHIFT to dash (with a direction). You are invincible while dashing.').enemy('archer', 9);
      b.ground(5, 13);
      b.ground(16).plat(5, 10, 4).enemy('samurai', 11)
        .sign(2, 'Swing INTO an enemy blade as it attacks to PARRY. Catch it right as the swing starts for a PERFECT parry: those crack the blade.');
      b.ground(12).spikes(8, 2).enemy('samurai', 5, { hp: 3 })
        .sign(2, 'F kicks. A kick does no damage, but it shoves hard. Pits and spikes do the rest.');
      b.ground(8).sign(4, 'Big wall? Hold RIGHT-CLICK with the blade tip touching stone to plant it. W/S climb, SPACE vaults.');
      b.ground(10, 8).enemy('archer', 6);
      b.ground(8, 11);
      b.pit(5).plat(1, 12, 3);
      b.ground(16).enemy('samurai', 9).enemy('samurai', 13)
        .sign(2, 'Hold LEFT-CLICK to sheathe and charge an iai draw-cut. Release to dash through them. Costly, slow, lethal.');
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(2, 'Shrines restore your health. Dying anywhere restarts the WHOLE chapter.');
      b.ground(8).sign(3, 'Kills and perfect parries fill BLOODLUST. When it is full, Q starts a FRENZY: you hit harder, and so does everything that hits you.');
      b.ambush(26, [
        [['samurai', 10, { hp: 3 }], ['samurai', 20, { hp: 3 }]],
        [['archer', 22], ['samurai', 12], ['samurai', 18, { hp: 3 }]],
      ]);
      b.ground(16).lantern(3).lantern(13).goal(10);
    },
  },
  {
    name: 'Moonlit Ruins', kanji: '月の遺跡', pal: 'ruins', theme: 'ruins', boss: 'ronin',
    story: [
      'The trail runs through the drowned temple where you both trained as children.',
      'Someone opened the dojo gate from the inside that night. Only one other student knew where the scroll was kept.',
      'Kaito always was better than you. He is waiting where the moon comes through the roof, and he is not sorry.',
    ],
    line: 'You were supposed to stay out for noodles.',
    build(b) {
      b.ground(18).start(3).lantern(8).sign(12, 'Watch for the glint. Every strike shows one just before it lands.');
      b.ground(14).enemy('samurai', 9).lantern(2);
      b.pit(3);
      b.ground(12, 12).enemy('archer', 9).enemy('samurai', 5);
      b.ground(4, 13);
      b.ground(16).plat(4, 10, 4).enemy('archer', 5).enemy('samurai', 9).enemy('spear', 13);
      b.ground(8).lantern(2).sign(4, 'After a parry your next hit is a RIPOSTE: a guaranteed critical.');
      b.ground(10, 8).enemy('archer', 6);
      b.ground(8, 11).enemy('samurai', 4);
      b.pit(5).plat(1, 12, 3);
      b.ground(18).spikes(3, 3).plat(8, 10, 3).enemy('archer', 9).enemy('samurai', 12).enemy('samurai', 15);
      b.pit(4).plat(1, 11, 2);
      b.ground(12).enemy('samurai', 6, { hp: 6, combo: 2 }).enemy('archer', 10);
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'When he glows BLUE, do not swing at him. Kick him instead.');
      b.arena(32, 'ronin');
    },
  },
  {
    name: 'Cinder Foothills', kanji: '灰の麓', pal: 'foothills', theme: 'foothills', music: 'ember',
    story: [
      'Kaito talked, at the end. The scroll went north, to the castle, and the Shogun did not pay for it in gold.',
      'Kurogane has struck a bargain with three yokai. An oni holds the pass, a tengu the peaks, a fox the shrine. While they live, no blade can open his armour.',
      'So: three monsters, then one tyrant. The foothills are crawling with his spearmen. You have had worse weeks. Probably.',
    ],
    build(b) {
      b.ground(16).start(3).lantern(8).sign(10, 'Spearmen out-reach you. Parry the thrust, or slip past the point and punish the long recovery.');
      b.ground(12).enemy('spear', 7);
      b.ground(8, 12).enemy('archer', 5);
      b.pit(4).plat(1, 11, 2);
      b.ground(16).spikes(5, 2).enemy('spear', 10).enemy('samurai', 13);
      b.ground(6, 11);
      b.ground(6, 8).enemy('archer', 3, { volley: 2 });
      b.pit(6).plat(1, 9, 2).plat(4, 11, 2);
      b.ground(14, 12).enemy('heavy', 6).enemy('spear', 11);
      b.ground(10).shrine(5).lantern(2).lantern(8);
      b.ambush(24, [
        [['spear', 9], ['spear', 19]],
        [['samurai', 8], ['samurai', 15], ['archer', 21]],
        [['heavy', 16]],
      ]);
      b.ground(12).spikes(3, 4).plat(2, 11, 6);
      b.pit(5).plat(1, 12, 3);
      b.ground(16).enemy('spear', 5).enemy('archer', 9, { volley: 2 }).enemy('spear', 13);
      b.ground(8, 11).enemy('samurai', 4, { hp: 5, combo: 2 });
      b.ground(16).lantern(3).lantern(13).goal(10);
    },
  },
  {
    name: 'Ember Pass', kanji: '炎の峠', pal: 'ember', theme: 'ember', boss: 'oni',
    story: [
      'The pass burns all year. The villagers leave rice wine at the foot of it and do not look up.',
      'Gōki was a guardian once, they say, before the Shogun fed him a temple bell and a hundred soldiers.',
      'He is very large. You are holding a sword. One of these facts will have to give.',
    ],
    line: 'LITTLE. CRUNCHY.',
    build(b) {
      b.ground(14).start(3).lantern(10);
      b.ground(10, 12).enemy('samurai', 6);
      b.pit(4).plat(1, 11, 2);
      b.ground(14).enemy('archer', 3).spikes(6, 2).enemy('heavy', 11);
      b.ground(6, 10).enemy('archer', 3);
      b.pit(6).plat(1, 9, 2).plat(4, 11, 1);
      b.ground(16).enemy('spear', 4).enemy('samurai', 8).enemy('archer', 13, { volley: 3 });
      b.ground(4, 9);
      b.ground(12, 12).spikes(2, 4).plat(2, 9, 4).enemy('heavy', 9);
      b.pit(3);
      b.ground(14).enemy('archer', 3, { volley: 3 }).enemy('spear', 7).enemy('samurai', 10).lantern(12);
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'The Oni\'s club cannot be parried. Jump the shockwaves. A FAST swing can bat boulders back.');
      b.arena(32, 'oni');
    },
  },
  {
    name: 'The Thousand Steps', kanji: '千段', pal: 'steps', theme: 'steps', music: 'peaks',
    story: [
      'One seal broken. Somewhere far off, a suit of iron armour creaks, and a man who does not sleep opens his eyes.',
      'The pilgrim stair climbs into the snow: a thousand steps, by tradition. You count four hundred and lose interest.',
      'The Shogun has stopped sending soldiers. Now he sends the quiet ones.',
    ],
    build(b) {
      b.ground(14).start(3).lantern(7).sign(9, 'Shinobi are fast and fragile. They flip away after striking and throw shuriken: swat those back with a fast swing.');
      b.ground(4, 13);
      b.ground(4, 12).enemy('ninja', 2);
      b.ground(4, 11);
      b.ground(8, 10).enemy('archer', 5);
      b.ground(4, 9);
      b.ground(4, 8);
      b.ground(12, 7).enemy('ninja', 5).enemy('samurai', 9);
      b.pit(5).plat(1, 8, 3);
      b.ground(12, 7).enemy('spear', 5).enemy('archer', 9, { volley: 2 });
      b.ground(3, 9);
      b.ground(3, 11);
      b.ground(10, 12).shrine(5).lantern(2).lantern(8);
      b.ambush(24, [
        [['ninja', 9], ['ninja', 19]],
        [['spear', 8], ['ninja', 17], ['archer', 21]],
        [['ninja', 7], ['ninja', 13], ['ninja', 20]],
      ], { top: 12, plats: [[5, 8, 4], [15, 8, 4]] });
      b.pit(4).plat(0, 11, 2).plat(2, 9, 2);
      b.ground(8, 8).enemy('archer', 5, { volley: 3 });
      b.ground(4, 10);
      b.ground(12, 12).spikes(3, 3).enemy('heavy', 8);
      b.pit(6).plat(1, 11, 2).plat(4, 10, 2);
      b.ground(14, 11).enemy('ninja', 4).enemy('spear', 8).enemy('ninja', 11);
      b.ground(4, 9);
      b.ground(4, 7);
      b.ground(16, 6).lantern(3).lantern(13).goal(10);
    },
  },
  {
    name: 'Crow Peaks', kanji: '烏の峰', pal: 'peaks', theme: 'peaks', boss: 'tengu',
    story: [
      'Above the stair there is only wind, and the thing that owns it.',
      'Karasu taught swordsmanship to heroes, once. He finds the current crop disappointing and has said so, loudly, from the sky.',
      'Keep your feet. Failing that, keep your blade in something solid.',
    ],
    line: 'Another one who cannot even stand up straight.',
    build(b) {
      b.ground(12).start(3);
      b.pit(4).plat(1, 11, 2);
      b.ground(8, 12).enemy('archer', 5);
      b.ground(6, 10);
      b.ground(6, 8).enemy('ninja', 3);
      b.pit(6).plat(0, 8, 2).plat(4, 9, 2);
      b.ground(14, 11).enemy('archer', 3, { volley: 2 }).enemy('samurai', 8).enemy('heavy', 11);
      b.ground(10).plat(2, 11, 3).plat(6, 8, 3).enemy('archer', 7);
      b.pit(5).plat(1, 12, 3);
      b.ground(16).spikes(4, 4).enemy('ninja', 10).enemy('samurai', 13).enemy('archer', 14, { volley: 3 });
      b.ground(10).shrine(5).sign(3, 'When the wind howls, plant your blade (RIGHT-CLICK) to hold your ground. Feathers fly back if you swing hard.');
      b.arena(32, 'tengu', { spikeWalls: true, plats: [[7, 10, 4], [21, 10, 4]] });
    },
  },
  {
    name: 'Lantern Woods', kanji: '灯の森', pal: 'woods', theme: 'woods', music: 'shrine',
    story: [
      'Two seals. The road drops out of the snow into bamboo, and the bamboo is full of lanterns nobody lit.',
      'You walk for an hour and pass the same stone fox three times. It is smiling a little more each time.',
      'Somebody in here is having a wonderful evening. It is not going to be you.',
    ],
    build(b) {
      b.ground(14).start(3).lantern(4).lantern(10);
      b.ground(12).plat(3, 10, 4).enemy('archer', 5).enemy('ninja', 9).lantern(11);
      b.pit(4).plat(1, 11, 2);
      b.ground(14, 12).enemy('spear', 5).enemy('spear', 9).lantern(12);
      b.ground(5, 10);
      b.pit(8).plat(0, 9, 2).plat(3, 7, 2).plat(6, 9, 2);
      b.ground(14, 10).enemy('heavy', 5).enemy('ninja', 10).lantern(2);
      b.ground(4, 12);
      b.ground(12).spikes(4, 4).plat(3, 11, 6).enemy('archer', 10, { volley: 3 });
      b.ground(10).shrine(5).lantern(2).lantern(8);
      b.ambush(26, [
        [['ninja', 9], ['ninja', 22], ['archer', 19]],
        [['heavy', 11], ['spear', 20]],
        [['samurai', 8, { hp: 5, combo: 2 }], ['samurai', 20, { hp: 5, combo: 2 }], ['ninja', 14]],
      ], { plats: [[10, 10, 6]] });
      b.ground(8, 12).lantern(4);
      b.pit(5).plat(1, 11, 3);
      b.ground(16).enemy('spear', 4).enemy('ninja', 8).enemy('archer', 12, { volley: 2 }).enemy('heavy', 14).lantern(1);
      b.ground(6, 11);
      b.ground(16).lantern(3).lantern(13).goal(10);
    },
  },
  {
    name: 'Fox Shrine', kanji: '狐の社', pal: 'shrine', theme: 'shrine', boss: 'kitsune',
    story: [
      'The shrine is beautiful. Everything in it is a lie, including, possibly, the floor.',
      'Kuzunoha has nine tails and a thousand years of practice at being somewhere else when the sword arrives.',
      'She does not serve the Shogun. She simply thinks this is funny.',
    ],
    line: 'Oh good, a new toy~',
    build(b) {
      b.ground(14).start(3).lantern(6).lantern(11);
      b.ground(12).enemy('samurai', 5).enemy('archer', 10);
      b.pit(3);
      b.ground(10, 11).enemy('heavy', 6);
      b.pit(4).plat(1, 10, 2);
      b.ground(16, 12).plat(5, 8, 4).enemy('archer', 6, { volley: 3 }).enemy('ninja', 10).enemy('samurai', 13);
      b.ground(8, 14).spikes(2, 4);
      b.ground(14).enemy('heavy', 5).enemy('spear', 10).enemy('archer', 13, { volley: 2 });
      b.pit(5).plat(1, 11, 3);
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'Only the real fox casts a shadow.');
      b.arena(32, 'kitsune');
    },
  },
  {
    name: 'The Outer Wall', kanji: '外郭', pal: 'wall', theme: 'wall', music: 'castle',
    story: [
      'Three seals broken. In the castle, rivets are working loose from a suit of armour that was never meant to come off.',
      'It rains the night you reach the wall. Every soldier the Shogun has left is standing on it.',
      'Master Harukaze used to say a sword is just a question you ask with your whole body. Time to be very, very inquisitive.',
    ],
    build(b) {
      b.ground(14).start(3).lantern(8);
      b.ground(10, 12).enemy('spear', 4).enemy('spear', 7);
      b.ground(4, 10).enemy('archer', 2, { volley: 3 });
      b.pit(5).plat(1, 11, 3);
      b.ground(14).spikes(3, 2).enemy('heavy', 8).enemy('ninja', 12);
      b.ground(4, 11);
      b.ground(4, 8);
      b.ground(12, 5).enemy('archer', 4, { volley: 2 }).enemy('archer', 9, { volley: 3 });
      b.pit(7).plat(1, 6, 2).plat(4, 8, 2);
      b.ground(12, 9).enemy('heavy', 4).enemy('spear', 9);
      b.ground(4, 12);
      b.ground(10).shrine(5).lantern(2).lantern(8);
      b.ambush(28, [
        [['spear', 9], ['spear', 20], ['archer', 24]],
        [['ninja', 7], ['ninja', 14], ['ninja', 22]],
        [['heavy', 10], ['heavy', 20]],
        [['samurai', 9, { hp: 6, combo: 2 }], ['spear', 18], ['archer', 24, { volley: 3 }]],
      ], { plats: [[6, 10, 4], [18, 10, 4]] });
      b.ground(10).spikes(4, 3);
      b.pit(5).plat(1, 12, 3);
      b.ground(16).enemy('ninja', 4).enemy('heavy', 8).enemy('spear', 12).enemy('archer', 14, { volley: 3 });
      b.ground(16).lantern(3).lantern(13).goal(10);
    },
  },
  {
    name: 'Blood Moon Castle', kanji: '血月城', pal: 'castle', theme: 'castle', boss: 'shogun',
    story: [
      'The moon has gone the colour of the inside of a wound. The keep doors are open. He wants you to come in.',
      'Kurogane read the Moonless Scroll weeks ago. It was one line long. It has been driving him mad ever since.',
      'You never learned the technique either. But you were there for every lesson that led up to it.',
    ],
    line: 'The scroll said: "There is no secret." Tell me what it MEANS.',
    build(b) {
      b.ground(14).start(3).lantern(8);
      b.ground(12, 12).enemy('heavy', 6).enemy('archer', 10, { volley: 3 });
      b.pit(4).plat(1, 10, 2);
      b.ground(14).spikes(2, 3).enemy('samurai', 7).enemy('spear', 9).enemy('samurai', 11);
      b.ground(6, 9).enemy('archer', 3, { volley: 3 });
      b.ground(12, 12).plat(3, 9, 3).enemy('archer', 4, { volley: 2 }).enemy('heavy', 8);
      b.pit(6).plat(1, 11, 2).plat(4, 9, 1);
      b.ground(16).spikes(6, 2).enemy('heavy', 3).enemy('ninja', 9).enemy('heavy', 11).enemy('archer', 13, { volley: 3 });
      b.ground(10).shrine(5).lantern(2).lantern(8).sign(3, 'The Shogun waits. Everything you have learned, all at once.');
      b.arena(32, 'shogun');
    },
  },
];
const ENDING = [
  'The armour falls open like a dropped lantern. There is not much of a man left inside it.',
  'You find the scroll on the floor. One line, in your master\'s terrible handwriting: "There is no secret. Go and buy the noodles."',
  'You laugh until the roof beams ring. Then you sheathe a sword that is no longer borrowed, and walk home to build a dojo.',
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
  ambush: ['They brought friends. You brought a sword. Uneven.', 'Surrounded, outnumbered, and now horizontal.', 'The gate opens again when they are ALL dead. Not you. Them.'],
  stage: ['You died in the warm-up.', 'The bosses are further ahead. Just saying.', 'An archer is writing a poem about you.', 'Your ancestors are watching. They are wincing.'],
};
