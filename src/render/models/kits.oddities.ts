/**
 * Tier 4-6 kits: oddities and apex predators — the top of the chain.
 *
 * These get more primitive budget than the bugs (up to 30, dragon up to 36)
 * because there are far fewer of them on screen at once. Comic proportions
 * still apply — an apex predator with googly eyes is exactly the joke.
 */
import * as THREE from 'three';
import { blob, chunk, cone, fin, googlyEyes, pivotLeg, stick, type Kit, type KitParts } from './kit';

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// --------------------------------------------------------------- blob

const blobKit: Kit = {
  id: 'blob',
  description: 'Wobbling gelatinous mass with things suspended inside it. Maximum squash-and-stretch.',
  props: {
    lumps: 'number of suspended chunks inside the goo (default 4)',
    swallowed: 'boolean — show a half-digested pair of legs poking out the top (default true)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const main = ctx.color(0, '#8fe0a6');
    const dark = ctx.color(1, '#4a9a68');
    const lumpColor = ctx.color(2, '#2f6b45');
    const victimColor = ctx.color(3, '#f2d34d');
    const root = new THREE.Group();

    // Three overlapping blobs instead of one sphere — a single sphere reads as
    // a ball, three lopsided ones reads as ooze, and the whole cluster is the
    // `body` so squash-and-stretch deforms all of it together.
    const core = blob(r * 1.15, main, { x: 1.2, y: 0.85, z: 1.2 });
    const coreHalfH = r * 1.15 * 0.85;
    core.position.y = coreHalfH;
    root.add(core);

    const bulgeA = blob(r * 0.58, main, { x: 1, y: 0.9, z: 1 });
    bulgeA.position.set(r * 0.78, r * 0.5, r * 0.2);
    root.add(bulgeA);

    const bulgeB = blob(r * 0.48, dark, { x: 1, y: 0.85, z: 1 });
    bulgeB.position.set(-r * 0.68, r * 0.4, -r * 0.35);
    root.add(bulgeB);

    // Suspended lumps: scattered inside the silhouette using the seeded rng so
    // every instance of this species wobbles the same way (deterministic) but
    // no two species look identical. Attached to `root`, not `core`, so they
    // keep their own proportions instead of inheriting the goo's squash.
    const lumpCount = clamp(Math.round(ctx.num('lumps', 4)), 2, 6);
    for (let i = 0; i < lumpCount; i++) {
      const angle = ctx.rng.float(0, Math.PI * 2);
      const scatter = ctx.rng.float(0.2, 0.7) * r;
      const size = r * ctx.rng.float(0.12, 0.22);
      const lump = chunk(size * 1.3, size, size * 1.1, lumpColor);
      lump.position.set(
        Math.cos(angle) * scatter,
        ctx.rng.float(0.4, 1.5) * r,
        Math.sin(angle) * scatter * 0.7,
      );
      lump.rotation.set(ctx.rng.float(0, Math.PI), ctx.rng.float(0, Math.PI), ctx.rng.float(0, Math.PI));
      root.add(lump);
    }

    // Eyes peer out from inside the mass rather than sitting on a head — this
    // thing doesn't have one. Attached directly to root (not the squashed
    // core) so the eyeballs themselves stay round.
    const eyes = googlyEyes(r * 0.22, r * 0.3, r * 1.0, coreHalfH * 1.05);
    root.add(eyes);

    // The gag: it swallowed something, and the something is still kicking.
    const accents: THREE.Object3D[] = [];
    if (ctx.bool('swallowed', true)) {
      const topY = coreHalfH * 2 * 0.82; // just under the crown of the goo
      for (const side of [-1, 1]) {
        const victim = new THREE.Group();
        victim.position.set(side * r * 0.22, topY, r * 0.05);
        victim.rotation.z = side * 0.3;
        const leg = stick(r * 0.045, r * 0.5, victimColor);
        leg.position.y = r * 0.25;
        victim.add(leg);
        const foot = chunk(r * 0.16, r * 0.08, r * 0.22, victimColor);
        foot.position.y = r * 0.52;
        victim.add(foot);
        root.add(victim);
        accents.push(victim);
      }
    }

    // A couple of free-floating bubbles for extra wobble variety.
    for (const [x, y, z] of [
      [r * 0.15, r * 1.55, r * 0.65],
      [-r * 0.35, r * 1.3, r * 0.55],
    ] as const) {
      const bubble = blob(r * 0.14, dark, { x: 1, y: 1, z: 1 });
      bubble.position.set(x, y, z);
      root.add(bubble);
      accents.push(bubble);
    }

    return { body: root, eyes, accents };
  },
};

// -------------------------------------------------------------- jelly

const jellyKit: Kit = {
  id: 'jelly',
  description: 'Translucent-looking bell with trailing tentacles. Floats above the ground.',
  props: {
    tentacles: 'number of trailing tentacles (default 6)',
    bellSize: 'bell size multiplier (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const main = ctx.color(0, '#bfe8ff');
    const rim = ctx.color(1, '#7fc7e8');
    const organ = ctx.color(2, '#ffd166');
    const tentColor = ctx.color(3, '#e888c9');
    const bellSize = ctx.num('bellSize', 1);
    const root = new THREE.Group();
    const hover = r * 1.5; // clears every walking creature's head height

    const bell = blob(r * 1.05 * bellSize, main, { x: 1.15, y: 0.75, z: 1.15 });
    bell.position.y = hover;
    root.add(bell);

    // A flat frill under the dome reads as the membrane skirt without needing
    // transparency (which this material stack doesn't support).
    const skirt = blob(r * 0.95 * bellSize, rim, { x: 1.05, y: 0.28, z: 1.05 });
    skirt.position.y = hover - r * 0.5 * bellSize;
    root.add(skirt);

    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const dot = blob(r * 0.16 * bellSize, organ, { x: 1, y: 0.5, z: 1 });
      dot.position.set(side * r * 0.28 * bellSize, hover + r * 0.15 * bellSize, r * 0.1);
      root.add(dot);
      accents.push(dot);
    }

    const eyes = googlyEyes(r * 0.2, r * 0.3, r * 0.95 * bellSize, hover);
    root.add(eyes);

    // Tentacles are cards, not sticks — a flat ribbon reads as translucent
    // drifting tissue far better than a solid cylinder does. Returned as
    // accents so the shared animator gives them free lag/swing: that drift
    // *is* the whole point of this creature.
    const tentacleCount = clamp(Math.round(ctx.num('tentacles', 6)), 3, 10);
    const skirtY = hover - r * 0.5 * bellSize;
    for (let i = 0; i < tentacleCount; i++) {
      const t = i / tentacleCount;
      const angle = t * Math.PI * 2;
      const radius = r * 0.75 * bellSize;
      const len = r * (0.55 + ctx.rng.float(-0.1, 0.15)) * bellSize;
      const tentacle = fin(r * 0.08, len, tentColor);
      tentacle.position.set(Math.cos(angle) * radius, skirtY - len / 2, Math.sin(angle) * radius);
      tentacle.rotation.y = -angle;
      root.add(tentacle);
      accents.push(tentacle);
    }

    return { body: root, eyes, accents };
  },
};

// -------------------------------------------------------------- squid

const squidKit: Kit = {
  id: 'squid',
  description: 'Mantle, fins, big intelligent eyes, eight arms and two long hunting tentacles. Floats.',
  props: {
    arms: 'number of arms (default 8)',
    mantle: 'mantle size multiplier (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const main = ctx.color(0, '#c76bd1');
    const dark = ctx.color(1, '#8a3fa0');
    const armColor = ctx.color(2, '#a94fc0');
    const mantleSize = ctx.num('mantle', 1);
    const root = new THREE.Group();
    const hover = r * 1.7;

    // Torpedo-shaped mantle, long in Z, leading with the head at +Z.
    const mantle = blob(r * 0.95 * mantleSize, main, { x: 0.75, y: 0.95, z: 1.7 });
    mantle.position.y = hover;
    root.add(mantle);

    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const finMesh = fin(r * 0.55 * mantleSize, r * 0.9 * mantleSize, dark);
      finMesh.position.set(side * r * 0.5 * mantleSize, hover, -r * 0.4 * mantleSize);
      finMesh.rotation.y = side * 0.55;
      finMesh.rotation.z = side * 0.35;
      root.add(finMesh);
      accents.push(finMesh);
    }

    const head = new THREE.Group();
    head.position.set(0, hover, r * 1.35 * mantleSize);
    head.name = 'head';
    const headMesh = blob(r * 0.55 * mantleSize, main, { x: 0.95, y: 0.9, z: 0.85 });
    head.add(headMesh);
    root.add(head);

    // The signature feature: eyes big enough to look unnervingly smart on a
    // creature this size — the one exaggeration budget for this kit.
    const eyes = googlyEyes(r * 0.4 * mantleSize, r * 0.5 * mantleSize, r * 0.35 * mantleSize, 0);
    head.add(eyes);

    const armsCount = clamp(Math.round(ctx.num('arms', 8)), 6, 10);
    const headBottom = hover - r * 0.5 * mantleSize;
    for (let i = 0; i < armsCount; i++) {
      const t = i / armsCount;
      const angle = t * Math.PI * 2;
      const spread = r * 0.35 * mantleSize;
      const len = r * 0.95 * mantleSize;
      const arm = stick(r * 0.05 * mantleSize, len, armColor);
      arm.position.set(Math.cos(angle) * spread, headBottom - len / 2, r * 1.2 * mantleSize + Math.sin(angle) * spread);
      arm.rotation.x = 0.15;
      arm.rotation.z = Math.cos(angle) * 0.15;
      root.add(arm);
      accents.push(arm);
    }

    // Two long hunting tentacles reach further than the arms — kept short of
    // the ground so the "floats" contract still holds at default radius.
    for (const side of [-1, 1]) {
      const len = r * 1.15 * mantleSize;
      const tentacle = stick(r * 0.04 * mantleSize, len, armColor);
      tentacle.position.set(side * r * 0.5 * mantleSize, headBottom - len / 2, r * 1.3 * mantleSize);
      tentacle.rotation.z = side * 0.2;
      root.add(tentacle);
      accents.push(tentacle);
    }

    return { body: root, head, eyes, accents };
  },
};

// -------------------------------------------------------------- golem

const golemKit: Kit = {
  id: 'golem',
  description: 'Animated rocks held together by nothing visible, with a gap between the floating pieces.',
  props: {
    chunks: 'number of loose rubble chunks stuck to the body (default 4)',
    glow: 'boolean — magic motes glowing in the gap that holds it together (default true)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const rockA = ctx.color(0, '#8a8a8a');
    const rockB = ctx.color(1, '#6b6b6b');
    const crackColor = ctx.color(2, '#2b2b2b');
    const glowColor = ctx.color(3, '#7fe8ff');
    const root = new THREE.Group();

    // Short, thick stump legs — this thing is heavy and slow, not spry.
    const legs: THREE.Object3D[] = [];
    const hipY = r * 0.85;
    const legLen = r * 0.55;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * r * 0.5, hipY, 0);
      const thigh = chunk(r * 0.42, legLen, r * 0.42, rockB);
      thigh.position.y = -legLen / 2;
      pivot.add(thigh);
      const foot = chunk(r * 0.55, r * 0.22, r * 0.65, rockA);
      foot.position.y = -legLen - r * 0.11;
      pivot.add(foot);
      pivot.name = 'leg';
      root.add(pivot);
      legs.push(pivot);
    }

    // Lower torso sits directly on the legs...
    const lowerTorso = chunk(r * 1.1, r * 0.7, r * 0.95, rockA);
    lowerTorso.position.y = hipY + r * 0.55;
    root.add(lowerTorso);

    // ...then a deliberate GAP with nothing in it...
    const gapCenter = lowerTorso.position.y + r * 0.35 + r * 0.35;

    // ...before the upper chest resumes, floating. That empty band is the
    // whole joke: whatever holds this creature together is not a mesh.
    const chest = chunk(r * 1.2, r * 0.85, r * 1.0, rockB);
    chest.position.y = gapCenter + r * 0.42;
    root.add(chest);
    const head = blob(r * 0.4, rockA, { x: 1, y: 0.9, z: 0.95 });
    head.position.set(0, chest.position.y + r * 0.65, r * 0.35);
    head.name = 'head';
    root.add(head);
    const eyes = googlyEyes(r * 0.15, r * 0.22, r * 0.3, r * 0.05);
    head.add(eyes);

    // Cracks: thin dark slabs pressed onto the rock surface, static (not
    // rigged) — they are texture, not moving parts.
    for (const [target, x, y, z, rz] of [
      [chest, r * 0.3, r * 0.1, r * 0.51, 0.4],
      [lowerTorso, -r * 0.2, -r * 0.1, r * 0.48, -0.3],
    ] as const) {
      const crack = chunk(r * 0.5, r * 0.06, r * 0.06, crackColor);
      crack.position.set(x, y, z);
      crack.rotation.z = rz;
      (target as THREE.Mesh).add(crack);
    }

    // Chunky swinging arms — accents, since there is no dedicated arm slot
    // and "free swing" is exactly how a boulder fist should move.
    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * r * 0.75, chest.position.y + r * 0.2, 0);
      const upperArm = chunk(r * 0.32, r * 0.55, r * 0.32, rockB);
      upperArm.position.y = -r * 0.25;
      upperArm.rotation.z = side * 0.15;
      arm.add(upperArm);
      const fist = chunk(r * 0.4, r * 0.4, r * 0.4, rockA);
      fist.position.y = -r * 0.6;
      arm.add(fist);
      root.add(arm);
      accents.push(arm);
    }

    // Loose rubble stuck to the torso, scattered deterministically per
    // instance via the seeded rng.
    const rubbleCount = clamp(Math.round(ctx.num('chunks', 4)), 2, 8);
    for (let i = 0; i < rubbleCount; i++) {
      const onChest = ctx.rng.bool();
      const host = onChest ? chest : lowerTorso;
      const size = r * ctx.rng.float(0.12, 0.22);
      const rubble = chunk(size, size, size, ctx.rng.bool() ? rockA : rockB);
      const hw = onChest ? r * 0.6 : r * 0.55;
      const hh = onChest ? r * 0.42 : r * 0.35;
      rubble.position.set(ctx.rng.float(-hw, hw), ctx.rng.float(-hh, hh), ctx.rng.float(r * 0.4, r * 0.55));
      rubble.rotation.set(ctx.rng.float(0, Math.PI), ctx.rng.float(0, Math.PI), 0);
      host.add(rubble);
    }

    // Magic motes floating in the gap — the only hint of what's holding this
    // thing together. Turning `glow` off leaves the gap eerily empty.
    if (ctx.bool('glow', true)) {
      for (let i = 0; i < 3; i++) {
        const mote = blob(r * 0.06, glowColor, { x: 1, y: 1, z: 1 });
        const a = (i / 3) * Math.PI * 2;
        mote.position.set(Math.cos(a) * r * 0.5, gapCenter + Math.sin(a) * r * 0.15, Math.sin(a) * r * 0.3);
        root.add(mote);
        accents.push(mote);
      }
    }

    return { body: root, head, eyes, legs, accents };
  },
};

// --------------------------------------------------------------- yeti

const yetiKit: Kit = {
  id: 'yeti',
  description: 'Enormous shaggy ape-thing. Tiny head buried in fur, huge knuckle-dragging arms.',
  props: {
    shag: 'fur tuft density multiplier (default 1)',
    armLength: 'arm reach multiplier (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const fur = ctx.color(0, '#e8e8f0');
    const furDark = ctx.color(1, '#c9c9d8');
    const skin = ctx.color(2, '#8a6b5a');
    const armLen = ctx.num('armLength', 1);
    const root = new THREE.Group();

    // Short stubby legs — most of this creature's height and reach is in the
    // arms, not the legs.
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = pivotLeg({ x: side * r * 0.5, y: r * 0.85, z: -r * 0.1 }, r * 0.28, r * 0.6, furDark, skin);
      root.add(leg);
      legs.push(leg);
    }

    const torso = blob(r * 1.15, fur, { x: 1.2, y: 1.05, z: 1.05 });
    torso.position.y = r * 1.85;
    root.add(torso);

    // Tiny head, half-swallowed by the shoulders — the comic-proportion
    // counterweight that makes the arms below read as even more enormous.
    const head = blob(r * 0.38, fur, { x: 0.9, y: 0.85, z: 0.9 });
    head.position.set(0, r * 2.65, r * 0.35);
    head.name = 'head';
    root.add(head);
    const eyes = googlyEyes(r * 0.11, r * 0.16, r * 0.32, -r * 0.02);
    head.add(eyes);

    // Huge knuckle-dragging arms: shoulder, forearm, and a fist that reaches
    // the ground at rest, scaled by `armLength` so content can make some
    // instances even more grotesque.
    const accents: THREE.Object3D[] = [];
    const shoulderY = r * 1.95;
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * r * 1.05, shoulderY, r * 0.15);
      const shoulder = blob(r * 0.42, fur, { x: 1, y: 0.9, z: 1 });
      shoulder.position.y = -r * 0.1;
      arm.add(shoulder);
      const forearmLen = shoulderY * 0.8 * armLen;
      const forearm = stick(r * 0.22, forearmLen, furDark);
      forearm.position.y = -r * 0.1 - forearmLen / 2;
      arm.add(forearm);
      const fist = blob(r * 0.34, skin, { x: 1.1, y: 0.85, z: 1.1 });
      fist.position.y = -r * 0.1 - forearmLen;
      arm.add(fist);
      root.add(arm);
      accents.push(arm);
    }

    // Ear tufts get their own swing; the rest of the shag is static texture
    // stuck to the torso so the primitive budget stays sane at high `shag`.
    for (const side of [-1, 1]) {
      const ear = blob(r * 0.14, furDark, { x: 1, y: 1.3, z: 0.8 });
      ear.position.set(side * r * 0.32, r * 0.3, 0);
      head.add(ear);
      accents.push(ear);
    }

    const tuftCount = clamp(Math.round(5 * ctx.num('shag', 1)), 3, 9);
    for (let i = 0; i < tuftCount; i++) {
      const angle = ctx.rng.float(0, Math.PI * 2);
      const height = ctx.rng.float(-0.6, 0.7);
      const tuft = blob(r * ctx.rng.float(0.16, 0.26), ctx.rng.bool() ? fur : furDark, { x: 1, y: 1, z: 1 });
      tuft.position.set(Math.cos(angle) * r * 1.05, height * r, Math.sin(angle) * r * 0.9);
      torso.add(tuft);
    }

    return { body: root, head, eyes, legs, accents };
  },
};

// -------------------------------------------------------------- dragon

const dragonKit: Kit = {
  id: 'dragon',
  description: 'The apex of an apex. Long neck, horned head, folded bat wings, spiked tail, four legs.',
  props: {
    wingSpan: 'wing size multiplier (default 1)',
    horns: 'number of head horns (default 2)',
    spikes: 'number of tail spikes (default 4)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const scale = ctx.color(0, '#3a6b4a');
    const scaleAccent = ctx.color(1, '#5a9068');
    const hornColor = ctx.color(2, '#e8d9a0');
    const wingColor = ctx.color(3, '#2a4a38');
    const wingSpan = ctx.num('wingSpan', 1);
    const root = new THREE.Group();

    const legs: THREE.Object3D[] = [];
    const hipY = r * 1.0;
    for (const side of [-1, 1]) {
      for (const z of [0.75, -0.75]) {
        const leg = pivotLeg({ x: side * r * 0.7, y: hipY, z: z * r }, r * 0.17, r * 0.85, scaleAccent, scale);
        root.add(leg);
        legs.push(leg);
      }
    }

    const torso = blob(r * 1.1, scale, { x: 0.95, y: 0.9, z: 1.55 });
    torso.position.y = hipY + r * 0.75;
    root.add(torso);

    // The long neck is this creature's signature exaggeration: a short chain
    // of shrinking segments climbing forward and up, so the head reads far
    // above and ahead of the body — apex-predator posture, not a lizard's.
    const neckRoot = new THREE.Group();
    neckRoot.position.set(0, torso.position.y + r * 0.35, r * 1.1);
    root.add(neckRoot);
    const NECK_SEGMENTS = 3;
    let neckTip = neckRoot.position.clone();
    for (let i = 0; i < NECK_SEGMENTS; i++) {
      const t = i / (NECK_SEGMENTS - 1);
      const size = r * (0.55 - t * 0.15);
      const seg = blob(size, i % 2 === 0 ? scale : scaleAccent, { x: 1, y: 1, z: 1.1 });
      const pos = new THREE.Vector3(0, neckRoot.position.y + t * r * 1.3, neckRoot.position.z + t * r * 0.9);
      seg.position.copy(pos).sub(neckRoot.position);
      neckRoot.add(seg);
      if (i === NECK_SEGMENTS - 1) neckTip = pos;
    }

    const head = new THREE.Group();
    head.position.copy(neckTip);
    head.name = 'head';
    root.add(head);
    const skull = blob(r * 0.5, scale, { x: 0.85, y: 0.8, z: 1.1 });
    head.add(skull);
    const snout = cone(r * 0.22, r * 0.55, scaleAccent);
    snout.rotation.x = Math.PI / 2;
    snout.position.z = r * 0.55;
    head.add(snout);

    const hornCount = clamp(Math.round(ctx.num('horns', 2)), 2, 4);
    for (let i = 0; i < hornCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const rank = Math.floor(i / 2);
      const horn = cone(r * 0.09, r * (0.55 - rank * 0.15), hornColor);
      horn.position.set(side * r * (0.2 + rank * 0.1), r * 0.35, -r * 0.1 + rank * -r * 0.15);
      horn.rotation.x = -0.7;
      horn.rotation.z = side * -0.25;
      head.add(horn);
    }

    const eyes = googlyEyes(r * 0.13, r * 0.24, r * 0.42, r * 0.1);
    head.add(eyes);

    // Jaw is a pivot at the hinge so the attack animation opens it without
    // detaching it from the skull.
    const jaw = new THREE.Group();
    jaw.position.set(0, -r * 0.08, r * 0.35);
    const jawMesh = blob(r * 0.32, scaleAccent, { x: 0.8, y: 0.45, z: 0.9 });
    jawMesh.position.z = r * 0.1;
    jaw.add(jawMesh);
    head.add(jaw);

    // Big folded bat wings: one forearm bone plus two membrane cards each, so
    // the silhouette reads as leathery rather than feathered. Returned as
    // accents for free flap/lag, per the kit contract's own example.
    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * r * 0.55, torso.position.y + r * 0.5, -r * 0.15);
      wing.rotation.y = side * -0.3;
      wing.rotation.z = side * 0.5;
      const bone = stick(r * 0.08, r * 1.3 * wingSpan, wingColor);
      bone.position.y = -r * 0.65 * wingSpan;
      wing.add(bone);
      const membraneA = fin(r * 1.15 * wingSpan, r * 0.95 * wingSpan, wingColor);
      membraneA.position.set(side * r * 0.1, -r * 0.6 * wingSpan, 0);
      membraneA.rotation.z = side * 0.5;
      wing.add(membraneA);
      const membraneB = fin(r * 0.75 * wingSpan, r * 0.65 * wingSpan, scaleAccent);
      membraneB.position.set(side * r * 0.15, -r * 1.05 * wingSpan, -r * 0.1);
      membraneB.rotation.z = side * 0.65;
      wing.add(membraneB);
      wing.name = 'wing';
      root.add(wing);
      accents.push(wing);
    }

    // Tail: tapering segment chain with spikes down the ridge, all under one
    // pivot so the whole thing wags as a unit.
    const tail = new THREE.Group();
    tail.position.set(0, torso.position.y - r * 0.15, -r * 1.55);
    root.add(tail);
    const TAIL_SEGMENTS = 3;
    const spikeCount = clamp(Math.round(ctx.num('spikes', 4)), 2, 6);
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const t = i / (TAIL_SEGMENTS - 1);
      const size = r * (0.55 - t * 0.3);
      const seg = blob(size, i % 2 === 0 ? scale : scaleAccent, { x: 0.9, y: 0.9, z: 1.2 });
      seg.position.set(0, -t * r * 0.25, -t * r * 1.2);
      tail.add(seg);
    }
    for (let i = 0; i < spikeCount; i++) {
      const t = i / Math.max(1, spikeCount - 1);
      const spike = cone(r * 0.06, r * (0.32 - t * 0.15), hornColor);
      spike.position.set(0, r * (0.32 - t * 0.15), -t * r * 1.75);
      spike.rotation.x = -0.5;
      tail.add(spike);
    }

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

// ----------------------------------------------------------------- roc

const rocKit: Kit = {
  id: 'roc',
  description: 'Colossal bird of legend. Vast wings, hooked beak, feathered legs with enormous talons. Floats.',
  props: {
    wingSpan: 'wing size multiplier (default 1)',
    plume: 'boolean — decorative head crest feathers (default true)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const main = ctx.color(0, '#d9c27a');
    const wingColor = ctx.color(1, '#8a6b3a');
    const beakColor = ctx.color(2, '#e0942f');
    const legColor = ctx.color(3, '#4a3a2a');
    const wingSpan = ctx.num('wingSpan', 1);
    const root = new THREE.Group();
    const hover = r * 1.9;

    const body = blob(r * 1.0, main, { x: 0.9, y: 0.85, z: 1.35 });
    body.position.y = hover;
    root.add(body);

    const head = blob(r * 0.48, main, { x: 0.9, y: 0.9, z: 0.9 });
    head.position.set(0, hover + r * 0.55, r * 1.15);
    head.name = 'head';
    root.add(head);

    // Hooked beak: a cone plus a small downturned tip chunk — the "hook" is
    // sold by the tip's steeper angle, not by curved geometry we don't have.
    const beak = cone(r * 0.14, r * 0.4, beakColor);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -r * 0.02, r * 0.4);
    head.add(beak);
    const hook = chunk(r * 0.1, r * 0.09, r * 0.14, beakColor);
    hook.position.set(0, -r * 0.14, r * 0.58);
    hook.rotation.x = 0.6;
    head.add(hook);

    const eyes = googlyEyes(r * 0.17, r * 0.26, r * 0.35, r * 0.08);
    head.add(eyes);

    const accents: THREE.Object3D[] = [];
    if (ctx.bool('plume', true)) {
      for (const side of [-1, 1]) {
        const plume = fin(r * 0.1, r * 0.4, wingColor);
        plume.position.set(side * r * 0.12, r * 0.55, -r * 0.1);
        plume.rotation.set(-0.4, 0, side * 0.3);
        head.add(plume);
        accents.push(plume);
      }
    }

    // Vast wings — the exaggerated feature this kit is built around. Each is
    // a bone plus two feather-fan cards, in accents[] so they get the free
    // flap the kit contract calls out wings for explicitly.
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * r * 0.55, hover + r * 0.3, -r * 0.1);
      wing.rotation.z = side * 0.2;
      const bone = stick(r * 0.09, r * 1.6 * wingSpan, wingColor);
      bone.rotation.z = side * 0.5;
      bone.position.set(side * r * 0.5 * wingSpan, r * 0.1, 0);
      wing.add(bone);
      const primary = fin(r * 1.9 * wingSpan, r * 0.85 * wingSpan, wingColor);
      primary.position.set(side * r * 1.15 * wingSpan, -r * 0.05, r * 0.05);
      wing.add(primary);
      const secondary = fin(r * 1.1 * wingSpan, r * 0.55 * wingSpan, main);
      secondary.position.set(side * r * 0.35 * wingSpan, r * 0.15, -r * 0.15);
      wing.add(secondary);
      wing.name = 'wing';
      root.add(wing);
      accents.push(wing);
    }

    // Feathered legs with enormous talons, kept clear of the ground plane so
    // this floating creature never touches down.
    const legs: THREE.Object3D[] = [];
    const hipY = hover - r * 0.55;
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * r * 0.35, hipY, r * 0.1);
      const thigh = blob(r * 0.28, main, { x: 1, y: 1.1, z: 1 });
      thigh.position.y = -r * 0.15;
      leg.add(thigh);
      const shinLen = r * 0.55;
      const shin = stick(r * 0.11, shinLen, legColor);
      shin.position.y = -r * 0.3 - shinLen / 2;
      leg.add(shin);
      const footY = -r * 0.3 - shinLen;
      const foot = blob(r * 0.22, legColor, { x: 1.1, y: 0.6, z: 1.3 });
      foot.position.y = footY;
      leg.add(foot);
      for (const clawSide of [-1, 1]) {
        const talon = cone(r * 0.05, r * 0.3, beakColor);
        talon.rotation.x = Math.PI / 2 + 0.5;
        talon.position.set(clawSide * r * 0.1, footY - r * 0.08, r * 0.2);
        leg.add(talon);
      }
      leg.name = 'leg';
      root.add(leg);
      legs.push(leg);
    }

    // Fanned tail feathers for balance.
    const tail = new THREE.Group();
    tail.position.set(0, hover - r * 0.1, -r * 1.2);
    root.add(tail);
    for (const side of [-1, 0, 1]) {
      const feather = fin(r * 0.4, r * 0.9, side === 0 ? main : wingColor);
      feather.position.set(side * r * 0.3, 0, -side * r * 0.1);
      feather.rotation.y = side * 0.3;
      tail.add(feather);
    }

    return { body: root, head, eyes, legs, tail, accents };
  },
};

export const ODDITY_KITS: Kit[] = [blobKit, jellyKit, squidKit, golemKit, yetiKit, dragonKit, rocKit];
