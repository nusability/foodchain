/**
 * Tier 2-4 kits: the mid-size chasers, grazers and ambushers.
 *
 * `quadruped` is the workhorse — four unrelated species (fox, wolf, dog,
 * badger) share this single builder and differ only by props, so the shape
 * language stays deliberately generic: one snout cone, one tail, four legs,
 * a couple of switches that push the silhouette toward "sleek hunter" or
 * "stocky digger" without ever touching geometry construction. The rest of
 * this file is one dedicated kit per predator archetype.
 */
import * as THREE from 'three';
import {
  blob,
  chunk,
  cone,
  fin,
  googlyEyes,
  pivotLeg,
  stick,
  type Kit,
  type KitContext,
  type KitParts,
} from './kit';

/**
 * Higher tiers should read as meaner without new geometry — this just scales
 * whatever "threat" measurement (fang/tusk/talon size, tooth count) a kit
 * feeds it, a little more per tier above the mid-point.
 */
function meanness(ctx: KitContext, amount = 0.12): number {
  return 1 + Math.max(0, ctx.tier - 2) * amount;
}

/**
 * pivotLeg() plants its foot's *centre* at (hip height − leg length); the
 * foot's own half-height then pushes its belly below y = 0, which is exactly
 * the "sinks below the ground plane" warning the checker flags. Every kit
 * below wants to say "put the hip at height h" and get a foot that actually
 * rests on the floor, so this solves for the stick length that makes that
 * true instead of every call site doing the algebra by hand.
 */
function stanceLeg(
  at: { x: number; y: number; z: number },
  legRadius: number,
  color: string,
  footColor: string,
): THREE.Group {
  const footHalf = legRadius * 1.5 * 0.7;
  const length = Math.max(legRadius * 2, at.y - footHalf);
  return pivotLeg(at, legRadius, length, color, footColor);
}

const quadruped: Kit = {
  id: 'quadruped',
  description: 'Generic four-legged mammal — reskins into fox, wolf, dog or badger via props alone.',
  props: {
    snout: 'snout length multiplier (default 1)',
    tail: 'tail length multiplier (default 1)',
    bulk: 'body/torso thickness multiplier (default 1)',
    earPoint: 'pointed fox/wolf ears vs rounded dog/badger ears (default true)',
    stripe: 'pale badger-style face stripe (default false)',
  },
  build(ctx): KitParts {
    const fur = ctx.color(0, '#c97b3d');
    const belly = ctx.color(1, '#f2e2c8');
    const dark = ctx.color(2, '#33241a');
    const r = ctx.radius;
    const bulk = ctx.num('bulk', 1);
    const snoutMul = ctx.num('snout', 1);
    const tailMul = ctx.num('tail', 1);
    const pointy = ctx.bool('earPoint', true);
    const striped = ctx.bool('stripe', false);
    const root = new THREE.Group();

    // Legs set the ground first; the body then floats on top of them so a
    // `bulk` change only widens the torso instead of sinking it into the
    // floor or lifting the whole animal off it.
    const legLen = r * 0.82;
    const body = blob(r, fur, { x: 0.42 * bulk, y: 0.58, z: 1.5 });
    body.position.y = legLen + r * 0.5;
    root.add(body);

    const bellyPatch = blob(r * 0.85, belly, { x: 0.5 * bulk, y: 0.4, z: 1.2 });
    bellyPatch.position.set(0, legLen + r * 0.22, -r * 0.05);
    root.add(bellyPatch);

    const head = blob(r * 0.55, fur, { x: 0.85, y: 0.82, z: 0.85 });
    head.position.set(0, legLen + r * 0.88, r * 1.1);
    head.name = 'head';
    root.add(head);

    // One tapered cone, stretched by `snout`, is the single shape that turns
    // this rig into a sharp-nosed fox/wolf or a blunt dog/badger. The cone is
    // rotated 90° about X so its apex (local +Y) points forward (+Z); the
    // nose is attached to `head`, not to this rotated cone, because a child
    // added to a mesh that is both rotated *and* non-uniformly scaled lands
    // in the wrong place (its axes get swapped by the rotation first).
    const snoutLen = r * 0.62 * snoutMul;
    const snout = cone(r * 0.24, snoutLen, fur, 6);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, -r * 0.06, r * 0.42);
    head.add(snout);
    const nose = blob(r * 0.11, dark, { x: 1, y: 0.8, z: 1 });
    nose.position.set(0, -r * 0.06, r * 0.42 + snoutLen * 0.5);
    head.add(nose);

    if (striped) {
      const stripeMesh = blob(r * 0.12, belly, { x: 0.9, y: 0.5, z: 2.2 });
      stripeMesh.position.set(0, r * 0.15, r * 0.3);
      head.add(stripeMesh);
    }

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = pointy
        ? cone(r * 0.16, r * 0.34, fur, 4)
        : blob(r * 0.16, fur, { x: 0.8, y: 1, z: 0.6 });
      ear.position.set(side * r * 0.32, r * 0.45, r * 0.05);
      ear.rotation.z = side * (pointy ? 0.25 : 0.1);
      head.add(ear);
      ears.push(ear);
    }

    const eyes = googlyEyes(r * 0.13, r * 0.22, r * 0.55, r * 0.14);
    head.add(eyes);

    // Lower jaw hinges under the fixed snout; the animator rotates this
    // pivot open on every attack.
    const jaw = new THREE.Group();
    jaw.position.set(0, legLen + r * 0.78, r * 1.25);
    const lowerJaw = blob(r * 0.22, fur, { x: 0.85, y: 0.5, z: 1.1 });
    lowerJaw.position.set(0, -r * 0.12, r * 0.2);
    jaw.add(lowerJaw);
    root.add(jaw);

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.85, -0.85]) {
        const leg = stanceLeg({ x: side * r * 0.38 * bulk, y: legLen, z: z * r * 0.65 }, r * 0.11, fur, dark);
        root.add(leg);
        legs.push(leg);
      }
    }

    // The tail hangs off its own pivot behind the body so a yaw wag swings
    // it from the base, not around its own midpoint.
    const tail = new THREE.Group();
    tail.position.set(0, legLen + r * 0.7, -r * 1.35);
    const tailMesh = stick(r * 0.14, r * 0.9 * tailMul, fur);
    tailMesh.position.set(0, r * 0.1, -r * 0.45 * tailMul);
    tailMesh.rotation.x = 0.5;
    tail.add(tailMesh);
    const tip = blob(r * 0.18, dark, { x: 1, y: 1, z: 1.3 });
    tip.position.set(0, r * 0.42, -r * 0.85 * tailMul);
    tail.add(tip);
    root.add(tail);

    return { body: root, head, jaw, legs, tail, eyes, accents: ears };
  },
};

const boar: Kit = {
  id: 'boar',
  description: 'Barrel-bodied tusker. All threat, no legroom — the anger reads from tiny eyes and a bristling spine.',
  props: {
    tusk: 'tusk length multiplier (default 1)',
    bristle: 'number of spine bristles (default 5)',
  },
  build(ctx): KitParts {
    const hide = ctx.color(0, '#6b5142');
    const dark = ctx.color(1, '#2c1e17');
    const tuskColor = ctx.color(2, '#f2e9d8');
    const r = ctx.radius;
    const tuskMul = ctx.num('tusk', 1) * meanness(ctx);
    const bristleCount = Math.max(2, Math.min(8, Math.round(ctx.num('bristle', 5))));
    const root = new THREE.Group();

    // Legs are deliberately short — a barrel body reads as "angry and low
    // to the ground" far better than a tall one does.
    const legLen = r * 0.55;
    const body = blob(r, hide, { x: 0.85, y: 0.78, z: 1.15 });
    body.position.y = legLen + r * 0.65;
    root.add(body);

    const head = blob(r * 0.55, hide, { x: 0.95, y: 0.75, z: 0.9 });
    head.position.set(0, legLen + r * 0.75, r * 1.05);
    head.name = 'head';
    root.add(head);

    const snout = chunk(r * 0.42, r * 0.3, r * 0.4, dark);
    snout.position.set(0, -r * 0.15, r * 0.55);
    head.add(snout);
    const nostrils = blob(r * 0.1, '#1a120e', { x: 1.4, y: 0.6, z: 0.4 });
    nostrils.position.set(0, r * 0.02, r * 0.22);
    snout.add(nostrils);

    // Tiny eyes, set small and high on a big face, read as "angry" without
    // any extra geometry — it's purely a proportion trick.
    const eyes = googlyEyes(r * 0.08, r * 0.26, r * 0.45, r * 0.28);
    head.add(eyes);

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = blob(r * 0.16, dark, { x: 0.5, y: 0.7, z: 0.9 });
      ear.position.set(side * r * 0.4, r * 0.45, r * 0.15);
      ear.rotation.z = side * -0.3;
      head.add(ear);
      ears.push(ear);
    }

    // Tusks curl up from the lower jaw (not the fixed skull) so they swing
    // with the mouth on every bite.
    const jaw = new THREE.Group();
    jaw.position.set(0, legLen + r * 0.62, r * 1.3);
    const lowerJaw = blob(r * 0.24, hide, { x: 0.9, y: 0.5, z: 0.9 });
    lowerJaw.position.set(0, -r * 0.1, r * 0.1);
    jaw.add(lowerJaw);
    for (const side of [-1, 1]) {
      const t = cone(r * 0.09, r * 0.45 * tuskMul, tuskColor, 5);
      t.position.set(side * r * 0.18, -r * 0.05, r * 0.22);
      t.rotation.set(-1.9, 0, side * 0.3);
      jaw.add(t);
    }
    root.add(jaw);

    // Bristly ridge: a row of cones along the spine, tallest at the
    // shoulder — the cheapest way to break up a barrel silhouette.
    const accents: THREE.Object3D[] = [...ears];
    for (let i = 0; i < bristleCount; i++) {
      const t = i / Math.max(1, bristleCount - 1);
      const h = Math.max(r * 0.15, r * (0.5 - Math.abs(t - 0.3) * 0.6));
      const bristle = cone(r * 0.05, h, dark, 4);
      bristle.position.set(0, legLen + r * 1.15, r * (0.7 - t * 1.5));
      bristle.rotation.x = -0.15;
      root.add(bristle);
      accents.push(bristle);
    }

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.75, -0.75]) {
        const leg = stanceLeg({ x: side * r * 0.5, y: legLen, z: z * r * 0.55 }, r * 0.14, dark, dark);
        root.add(leg);
        legs.push(leg);
      }
    }

    const tail = new THREE.Group();
    tail.position.set(0, legLen + r * 0.8, -r * 1.1);
    const curl = stick(r * 0.06, r * 0.4, dark);
    curl.position.set(0, r * 0.15, -r * 0.1);
    curl.rotation.x = 1.1;
    tail.add(curl);
    root.add(tail);

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

const serpent: Kit = {
  id: 'serpent',
  description: 'Legless chain of tapering segments with a wedge head. The chain is the rig — every segment comes back as an accent so it can slither.',
  props: {
    segments: 'body segment count (default 9)',
    hood: 'cobra-style neck hood (default false)',
  },
  build(ctx): KitParts {
    const scale = ctx.color(0, '#3f8f4a');
    const belly = ctx.color(1, '#d8e8a8');
    const dark = ctx.color(2, '#1c2b1c');
    const r = ctx.radius;
    const count = Math.max(4, Math.min(12, Math.round(ctx.num('segments', 9))));
    const hooded = ctx.bool('hood', false);
    const root = new THREE.Group();

    // No legs to hold the chain off the floor, so every segment's own
    // vertical half-extent doubles as its resting height — nothing sinks,
    // nothing needs the stanceLeg trick because there is no leg.
    const squashY = 0.8;
    const segments: THREE.Object3D[] = [];
    let headY = r * 0.5;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const size = r * (0.75 - t * 0.5); // thick at the neck, whip-thin at the tip
      const seg = blob(size, i % 3 === 0 ? dark : scale, { x: 1, y: squashY, z: 1.2 });
      const y = size * squashY;
      if (i === 0) headY = y;
      seg.position.set(
        Math.sin(t * Math.PI * 1.4) * r * 0.4, // a lazy at-rest coil, not a straight rod
        y,
        -t * r * 2.4,
      );
      root.add(seg);
      segments.push(seg);
    }

    const head = blob(r * 0.5, scale, { x: 0.9, y: 0.65, z: 1.3 });
    head.position.set(0, headY, r * 0.5);
    head.name = 'head';
    root.add(head);

    const bellyStripe = blob(r * 0.28, belly, { x: 0.65, y: 0.3, z: 1.5 });
    bellyStripe.position.set(0, -r * 0.12, 0);
    head.add(bellyStripe);

    const eyes = googlyEyes(r * 0.09, r * 0.2, r * 0.35, r * 0.14);
    head.add(eyes);

    // Jaw + forked tongue share one pivot so a bite opens both together.
    const jaw = new THREE.Group();
    jaw.position.set(0, headY - r * 0.1, r * 0.65);
    const lowerJaw = blob(r * 0.22, dark, { x: 0.85, y: 0.35, z: 1 });
    lowerJaw.position.set(0, -r * 0.05, r * 0.18);
    jaw.add(lowerJaw);
    for (const side of [-1, 1]) {
      const tongue = stick(r * 0.02, r * 0.4, '#c23b4a', 4);
      tongue.position.set(side * r * 0.05, -r * 0.02, r * 0.5);
      tongue.rotation.set(Math.PI / 2, 0, side * 0.3);
      jaw.add(tongue);
    }
    root.add(jaw);

    const accents: THREE.Object3D[] = [...segments];
    if (hooded) {
      for (const side of [-1, 1]) {
        const hoodFin = fin(r * 0.55, r * 0.5, scale);
        hoodFin.position.set(side * r * 0.3, headY + r * 0.15, r * 0.15);
        hoodFin.rotation.y = side * 0.9;
        head.add(hoodFin);
        accents.push(hoodFin);
      }
    }

    const tail = segments[segments.length - 1];
    return { body: root, head, jaw, tail, eyes, accents };
  },
};

const raptor: Kit = {
  id: 'raptor',
  description: 'Bird of prey. Hooked beak, huge wings, fierce brow, talons — and it never quite lands.',
  props: {
    wingSpan: 'wing size multiplier (default 1)',
    talon: 'talon/claw size multiplier (default 1)',
  },
  build(ctx): KitParts {
    const plumage = ctx.color(0, '#5c4a3a');
    const pale = ctx.color(1, '#e8dcc0');
    const beakColor = ctx.color(2, '#e8a23c');
    const r = ctx.radius;
    const wingSpan = ctx.num('wingSpan', 1);
    const talonMul = ctx.num('talon', 1) * meanness(ctx);
    const root = new THREE.Group();

    // Hovers on the wingbeat rather than standing — this and `shark` are the
    // two kits the brief explicitly allows to float above y = 0.
    const hover = r * 1.5;

    const body = blob(r * 0.8, plumage, { x: 0.7, y: 0.85, z: 1.3 });
    body.position.y = hover;
    root.add(body);

    const chest = blob(r * 0.5, pale, { x: 0.6, y: 0.65, z: 0.9 });
    chest.position.set(0, hover - r * 0.1, r * 0.5);
    root.add(chest);

    const head = blob(r * 0.42, plumage, { x: 0.9, y: 0.85, z: 0.85 });
    head.position.set(0, hover + r * 0.7, r * 0.8);
    head.name = 'head';
    root.add(head);

    // Upper beak is fixed and hooked (a down-curled cone); the fierce brow
    // is just two dark chunks pinched forward over the eyes.
    const beak = cone(r * 0.14, r * 0.45, beakColor, 5);
    beak.rotation.x = Math.PI / 2 + 0.35; // curls the hook down and forward
    beak.position.set(0, -r * 0.05, r * 0.38);
    head.add(beak);

    const brows: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const brow = chunk(r * 0.22, r * 0.08, r * 0.18, '#241a12');
      brow.position.set(side * r * 0.2, r * 0.22, r * 0.32);
      brow.rotation.z = side * -0.3;
      head.add(brow);
      brows.push(brow);
    }

    const eyes = googlyEyes(r * 0.1, r * 0.22, r * 0.32, r * 0.12);
    head.add(eyes);

    const jaw = new THREE.Group();
    jaw.position.set(0, hover + r * 0.62, r * 1.05);
    const mandible = cone(r * 0.1, r * 0.3, beakColor, 5);
    mandible.rotation.x = Math.PI / 2;
    mandible.position.set(0, -r * 0.04, r * 0.15);
    jaw.add(mandible);
    root.add(jaw);

    // One huge fin per side, angled into a shallow dihedral — wingspan is
    // the single biggest shape on the model, because it's what reads as
    // "raptor" in silhouette long before the beak or talons do.
    const accents: THREE.Object3D[] = [...brows];
    for (const side of [-1, 1]) {
      const wing = fin(r * 2.4 * wingSpan, r * 1.1 * wingSpan, plumage);
      wing.position.set(side * r * 0.5, hover + r * 0.15, -r * 0.1);
      wing.rotation.x = Math.PI / 2;
      wing.rotation.z = side * 0.18;
      root.add(wing);
      accents.push(wing);
    }

    const tail = new THREE.Group();
    tail.position.set(0, hover - r * 0.05, -r * 1.2);
    const tailFin = fin(r * 0.7, r * 1.0, plumage);
    tailFin.rotation.x = Math.PI / 2;
    tailFin.position.set(0, 0, -r * 0.4);
    tail.add(tailFin);
    root.add(tail);

    // Talons hang below the tucked-up legs — three forward claws per foot,
    // the one feature this kit is named for, scaled up on higher tiers.
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const legLen = r * 0.35;
      const leg = pivotLeg({ x: side * r * 0.2, y: hover - r * 0.55, z: r * 0.2 }, r * 0.06, legLen, plumage, beakColor);
      for (const spread of [-0.3, 0, 0.3]) {
        const claw = cone(r * 0.03, r * 0.22 * talonMul, '#241a12', 4);
        claw.rotation.set(Math.PI / 2, 0, spread);
        claw.position.set(spread * r * 0.1, -legLen, r * 0.1);
        leg.add(claw);
      }
      root.add(leg);
      legs.push(leg);
    }

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

const bigcat: Kit = {
  id: 'bigcat',
  description: 'Lithe, low-slung hunter. Broad face, visible fangs, a long tail that flicks at the tip.',
  props: {
    mane: 'shaggy neck mane, lion-style (default true)',
    tail: 'tail length multiplier (default 1)',
    fang: 'fang size multiplier (default 1)',
  },
  build(ctx): KitParts {
    const coat = ctx.color(0, '#d9a441');
    const belly = ctx.color(1, '#f5e6c8');
    const dark = ctx.color(2, '#2a1c12');
    const r = ctx.radius;
    const maned = ctx.bool('mane', true);
    const tailMul = ctx.num('tail', 1);
    const fangMul = ctx.num('fang', 1) * meanness(ctx);
    const root = new THREE.Group();

    // Kept deliberately low and long — a big cat's threat is in the crouch,
    // not the height.
    const legLen = r * 0.62;
    const body = blob(r, coat, { x: 0.68, y: 0.6, z: 1.75 });
    body.position.y = legLen + r * 0.4;
    root.add(body);

    const bellyPatch = blob(r * 0.9, belly, { x: 0.55, y: 0.35, z: 1.4 });
    bellyPatch.position.set(0, legLen + r * 0.12, -r * 0.1);
    root.add(bellyPatch);

    // A wide, flat-fronted head sells "broad face" far better than a
    // tapered, fox-style one.
    const head = blob(r * 0.62, coat, { x: 1.05, y: 0.8, z: 0.75 });
    head.position.set(0, legLen + r * 0.78, r * 1.25);
    head.name = 'head';
    root.add(head);

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = blob(r * 0.16, dark, { x: 0.8, y: 0.9, z: 0.5 });
      ear.position.set(side * r * 0.42, r * 0.5, r * 0.1);
      head.add(ear);
      ears.push(ear);
    }

    const eyes = googlyEyes(r * 0.15, r * 0.28, r * 0.5, r * 0.12);
    head.add(eyes);

    const accents: THREE.Object3D[] = [...ears];
    if (maned) {
      // A ring of dark tufts around the neck reads as a mane at any radius
      // without needing fur strands — silhouette over detail.
      for (const angle of [-0.6, -0.2, 0.2, 0.6]) {
        const tuft = blob(r * 0.28, dark, { x: 0.7, y: 1, z: 0.7 });
        tuft.position.set(
          Math.sin(angle) * r * 0.55,
          legLen + r * 0.75 + Math.cos(angle) * r * 0.1,
          r * 0.7 - Math.abs(angle) * r * 0.3,
        );
        root.add(tuft);
        accents.push(tuft);
      }
    }

    // Fangs hang off the lower jaw so they only show once the mouth opens.
    const jaw = new THREE.Group();
    jaw.position.set(0, legLen + r * 0.62, r * 1.55);
    const lowerJaw = blob(r * 0.28, coat, { x: 0.9, y: 0.45, z: 0.55 });
    lowerJaw.position.set(0, -r * 0.1, 0);
    jaw.add(lowerJaw);
    for (const side of [-1, 1]) {
      const fang = cone(r * 0.06, r * 0.32 * fangMul, '#fbf6ea', 4);
      fang.position.set(side * r * 0.16, -r * 0.02, r * 0.12);
      jaw.add(fang);
    }
    root.add(jaw);

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.9, -0.85]) {
        const leg = stanceLeg({ x: side * r * 0.42, y: legLen, z: z * r * 0.7 }, r * 0.13, coat, dark);
        root.add(leg);
        legs.push(leg);
      }
    }

    // The tail pivots at the rump; a kink partway along gives the "flick" a
    // hinge to read from even before it animates.
    const tail = new THREE.Group();
    tail.position.set(0, legLen + r * 0.55, -r * 1.55);
    const base = stick(r * 0.1, r * 1.1 * tailMul, coat);
    base.position.set(0, r * 0.1, -r * 0.5 * tailMul);
    base.rotation.x = 0.35;
    tail.add(base);
    const flick = blob(r * 0.16, dark, { x: 1, y: 1, z: 1.6 });
    flick.position.set(0, r * 0.5, -r * 1.05 * tailMul);
    tail.add(flick);
    root.add(tail);

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

const bear: Kit = {
  id: 'bear',
  description: 'One enormous rounded mass. The eyes get lost in the face on purpose.',
  props: {
    bulk: 'body thickness multiplier (default 1)',
    snout: 'snout length multiplier (default 1)',
  },
  build(ctx): KitParts {
    const fur = ctx.color(0, '#6b4a30');
    const muzzle = ctx.color(1, '#c9a874');
    const dark = ctx.color(2, '#2a1c10');
    const r = ctx.radius;
    const bulk = ctx.num('bulk', 1);
    const snoutMul = ctx.num('snout', 1);
    const root = new THREE.Group();

    const legLen = r * 0.7;
    // One giant near-spherical blob does all the work — `bulk` only scales
    // its width, so it never loses the "single rounded mass" read.
    const body = blob(r * 1.15, fur, { x: 0.85 * bulk, y: 0.95, z: 1.15 });
    body.position.y = legLen + r * 0.8;
    root.add(body);

    const head = blob(r * 0.7, fur, { x: 1, y: 0.95, z: 0.95 });
    head.position.set(0, legLen + r * 1.3, r * 1.1);
    head.name = 'head';
    root.add(head);

    // A short, blunt muzzle — a bear's snout barely projects, so the
    // multiplier only ever nudges it and can't turn it foxy.
    const snout = blob(r * 0.32, muzzle, { x: 0.9, y: 0.8, z: 0.9 * snoutMul });
    snout.position.set(0, -r * 0.12, r * 0.55);
    head.add(snout);
    const nose = blob(r * 0.1, dark, { x: 1, y: 0.8, z: 1 });
    nose.position.z = r * 0.42 * snoutMul;
    snout.add(nose);

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = blob(r * 0.16, fur, { x: 1, y: 1, z: 0.6 });
      ear.position.set(side * r * 0.45, r * 0.55, r * 0.15);
      head.add(ear);
      ears.push(ear);
    }

    // Tiny eyes high on a huge face — the one exaggeration that reads as
    // "bear" from across the board at 40px.
    const eyes = googlyEyes(r * 0.07, r * 0.24, r * 0.55, r * 0.18);
    head.add(eyes);

    const jaw = new THREE.Group();
    jaw.position.set(0, legLen + r * 1.14, r * 1.35);
    const lowerJaw = blob(r * 0.22, muzzle, { x: 0.85, y: 0.5, z: 0.8 });
    lowerJaw.position.set(0, -r * 0.08, 0);
    jaw.add(lowerJaw);
    root.add(jaw);

    // Paws are just oversized feet — heavy, stubby legs sell "enormous"
    // better than tall ones would.
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.7, -0.65]) {
        const leg = stanceLeg({ x: side * r * 0.55 * bulk, y: legLen, z: z * r * 0.75 }, r * 0.18, fur, dark);
        root.add(leg);
        legs.push(leg);
      }
    }

    const tail = new THREE.Group();
    tail.position.set(0, legLen + r * 0.9, -r * 1.25);
    const stub = blob(r * 0.14, fur, { x: 1, y: 1, z: 0.8 });
    stub.position.z = -r * 0.1;
    tail.add(stub);
    root.add(tail);

    return { body: root, head, jaw, legs, tail, eyes, accents: ears };
  },
};

const croc: Kit = {
  id: 'croc',
  description: 'Long armoured snout on a hinge that actually opens wide, ridged spine, splayed legs, a thick tail.',
  props: {
    jaw: 'snout/jaw length multiplier (default 1)',
    plates: 'number of spine plates (default 5)',
  },
  build(ctx): KitParts {
    const hide = ctx.color(0, '#5a7a4a');
    const belly = ctx.color(1, '#cfd9a8');
    const dark = ctx.color(2, '#2c3a20');
    const r = ctx.radius;
    const jawMul = ctx.num('jaw', 1);
    const plateCount = Math.max(3, Math.min(7, Math.round(ctx.num('plates', 5))));
    const root = new THREE.Group();

    // Crocs ride low and wide — short legs read as "ambush predator" far
    // better than tall ones, and it leaves the whole silhouette to the jaw.
    const legLen = r * 0.42;
    const body = blob(r * 0.95, hide, { x: 0.85, y: 0.55, z: 1.7 });
    body.position.y = legLen + r * 0.5;
    root.add(body);

    const bellyPatch = blob(r * 0.85, belly, { x: 0.7, y: 0.3, z: 1.5 });
    bellyPatch.position.set(0, legLen + r * 0.25, 0);
    root.add(bellyPatch);

    // Upper skull is fixed to the body; only the lower jaw hinges. The
    // hinge sits at the back corner of the mouth so opening it swings the
    // whole long snout down instead of just the tip.
    const head = chunk(r * 0.55, r * 0.4, r * 1.5 * jawMul, hide);
    head.position.set(0, legLen + r * 0.62, r * 1.65 * jawMul);
    head.name = 'head';
    root.add(head);

    const eyeBumps: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const bump = blob(r * 0.14, hide, { x: 1, y: 0.8, z: 1 });
      bump.position.set(side * r * 0.2, r * 0.28, -r * 0.3);
      head.add(bump);
      eyeBumps.push(bump);
    }
    const eyes = googlyEyes(r * 0.08, r * 0.2, -r * 0.3, r * 0.4);
    head.add(eyes);

    const jaw = new THREE.Group();
    jaw.position.set(0, legLen + r * 0.45, r * 0.95 * jawMul);
    const lowerJaw = chunk(r * 0.5, r * 0.22, r * 1.35 * jawMul, hide);
    lowerJaw.position.set(0, -r * 0.05, r * 0.68 * jawMul);
    jaw.add(lowerJaw);
    // A single pale strip stands in for "rows of teeth" — at phone size
    // individual teeth vanish, the colour break is what actually reads.
    const teeth = chunk(r * 0.46, r * 0.05, r * 1.25 * jawMul, '#f2ecd8');
    teeth.position.set(0, r * 0.1, r * 0.68 * jawMul);
    jaw.add(teeth);
    root.add(jaw);

    // Ridge plates: a row of small chunks along the spine, tallest at the
    // shoulder and shrinking toward the tail.
    const accents: THREE.Object3D[] = [...eyeBumps];
    for (let i = 0; i < plateCount; i++) {
      const t = i / Math.max(1, plateCount - 1);
      const h = r * (0.32 - t * 0.18);
      const plate = chunk(r * 0.12, h, r * 0.22, dark);
      plate.position.set(0, legLen + r * 0.85 + h * 0.5, r * (0.9 - t * 1.8));
      root.add(plate);
      accents.push(plate);
    }

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.75, -0.7]) {
        const leg = stanceLeg({ x: side * r * 0.72, y: legLen, z: z * r * 0.75 }, r * 0.13, hide, dark);
        leg.rotation.z = side * 0.5; // splayed reptile stance, not tucked under
        root.add(leg);
        legs.push(leg);
      }
    }

    const tail = new THREE.Group();
    tail.position.set(0, legLen + r * 0.5, -r * 1.6);
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const seg = blob(r * (0.55 - t * 0.28), hide, { x: 0.75, y: 0.7, z: 1.1 });
      seg.position.set(0, r * 0.05, -t * r * 0.85);
      tail.add(seg);
    }
    root.add(tail);

    return { body: root, head, jaw, legs, tail, eyes, accents };
  },
};

const shark: Kit = {
  id: 'shark',
  description: 'Pure predator silhouette: dorsal fin, crescent tail, conical snout, rows of teeth. It swims, so it never touches the floor.',
  props: {
    finSize: 'dorsal/pectoral/tail fin size multiplier (default 1)',
    teeth: 'visible tooth count, 2-6 (default 6)',
  },
  build(ctx): KitParts {
    const skin = ctx.color(0, '#5f7a8c');
    const pale = ctx.color(1, '#e4ecec');
    const dark = ctx.color(2, '#1c2830');
    const r = ctx.radius;
    const finMul = ctx.num('finSize', 1);
    const toothCount = Math.max(2, Math.min(6, Math.round(ctx.num('teeth', 6))));
    const root = new THREE.Group();

    // Swims clear of the floor — this and `raptor` are the two kits the
    // brief explicitly allows to float.
    const swim = r * 1.2;

    const body = blob(r * 1.05, skin, { x: 0.6, y: 0.6, z: 2.0 });
    body.position.y = swim;
    root.add(body);

    const belly = blob(r * 0.9, pale, { x: 0.55, y: 0.4, z: 1.8 });
    belly.position.set(0, swim - r * 0.2, 0);
    root.add(belly);

    // The head is a plain Group, not the cone mesh itself — a cone's own
    // scale is non-uniform (radius, height, radius) and it's rotated 90° to
    // point forward, so anything parented directly to it would land in the
    // wrong place once that rotation swaps its axes. Parenting to an
    // unrotated, unscaled group keeps every child's position exactly what it
    // looks like.
    const head = new THREE.Group();
    head.position.set(0, swim, r * 1.7);
    head.name = 'head';
    root.add(head);
    const snoutCone = cone(r * 0.55, r * 0.9, skin, 7);
    snoutCone.rotation.x = Math.PI / 2;
    head.add(snoutCone);

    const eyes = googlyEyes(r * 0.07, r * 0.22, r * 0.4, r * 0.12);
    head.add(eyes);

    // Jaw is the underside of the snout, hinged so it drops open for the
    // bite; teeth ride on both the fixed head and the jaw so they show
    // exactly when it matters.
    const jaw = new THREE.Group();
    jaw.position.set(0, swim - r * 0.15, r * 1.55);
    const lowerJaw = blob(r * 0.3, skin, { x: 0.75, y: 0.35, z: 0.6 });
    lowerJaw.position.set(0, -r * 0.05, r * 0.1);
    jaw.add(lowerJaw);

    const teethColor = '#fbf9f2';
    const upperCount = Math.ceil(toothCount / 2);
    const lowerCount = toothCount - upperCount;
    for (let i = 0; i < upperCount; i++) {
      const t = upperCount === 1 ? 0.5 : i / (upperCount - 1);
      const tooth = cone(r * 0.025, r * 0.1, teethColor, 3);
      tooth.rotation.x = Math.PI; // apex down — hangs from the upper jaw
      tooth.position.set((t - 0.5) * r * 0.4, r * 0.1, r * 0.42);
      head.add(tooth);
    }
    for (let i = 0; i < lowerCount; i++) {
      const t = lowerCount === 1 ? 0.5 : i / (lowerCount - 1);
      const tooth = cone(r * 0.025, r * 0.1, teethColor, 3);
      tooth.position.set((t - 0.5) * r * 0.36, r * 0.02, r * 0.28);
      jaw.add(tooth);
    }
    root.add(jaw);

    // A vertical dorsal fin plus a crescent tail is the whole silhouette a
    // shark needs — everything else is secondary. `fin` cards are rotated
    // 90° about Y so their flat face turns from front-facing to side-facing,
    // which is the profile that actually reads as a fin.
    const accents: THREE.Object3D[] = [];
    const dorsal = fin(r * 1.2 * finMul, r * 1.3 * finMul, dark);
    dorsal.rotation.y = Math.PI / 2;
    dorsal.position.set(0, swim + r * 0.75, r * 0.1);
    root.add(dorsal);
    accents.push(dorsal);

    for (const side of [-1, 1]) {
      const pec = fin(r * 1.1 * finMul, r * 0.5 * finMul, skin);
      pec.position.set(side * r * 0.5, swim - r * 0.35, r * 0.4);
      pec.rotation.z = side * 0.5;
      pec.rotation.x = 0.3;
      root.add(pec);
      accents.push(pec);
    }

    const tail = new THREE.Group();
    tail.position.set(0, swim, -r * 1.85);
    for (const side of [-1, 1]) {
      const lobe = fin(r * 0.5 * finMul, r * (side > 0 ? 1.4 : 0.9) * finMul, dark);
      lobe.rotation.y = Math.PI / 2;
      lobe.position.set(0, side * r * 0.4 * finMul, -side * r * 0.15);
      lobe.rotation.z = side * 0.35;
      tail.add(lobe);
    }
    root.add(tail);

    return { body: root, head, jaw, tail, eyes, accents };
  },
};

const stag: Kit = {
  id: 'stag',
  description: 'Slender grazer built entirely to carry its antlers. The rack branches procedurally so more `antlerBranches` always reads as more antler.',
  props: {
    antlerSize: 'antler scale multiplier (default 1)',
    antlerBranches: 'tine count per beam, 1-4 (default 3)',
  },
  build(ctx): KitParts {
    const coat = ctx.color(0, '#a87b4a');
    const belly = ctx.color(1, '#e8d9b8');
    const antlerColor = ctx.color(2, '#4a3626');
    const r = ctx.radius;
    const antlerSize = ctx.num('antlerSize', 1);
    const branchCount = Math.max(1, Math.min(4, Math.round(ctx.num('antlerBranches', 3))));
    const root = new THREE.Group();

    // Long legs, small body — "slender" is entirely a leg-length problem.
    const legLen = r * 1.15;
    const body = blob(r * 0.75, coat, { x: 0.55, y: 0.55, z: 1.35 });
    body.position.y = legLen + r * 0.35;
    root.add(body);

    const bellyPatch = blob(r * 0.6, belly, { x: 0.42, y: 0.35, z: 1.1 });
    bellyPatch.position.set(0, legLen + r * 0.12, -r * 0.05);
    root.add(bellyPatch);

    const head = blob(r * 0.38, coat, { x: 0.75, y: 0.8, z: 1.1 });
    head.position.set(0, legLen + r * 0.95, r * 1.15);
    head.name = 'head';
    root.add(head);

    const ears: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = blob(r * 0.15, coat, { x: 0.6, y: 1, z: 0.5 });
      ear.position.set(side * r * 0.3, r * 0.35, -r * 0.05);
      ear.rotation.z = side * 0.5;
      head.add(ear);
      ears.push(ear);
    }

    const eyes = googlyEyes(r * 0.1, r * 0.2, r * 0.4, r * 0.05);
    head.add(eyes);

    // Antlers: one pivot per side at the brow. A main beam sweeps up and
    // back, then `branchCount` tines fork off it at increasing height along
    // the beam — the same loop just runs more times for a bigger rack, so
    // "more branches" scales for free instead of needing hand-modelled
    // variants per tine count. Tines attach to the pivot `base` (identity
    // scale), not to the beam stick itself, for the same reason the shark's
    // snout does its own grouping — the beam is rotated and non-uniformly
    // scaled, so it's not a safe parent.
    const accents: THREE.Object3D[] = [...ears];
    for (const side of [-1, 1]) {
      const base = new THREE.Group();
      base.position.set(side * r * 0.2, legLen + r * 1.28, r * 0.9);
      base.rotation.z = side * -0.3;
      const beamLen = r * 1.3 * antlerSize;
      const beam = stick(r * 0.05 * antlerSize, beamLen, antlerColor, 5);
      beam.position.y = beamLen / 2;
      beam.rotation.x = -0.3;
      base.add(beam);
      for (let i = 0; i < branchCount; i++) {
        const t = 0.35 + (i / branchCount) * 0.6;
        const tineLen = beamLen * (0.45 - i * 0.06);
        const tine = stick(r * 0.035 * antlerSize, tineLen, antlerColor, 4);
        tine.position.set(0, beamLen * t, -beamLen * t * 0.35);
        tine.rotation.set(-0.9 - i * 0.15, 0, side * (0.5 + i * 0.15));
        base.add(tine);
      }
      root.add(base);
      accents.push(base);
    }

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.6, -0.6]) {
        const leg = stanceLeg({ x: side * r * 0.28, y: legLen, z: z * r * 0.9 }, r * 0.08, coat, antlerColor);
        root.add(leg);
        legs.push(leg);
      }
    }

    const tail = new THREE.Group();
    tail.position.set(0, legLen + r * 0.55, -r * 1.5);
    const stub = stick(r * 0.06, r * 0.4, coat);
    stub.position.set(0, -r * 0.1, -r * 0.1);
    stub.rotation.x = -0.6;
    tail.add(stub);
    root.add(tail);

    return { body: root, head, legs, tail, eyes, accents };
  },
};

export const BEAST_KITS: Kit[] = [quadruped, boar, serpent, raptor, bigcat, bear, croc, shark, stag];
