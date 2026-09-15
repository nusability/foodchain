/**
 * Tier 1-2 kits: small yard critters — the first things with a face you'd
 * recognise. Bigger budget than the bugs (10-25 primitives vs. their ~15),
 * because these read at closer range and carry more of the game's charm.
 */
import * as THREE from 'three';
import { blob, chunk, cone, fin, googlyEyes, pivotLeg, stick, type Kit, type KitParts } from './kit';

// ------------------------------------------------------------- shared rigs
//
// Two joint shapes come up over and over on a four-legged critter kit: a
// tapering tail that droops off the back, and a bent "sat down" leg (thigh
// + shin) for creatures that kick off their haunches. Building them once
// keeps every kit's build() focused on proportions, not trigonometry.

/**
 * A tapering chain of stick segments hung from a rotated root. The root's
 * `rotation.x` aims the whole tail (Math.PI/2 points it straight back along
 * -Z, since a `stick` hangs along -Y by default); each segment then adds
 * `bendPerSegment` on top, so a small constant droop compounds into a curl
 * by the tip — the same trick a spring does with one repeated coil.
 */
function tailChain(
  lengths: number[],
  baseRadius: number,
  taper: number,
  baseAngle: number,
  bendPerSegment: number,
  color: string,
): THREE.Group {
  const root = new THREE.Group();
  root.rotation.x = baseAngle;
  let parent: THREE.Object3D = root;
  lengths.forEach((len, i) => {
    const seg = stick(baseRadius * Math.pow(taper, i), len, color);
    seg.position.y = -len / 2;
    parent.add(seg);
    const next = new THREE.Group();
    next.position.y = -len;
    next.rotation.x = bendPerSegment;
    seg.add(next);
    parent = next;
  });
  root.name = 'tail';
  return root;
}

/**
 * A leg bent at the knee — thigh blob + shin — for creatures that sit back
 * on their haunches (frog, bunny). The thigh is a purely cosmetic bulge
 * (kicked out to the side, doesn't need to land anywhere precise); the shin
 * hangs straight down from the knee, top-anchored exactly like `pivotLeg`,
 * so its length is *solved* from `seatY` and `thighLen` rather than handed
 * in — the foot always lands at y=0 regardless of `ctx.radius`.
 */
function haunchLeg(
  x: number,
  seatY: number,
  z: number,
  side: number,
  thighColor: string,
  shinColor: string,
  thighLen: number,
  thighR: number,
  shinR: number,
): THREE.Group {
  const hip = new THREE.Group();
  hip.position.set(x, seatY, z);

  // No rotation on the thigh: Box3.setFromObject bounds a non-uniformly
  // scaled mesh by its *local cube corners*, not the true ellipsoid, so
  // rotating a squashed blob makes it report a much lower (phantom) floor
  // than it actually has. The sideways kick reads fine from position alone.
  const thigh = blob(thighR, thighColor, { x: 0.85, y: 1.2, z: 0.85 });
  thigh.position.set(side * thighLen * 0.35, -thighLen * 0.15, -thighLen * 0.1);
  hip.add(thigh);

  const kneeDrop = thighLen * 0.55;
  const kneeAngle = side * -0.15;
  const knee = new THREE.Group();
  knee.position.set(side * thighLen * 0.4, -kneeDrop, thighLen * 0.05);
  knee.rotation.z = kneeAngle;
  const shinLen = Math.max(seatY * 0.3, (seatY - kneeDrop) / Math.cos(kneeAngle));
  const shin = stick(shinR, shinLen, shinColor);
  shin.position.y = -shinLen / 2;
  knee.add(shin);
  hip.add(knee);

  hip.name = 'leg';
  return hip;
}

// ------------------------------------------------------------------ rodent

const rodent: Kit = {
  id: 'rodent',
  description: 'Mouse/rat/vole. Big round ears, long thin tail, twitchy nose, buck teeth.',
  props: {
    earSize: 'ear scale multiplier (default 1)',
    tail: 'tail length multiplier (default 1)',
    snout: 'snout length multiplier (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const fur = ctx.color(0, '#a68a72');
    const belly = ctx.color(1, '#ecdcc0');
    const pink = ctx.color(2, '#e8a4ad');
    const earSize = ctx.num('earSize', 1);
    const tailMul = ctx.num('tail', 1);
    const snoutMul = ctx.num('snout', 1);

    const root = new THREE.Group();

    const hipY = r * 0.38;
    const legLen = r * 0.38;
    const body = blob(r * 0.68, fur, { x: 0.9, y: 0.78, z: 1.25 });
    body.position.y = hipY + r * 0.32;
    root.add(body);

    const belly1 = blob(r * 0.42, belly, { x: 0.7, y: 0.5, z: 0.85 });
    belly1.position.set(0, hipY + r * 0.1, r * 0.15);
    root.add(belly1);

    const head = blob(r * 0.48, fur, { x: 0.95, y: 0.85, z: 0.9 });
    head.position.set(0, hipY + r * 0.55, r * 0.85);
    head.name = 'head';
    root.add(head);

    const snout = cone(r * 0.16, r * 0.5 * snoutMul, fur);
    snout.rotation.x = Math.PI / 2; // cone's apex is +Y — this aims it +Z (forward)
    snout.position.set(0, -r * 0.02, r * 0.4 + (r * 0.25 * snoutMul) / 2);
    head.add(snout);

    // Ears are the exaggerated feature: two flat discs, nearly as wide as
    // the head, scaled independently so `earSize` can push them further.
    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = blob(r * 0.32 * earSize, pink, { x: 1, y: 1, z: 0.22 });
      ear.position.set(side * r * 0.32, r * 0.35, -r * 0.05);
      ear.rotation.y = side * 0.3;
      head.add(ear);
      accents.push(ear);
    }

    const eyes = googlyEyes(r * 0.13, r * 0.27, r * 0.5, r * 0.05);
    head.add(eyes);

    // Jaw pivot carries the buck teeth so they open with the mouth.
    const jaw = new THREE.Group();
    jaw.position.set(0, -r * 0.1, r * 0.7 + r * 0.25 * snoutMul);
    const lowerLip = blob(r * 0.14, fur, { x: 1, y: 0.6, z: 0.8 });
    lowerLip.position.y = -r * 0.06;
    jaw.add(lowerLip);
    for (const side of [-1, 1]) {
      const tooth = chunk(r * 0.06, r * 0.12, r * 0.04, '#fffdf5');
      tooth.position.set(side * r * 0.05, -r * 0.02, r * 0.04);
      jaw.add(tooth);
    }
    head.add(jaw);

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.55, -0.5]) {
        const leg = pivotLeg({ x: side * r * 0.4, y: hipY, z: z * r }, r * 0.08, legLen, fur);
        root.add(leg);
        legs.push(leg);
      }
    }

    const tail = tailChain(
      [r * 0.75 * tailMul, r * 0.6 * tailMul],
      r * 0.06,
      0.75,
      -Math.PI / 2 + 0.1,
      0.4,
      pink,
    );
    tail.position.set(0, hipY + r * 0.35, -r * 1.05);
    root.add(tail);

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

// -------------------------------------------------------------------- bird

const bird: Kit = {
  id: 'bird',
  description: 'Small perching bird (sparrow, finch). Round body, stubby flapping wings, beak, tail feathers.',
  props: {
    wingSpan: 'wing scale multiplier (default 1)',
    beak: 'beak length multiplier (default 1)',
    crest: 'crest tuft scale (default 1, 0 to hide)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const plume = ctx.color(0, '#5b8fd6');
    const belly = ctx.color(1, '#f2e6c9');
    const bill = ctx.color(2, '#f0a23c');
    const wingSpan = ctx.num('wingSpan', 1);
    const beakMul = ctx.num('beak', 1);
    const crestMul = ctx.num('crest', 1);

    const root = new THREE.Group();

    // A puffed-out round body is the whole gag: legs and head both look
    // tiny hanging off a ball, which is exactly how a perched sparrow reads.
    const hipY = r * 0.32;
    const body = blob(r * 0.78, plume, { x: 1.02, y: 1.08, z: 1.02 });
    body.position.y = hipY + r * 0.62;
    root.add(body);

    const puff = blob(r * 0.5, belly, { x: 0.85, y: 0.9, z: 0.7 });
    puff.position.set(0, hipY + r * 0.4, r * 0.55);
    root.add(puff);

    const head = blob(r * 0.42, plume, { x: 1, y: 1, z: 1 });
    head.position.set(0, hipY + r * 1.2, r * 0.55);
    head.name = 'head';
    root.add(head);

    const eyes = googlyEyes(r * 0.13, r * 0.24, r * 0.34, r * 0.06);
    head.add(eyes);

    const upperBeak = cone(r * 0.14, r * 0.32 * beakMul, bill);
    upperBeak.rotation.x = Math.PI / 2;
    upperBeak.position.set(0, r * 0.02, r * 0.36 + (r * 0.32 * beakMul) / 2);
    head.add(upperBeak);

    const jaw = new THREE.Group();
    jaw.position.set(0, -r * 0.05, r * 0.34);
    const lowerBeak = cone(r * 0.11, r * 0.24 * beakMul, bill);
    lowerBeak.rotation.x = Math.PI / 2;
    lowerBeak.position.set(0, -r * 0.03, (r * 0.24 * beakMul) / 2);
    jaw.add(lowerBeak);
    head.add(jaw);

    const accents: THREE.Object3D[] = [];
    if (crestMul > 0) {
      const crest = cone(r * 0.07 * crestMul, r * 0.3 * crestMul, bill);
      crest.position.set(0, r * 0.38, -r * 0.05);
      crest.rotation.x = -0.5;
      head.add(crest);
      accents.push(crest);
    }

    // Wings pivot at the shoulder — a stubby flattened blob reads as a
    // folded wing without needing feather detail at 40px.
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * r * 0.6, hipY + r * 0.68, 0);
      const wing = blob(r * 0.55 * wingSpan, plume, { x: 0.3, y: 0.55, z: 0.95 });
      wing.position.set(side * r * 0.15 * wingSpan, -r * 0.05, -r * 0.05);
      pivot.add(wing);
      pivot.name = 'wing';
      root.add(pivot);
      accents.push(pivot);
    }

    // A small fan of feather cards at the tail — fin() is a flat double
    // sided card, cheap and reads as a feather fan from any angle.
    for (const i of [-1, 0, 1]) {
      const feather = fin(r * 0.16, r * 0.55, plume);
      feather.position.set(i * r * 0.13, hipY + r * 0.5, -r * 0.72);
      feather.rotation.set(0.25, i * 0.25, 0);
      root.add(feather);
      accents.push(feather);
    }

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = pivotLeg({ x: side * r * 0.2, y: hipY, z: 0 }, r * 0.055, hipY, bill);
      root.add(leg);
      legs.push(leg);
    }

    return { body: root, head, jaw, legs, eyes, accents };
  },
};

// -------------------------------------------------------------------- frog

const frog: Kit = {
  id: 'frog',
  description: 'Wide squat body, huge eyes on top of the head, big folded back legs, flicking tongue.',
  props: {
    tongue: 'tongue length multiplier (default 1)',
    eyeBulge: 'eye size multiplier (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const skin = ctx.color(0, '#6fc24a');
    const belly = ctx.color(1, '#d9edb8');
    const tongueColor = ctx.color(2, '#e0556b');
    const eyeBulge = ctx.num('eyeBulge', 1);
    const tongueMul = ctx.num('tongue', 1);

    const root = new THREE.Group();

    const hipY = r * 0.22;
    const body = blob(r * 0.95, skin, { x: 1.2, y: 0.62, z: 1.15 });
    // y=0.62 squash on an r*0.95 sphere makes for a tall half-height (0.59r)
    // — center it high enough that the belly clears the ground, not at the
    // leg-mount height (legs attach up into the body, which is normal here).
    body.position.y = hipY + r * 0.38;
    root.add(body);

    const belly1 = blob(r * 0.65, belly, { x: 0.95, y: 0.4, z: 0.85 });
    belly1.position.set(0, hipY + r * 0.1, r * 0.35);
    root.add(belly1);

    const head = blob(r * 0.75, skin, { x: 1.05, y: 0.65, z: 0.85 });
    head.position.set(0, hipY + r * 0.42, r * 0.7);
    head.name = 'head';
    root.add(head);

    // The trick for "eyes on top": build normal forward-looking googly eyes,
    // then tip the whole group up so the bulge sits on the skull and the
    // pupils still read as looking forward-and-up, the way a real frog's do.
    const eyes = googlyEyes(r * 0.32 * eyeBulge, r * 0.42, r * 0.15, r * 0.42);
    eyes.rotation.x = -0.55;
    head.add(eyes);

    const jaw = new THREE.Group();
    jaw.position.set(0, -r * 0.18, r * 1.05);
    const mouth = blob(r * 0.55, belly, { x: 1, y: 0.25, z: 0.5 });
    mouth.position.y = -r * 0.05;
    jaw.add(mouth);
    head.add(jaw);

    // Tongue rides on the jaw so it emerges from the mouth; returned as an
    // accent so the shared animator's free swing gives it a flick in place.
    const accents: THREE.Object3D[] = [];
    const tongue = stick(r * 0.09, r * 0.7 * tongueMul, tongueColor);
    tongue.rotation.x = Math.PI / 2 + 0.3;
    tongue.position.set(0, -r * 0.02, (r * 0.7 * tongueMul) / 2);
    jaw.add(tongue);
    accents.push(tongue);

    // Big folded back legs (the "ready to jump" silhouette) plus small
    // stubby front legs.
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = haunchLeg(
        side * r * 0.85,
        hipY + r * 0.35,
        -r * 0.5,
        side,
        skin,
        skin,
        r * 0.75,
        r * 0.4,
        r * 0.14,
      );
      root.add(leg);
      legs.push(leg);
    }
    for (const side of [-1, 1]) {
      const leg = pivotLeg({ x: side * r * 0.6, y: hipY, z: r * 0.55 }, r * 0.09, hipY, skin);
      root.add(leg);
      legs.push(leg);
    }

    return { body: root, head, jaw, legs, eyes, accents };
  },
};

// ------------------------------------------------------------------ lizard

const lizard: Kit = {
  id: 'lizard',
  description: 'Low slung, four splayed legs, long tapering tail, crest along the spine.',
  props: {
    tail: 'tail length multiplier (default 1)',
    crest: 'spine crest scale (default 1, 0 to hide)',
    frill: 'neck frill scale (default 1, 0 to hide)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const skin = ctx.color(0, '#4a8f5c');
    const belly = ctx.color(1, '#bcd98a');
    const crestColor = ctx.color(2, '#e0c23c');
    const tailMul = ctx.num('tail', 1);
    const crestMul = ctx.num('crest', 1);
    const frillMul = ctx.num('frill', 1);

    const root = new THREE.Group();

    const hipY = r * 0.24;
    const body = blob(r * 0.6, skin, { x: 0.85, y: 0.55, z: 1.7 });
    body.position.y = hipY + r * 0.26;
    root.add(body);

    const belly1 = blob(r * 0.4, belly, { x: 0.7, y: 0.35, z: 1.4 });
    belly1.position.set(0, hipY + r * 0.05, 0);
    root.add(belly1);

    const head = blob(r * 0.38, skin, { x: 0.85, y: 0.6, z: 1.2 });
    head.position.set(0, hipY + r * 0.3, r * 1.15);
    head.name = 'head';
    root.add(head);
    const eyes = googlyEyes(r * 0.14, r * 0.24, r * 0.35, r * 0.22);
    head.add(eyes);

    const jaw = new THREE.Group();
    jaw.position.set(0, hipY, r * 1.35);
    const mouth = blob(r * 0.16, skin, { x: 1, y: 0.5, z: 1.3 });
    mouth.position.y = -hipY - r * 0.02;
    jaw.add(mouth);
    head.add(jaw);

    const accents: THREE.Object3D[] = [];

    // Crest: a row of little spikes shrinking from neck to tail base — the
    // exaggerated feature. Each one is a single cone, cheap and unmistakable
    // in silhouette.
    if (crestMul > 0) {
      const spikeCount = 5;
      for (let i = 0; i < spikeCount; i++) {
        const t = i / (spikeCount - 1);
        const spike = cone(r * 0.05 * crestMul, r * (0.32 - t * 0.18) * crestMul, crestColor);
        spike.position.set(0, hipY + r * 0.5, r * 0.95 - t * r * 1.7);
        root.add(spike);
        accents.push(spike);
      }
    }

    // Frill: a small fan of cards flaring from the neck.
    if (frillMul > 0) {
      for (const side of [-1, 1]) {
        const frillFin = fin(r * 0.35 * frillMul, r * 0.4 * frillMul, crestColor);
        frillFin.position.set(side * r * 0.28 * frillMul, hipY + r * 0.28, r * 0.85);
        frillFin.rotation.y = side * 1.1;
        head.add(frillFin);
        accents.push(frillFin);
      }
    }

    // Long tapering tail — nearly as long as the body, the classic lizard
    // silhouette cue.
    const tail = tailChain(
      [r * 0.7 * tailMul, r * 0.6 * tailMul, r * 0.45 * tailMul],
      r * 0.16,
      0.65,
      -Math.PI / 2,
      0.12,
      skin,
    );
    tail.position.set(0, hipY + r * 0.22, -r * 1.05);
    root.add(tail);

    // Four splayed legs. legLen is solved so a splayed leg's foot still
    // lands at y=0 (dividing by cos of the splay angle compensates for the
    // shortening a rotation causes).
    const splay = 0.5;
    const legLen = hipY / Math.cos(splay);
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.75, -0.7]) {
        const leg = pivotLeg({ x: side * r * 0.55, y: hipY, z: z * r }, r * 0.09, legLen, skin);
        leg.rotation.z = side * splay;
        root.add(leg);
        legs.push(leg);
      }
    }

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

// -------------------------------------------------------------------- crab

const crab: Kit = {
  id: 'crab',
  description: 'Wide flat shell, one much bigger claw, eyes on stalks, scuttling side legs.',
  props: {
    clawSize: 'big-claw scale multiplier (default 1.6)',
    legCount: 'pairs of side legs (default 3)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const shellColor = ctx.color(0, '#d9542e');
    const clawColor = ctx.color(1, '#f2794a');
    const legColor = ctx.color(2, '#b8391c');
    const bigClaw = ctx.num('clawSize', 1.6);
    const legPairs = Math.max(2, Math.round(ctx.num('legCount', 3)));

    const root = new THREE.Group();

    const hipY = r * 0.22;
    const shell = blob(r * 0.85, shellColor, { x: 1.5, y: 0.5, z: 1.15 });
    shell.position.y = hipY + r * 0.2;
    root.add(shell);

    const head = blob(r * 0.28, shellColor, { x: 1, y: 0.7, z: 0.8 });
    head.position.set(0, hipY + r * 0.15, r * 1.05);
    head.name = 'head';
    root.add(head);

    // Eyes on stalks: two thin sticks plus one googlyEyes() call sized and
    // spaced to land right at the stalk tips — keeps the mandatory googly
    // look while still reading as stalked eyes.
    const stalkLen = r * 0.32;
    for (const side of [-1, 1]) {
      const stalk = stick(r * 0.035, stalkLen, shellColor);
      stalk.position.set(side * r * 0.22, hipY + r * 0.15 + stalkLen / 2, r * 1.05);
      head.add(stalk);
    }
    const eyes = googlyEyes(r * 0.15, r * 0.22, r * 1.1, hipY + r * 0.15 + stalkLen);
    root.add(eyes);

    const accents: THREE.Object3D[] = [];

    // Two claws, wildly asymmetric — the exaggerated feature. Same rig,
    // different scale, so the asymmetry reads as "one claw grew huge" and
    // not "these are different creatures."
    for (const side of [-1, 1]) {
      const scale = side < 0 ? bigClaw : 1;
      const pivot = new THREE.Group();
      pivot.position.set(side * r * 0.9, hipY + r * 0.25, r * 0.2);
      const arm = stick(r * 0.1 * scale, r * 0.35 * scale, legColor);
      arm.rotation.z = side * 0.9;
      arm.position.set(side * r * 0.17 * scale, 0, 0);
      pivot.add(arm);
      const pincer = blob(r * 0.28 * scale, clawColor, { x: 1.3, y: 0.7, z: 0.85 });
      pincer.position.set(side * r * 0.4 * scale, -r * 0.02 * scale, r * 0.05 * scale);
      pivot.add(pincer);
      const tip = cone(r * 0.08 * scale, r * 0.22 * scale, clawColor);
      tip.rotation.z = side * -1.1;
      tip.position.set(side * r * 0.62 * scale, r * 0.02 * scale, r * 0.1 * scale);
      pivot.add(tip);
      pivot.name = 'claw';
      root.add(pivot);
      accents.push(pivot);
    }

    // Scuttling side legs — splayed hard to the sides, per `legCount` pairs.
    // legLen is solved so a leg rotated by `splay` still plants its foot at
    // y=0 (dividing by cos(splay) compensates for the rotation's shortening).
    const splay = 1.0;
    const legLen = hipY / Math.cos(splay);
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < legPairs; i++) {
        const t = legPairs > 1 ? i / (legPairs - 1) : 0.5;
        const z = (0.55 - t * 1.1) * r;
        const leg = pivotLeg({ x: side * r * 0.75, y: hipY, z }, r * 0.06, legLen, legColor);
        leg.rotation.z = side * splay;
        root.add(leg);
        legs.push(leg);
      }
    }

    return { body: root, head, legs, eyes, accents };
  },
};

// -------------------------------------------------------------------- fish

const fish: Kit = {
  id: 'fish',
  description: 'Body, tail fin, dorsal fin, side fins, big lips. Swims — floats above y=0.',
  props: {
    finSize: 'fin scale multiplier (default 1)',
    plumpness: 'body thickness multiplier (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const skin = ctx.color(0, '#4ea8d6');
    const belly = ctx.color(1, '#cdeaf5');
    const finColor = ctx.color(2, '#2e7ab0');
    const finSize = ctx.num('finSize', 1);
    const plump = ctx.num('plumpness', 1);

    const root = new THREE.Group();

    // Fish is the one kit allowed to leave the ground — it swims. Float
    // height is still radius-relative so it scales with the species.
    const floatY = r * 0.95;

    const body = blob(r * 0.85, skin, { x: 0.95 * plump, y: 0.85 * plump, z: 1.35 });
    body.position.y = floatY;
    root.add(body);

    const belly1 = blob(r * 0.55 * plump, belly, { x: 0.75, y: 0.55, z: 1.05 });
    belly1.position.set(0, floatY - r * 0.15 * plump, r * 0.15);
    root.add(belly1);

    const head = blob(r * 0.55, skin, { x: 0.9 * plump, y: 0.85 * plump, z: 0.75 });
    head.position.set(0, floatY + r * 0.05, r * 1.15);
    head.name = 'head';
    root.add(head);
    const eyes = googlyEyes(r * 0.16, r * 0.3, r * 0.42, r * 0.15);
    head.add(eyes);

    // Big lips — the exaggerated feature: an oversized pink pucker on an
    // otherwise plain head silhouette reads instantly, even at 40px.
    const jaw = new THREE.Group();
    jaw.position.set(0, -r * 0.06, r * 0.55);
    const lips = blob(r * 0.26, ctx.color(3, '#e0708a'), { x: 1, y: 0.55, z: 0.6 });
    jaw.add(lips);
    head.add(jaw);

    // Tail fin doubles as the rig's `tail` — the shared animator wags it,
    // which is exactly a fish's swim stroke for free.
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, floatY, -r * 1.4);
    for (const side of [-1, 1]) {
      const lobe = fin(r * 0.55 * finSize, r * 0.75 * finSize, finColor);
      lobe.position.set(0, side * r * 0.3 * finSize, -side * r * 0.15 * finSize);
      lobe.rotation.x = side * 0.35;
      tailPivot.add(lobe);
    }
    root.add(tailPivot);

    const accents: THREE.Object3D[] = [];
    // Dorsal fin: rotated 90 degrees about Y so its flat face points
    // sideways (along X) instead of forward — a vertical blade along the spine.
    const dorsal = fin(r * 0.6 * finSize, r * 0.5 * finSize, finColor);
    dorsal.rotation.y = Math.PI / 2;
    dorsal.position.set(0, floatY + r * 0.75 * plump, -r * 0.1);
    root.add(dorsal);
    accents.push(dorsal);

    for (const side of [-1, 1]) {
      const sideFin = fin(r * 0.35 * finSize, r * 0.28 * finSize, finColor);
      sideFin.position.set(side * r * 0.75 * plump, floatY - r * 0.1, r * 0.55);
      sideFin.rotation.z = side * 0.5;
      root.add(sideFin);
      accents.push(sideFin);
    }

    return { body: root, head, jaw, tail: tailPivot, eyes, accents };
  },
};

// ------------------------------------------------------------------ bunny

const bunny: Kit = {
  id: 'bunny',
  description: 'Enormous ears, tiny fluffy tail, powerful back legs, permanently startled expression.',
  props: {
    earLength: 'ear length multiplier (default 1)',
    fluff: 'tail poof scale (default 1)',
  },
  build(ctx): KitParts {
    const r = ctx.radius;
    const fur = ctx.color(0, '#f2ede3');
    const pink = ctx.color(1, '#f2a8b8');
    const earLen = ctx.num('earLength', 1);
    const fluff = ctx.num('fluff', 1);

    const root = new THREE.Group();

    const hipY = r * 0.3;
    const body = blob(r * 0.68, fur, { x: 0.92, y: 0.92, z: 1.05 });
    body.position.y = hipY + r * 0.42;
    root.add(body);

    const head = blob(r * 0.52, fur, { x: 0.95, y: 0.95, z: 0.95 });
    head.position.set(0, hipY + r * 0.95, r * 0.55);
    head.name = 'head';
    root.add(head);

    const nose = blob(r * 0.1, pink, { x: 1, y: 0.8, z: 0.8 });
    nose.position.set(0, -r * 0.02, r * 0.48);
    head.add(nose);

    // Wide, high, oversized eyes are the whole "startled" joke — no
    // animation needed, the proportions alone read as permanently alarmed.
    const eyes = googlyEyes(r * 0.19, r * 0.32, r * 0.4, r * 0.08);
    head.add(eyes);

    // Ears: the exaggerated feature. Sphere geometry stretched hugely along
    // Y gives a rounded-tip floppy-ear silhouette for free — no separate cap
    // mesh needed.
    const accents: THREE.Object3D[] = [];
    // earHalfLen is the stretched sphere's y-radius: positioning the sphere
    // at exactly that height puts its bottom at the pivot (the ear's root)
    // and its tip at 2x that — total ear length r*1.5*earLen by default.
    const earBaseR = r * 0.22;
    const earHalfLen = r * 0.75 * earLen;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * r * 0.2, r * 0.35, -r * 0.05);
      const ear = blob(earBaseR, fur, { x: 0.62, y: earHalfLen / earBaseR, z: 0.3 });
      ear.position.y = earHalfLen;
      pivot.add(ear);
      pivot.rotation.z = side * 0.12;
      head.add(pivot);
      accents.push(pivot);
    }

    // Tail: a cluster of small blobs bunched together — a poof silhouette,
    // not a single sphere, which is what makes it read as "fluffy."
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, hipY + r * 0.45, -r * 1.0);
    for (const [dx, dy, dz] of [
      [0, 0, 0],
      [r * 0.1, r * 0.08, -r * 0.06],
      [-r * 0.1, -r * 0.05, -r * 0.04],
    ]) {
      const puff = blob(r * 0.16 * fluff, fur, { x: 1, y: 1, z: 1 });
      puff.position.set(dx, dy, dz);
      tailGroup.add(puff);
    }
    root.add(tailGroup);

    // Powerful haunches at the back, small front paws — the kick-off
    // silhouette that says "this thing can jump."
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = haunchLeg(
        side * r * 0.5,
        hipY + r * 0.3,
        -r * 0.55,
        side,
        fur,
        fur,
        r * 0.6,
        r * 0.32,
        r * 0.11,
      );
      root.add(leg);
      legs.push(leg);
    }
    for (const side of [-1, 1]) {
      const leg = pivotLeg({ x: side * r * 0.35, y: hipY, z: r * 0.5 }, r * 0.07, hipY, fur);
      root.add(leg);
      legs.push(leg);
    }

    return { body: root, head, legs, tail: tailGroup, eyes, accents };
  },
};

export const CRITTER_KITS: Kit[] = [rodent, bird, frog, lizard, crab, fish, bunny];
