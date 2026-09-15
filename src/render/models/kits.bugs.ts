/**
 * Tier 0-1 kits: the things that crawl first.
 *
 * Reference implementation — `grub` is the worked example the other kit files
 * follow. Keep every kit under ~30 triangles' worth of primitives: a phone
 * renders hundreds of these at once.
 */
import * as THREE from 'three';
import { blob, chunk, cone, googlyEyes, pivotLeg, stick, type Kit, type KitContext, type KitParts } from './kit';

/** Segmented caterpillar-ish body. The shape every low-tier bug is built from. */
function segmentedBody(
  ctx: KitContext,
  count: number,
  color: string,
  accent: string,
): { root: THREE.Group; segments: THREE.Mesh[] } {
  const root = new THREE.Group();
  const segments: THREE.Mesh[] = [];
  const r = ctx.radius;
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const size = r * (0.75 + Math.sin(t * Math.PI) * 0.35);
    const seg = blob(size, i % 2 === 0 ? color : accent, { x: 1, y: 0.85, z: 1 });
    seg.position.set(0, size * 0.9, -(i - (count - 1) / 2) * r * 1.15);
    root.add(seg);
    segments.push(seg);
  }
  return { root, segments };
}

const grub: Kit = {
  id: 'grub',
  description: 'Squishy segmented larva. Wobbles when it walks. The bottom of every chain.',
  props: { segments: 'number of body segments (default 4)', antennae: 'boolean (default true)' },
  build(ctx): KitParts {
    const skin = ctx.color(0, '#c8e87a');
    const accent = ctx.color(1, '#a8d45c');
    const eyeR = ctx.radius * 0.26;

    const { root, segments } = segmentedBody(ctx, ctx.num('segments', 4), skin, accent);
    const head = segments[0];
    head.name = 'head';

    const eyes = googlyEyes(eyeR, ctx.radius * 0.36, ctx.radius * 0.55, ctx.radius * 0.25);
    head.add(eyes);

    const accents: THREE.Object3D[] = [];
    if (ctx.bool('antennae', true)) {
      for (const side of [-1, 1]) {
        const ant = stick(ctx.radius * 0.07, ctx.radius * 0.9, ctx.color(2, '#6b8f2e'));
        ant.position.set(side * ctx.radius * 0.3, ctx.radius * 0.7, ctx.radius * 0.2);
        ant.rotation.z = side * 0.4;
        head.add(ant);
        accents.push(ant);
      }
    }

    // Stubby legs on the underside of every other segment.
    const legs: THREE.Object3D[] = [];
    for (let i = 0; i < segments.length; i += 1) {
      for (const side of [-1, 1]) {
        const leg = pivotLeg(
          { x: side * ctx.radius * 0.55, y: ctx.radius * 0.5, z: segments[i].position.z },
          ctx.radius * 0.09,
          ctx.radius * 0.5,
          accent,
        );
        root.add(leg);
        legs.push(leg);
      }
    }

    return { body: root, head, eyes, legs, accents };
  },
};

const beetle: Kit = {
  id: 'beetle',
  description: 'Armoured dome with a split shell and stubby horns. Clatters.',
  props: { horn: 'horn length multiplier (default 1)', shellSplit: 'boolean (default true)' },
  build(ctx): KitParts {
    const shellColor = ctx.color(0, '#5a4bd6');
    const bodyColor = ctx.color(1, '#2b2340');
    const hornColor = ctx.color(2, '#f0c24b');
    const r = ctx.radius;
    const root = new THREE.Group();

    const belly = blob(r * 0.85, bodyColor, { x: 1.05, y: 0.6, z: 1.2 });
    belly.position.y = r * 0.55;
    root.add(belly);

    const accents: THREE.Object3D[] = [];
    const shellHalves = ctx.bool('shellSplit', true) ? [-1, 1] : [0];
    for (const side of shellHalves) {
      const shell = blob(r * 0.8, shellColor, { x: 0.62, y: 0.7, z: 1.15 });
      shell.position.set(side * r * 0.4, r * 0.85, -r * 0.05);
      shell.rotation.z = side * 0.12;
      root.add(shell);
      accents.push(shell);
    }

    const head = blob(r * 0.45, bodyColor, { x: 1, y: 0.8, z: 0.9 });
    head.position.set(0, r * 0.65, r * 0.95);
    head.name = 'head';
    root.add(head);
    head.add(googlyEyes(r * 0.16, r * 0.24, r * 0.3, r * 0.2));

    const horn = cone(r * 0.16, r * 0.9 * ctx.num('horn', 1), hornColor);
    horn.position.set(0, r * 0.35, r * 0.6);
    horn.rotation.x = -0.9;
    head.add(horn);
    accents.push(horn);

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.75, 0, -0.75]) {
        const leg = pivotLeg(
          { x: side * r * 0.75, y: r * 0.45, z: z * r },
          r * 0.08,
          r * 0.55,
          bodyColor,
        );
        leg.rotation.z = side * 0.5;
        root.add(leg);
        legs.push(leg);
      }
    }

    return { body: root, head, legs, accents };
  },
};

const hopper: Kit = {
  id: 'hopper',
  description: 'Grasshopper/cricket. Enormous folded back legs, twitchy antennae.',
  props: { wings: 'boolean (default true)' },
  build(ctx): KitParts {
    const green = ctx.color(0, '#8ede54');
    const dark = ctx.color(1, '#4f9b2a');
    const r = ctx.radius;
    const root = new THREE.Group();

    const body = blob(r * 0.8, green, { x: 0.8, y: 0.8, z: 1.6 });
    body.position.y = r * 0.9;
    root.add(body);

    const head = blob(r * 0.45, green, { x: 0.9, y: 1, z: 0.9 });
    head.position.set(0, r * 1.15, r * 1.1);
    head.name = 'head';
    root.add(head);
    head.add(googlyEyes(r * 0.2, r * 0.28, r * 0.25, r * 0.1));

    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const ant = stick(r * 0.05, r * 1.4, dark);
      ant.position.set(side * r * 0.2, r * 0.6, r * 0.1);
      ant.rotation.set(-0.5, 0, side * 0.5);
      head.add(ant);
      accents.push(ant);
    }
    if (ctx.bool('wings', true)) {
      for (const side of [-1, 1]) {
        const wing = blob(r * 0.5, dark, { x: 0.25, y: 0.5, z: 1.5 });
        wing.position.set(side * r * 0.5, r * 1.05, -r * 0.2);
        root.add(wing);
        accents.push(wing);
      }
    }

    // Two big jumping legs at the back, four little ones up front.
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const thigh = new THREE.Group();
      thigh.position.set(side * r * 0.6, r * 1.0, -r * 0.6);
      const upper = blob(r * 0.35, green, { x: 0.5, y: 1.2, z: 0.6 });
      upper.position.y = -r * 0.2;
      upper.rotation.z = side * -0.5;
      thigh.add(upper);
      // The shin is solved so its *bottom* lands on y=0 from the hip height,
      // rather than eyeballed: a squashed limb that sinks reads as broken.
      const shinLen = r * 1.1;
      const shin = stick(r * 0.07, shinLen, dark);
      shin.position.set(side * r * 0.25, -(r * 1.0 - shinLen / 2), 0);
      thigh.add(shin);
      root.add(thigh);
      legs.push(thigh);
    }
    for (const side of [-1, 1]) {
      for (const z of [0.9, 0.3]) {
        const leg = pivotLeg({ x: side * r * 0.5, y: r * 0.85, z: z * r }, r * 0.06, r * 0.7, dark);
        leg.rotation.z = side * 0.6;
        root.add(leg);
        legs.push(leg);
      }
    }

    return { body: root, head, legs, accents };
  },
};

const ant: Kit = {
  id: 'ant',
  description: 'Three-ball ant with pincers. Comes in absolutely enormous numbers.',
  props: { pincers: 'boolean (default true)' },
  build(ctx): KitParts {
    const shell = ctx.color(0, '#c2452e');
    const dark = ctx.color(1, '#6d2417');
    const r = ctx.radius;
    const root = new THREE.Group();

    const abdomen = blob(r * 0.75, shell, { x: 1, y: 0.95, z: 1.15 });
    abdomen.position.set(0, r * 0.8, -r * 0.9);
    root.add(abdomen);

    const thorax = blob(r * 0.5, dark, { x: 1, y: 0.9, z: 1 });
    thorax.position.set(0, r * 0.8, 0);
    root.add(thorax);

    const head = blob(r * 0.55, shell, { x: 1.1, y: 0.95, z: 0.95 });
    head.position.set(0, r * 0.85, r * 0.9);
    head.name = 'head';
    root.add(head);
    head.add(googlyEyes(r * 0.18, r * 0.3, r * 0.35, r * 0.15));

    const accents: THREE.Object3D[] = [];
    const jaw = new THREE.Group();
    jaw.position.set(0, -r * 0.1, r * 0.45);
    if (ctx.bool('pincers', true)) {
      for (const side of [-1, 1]) {
        const pincer = cone(r * 0.1, r * 0.55, dark);
        pincer.position.set(side * r * 0.22, 0, r * 0.2);
        pincer.rotation.set(Math.PI / 2, 0, side * 0.5);
        jaw.add(pincer);
      }
    }
    head.add(jaw);

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (const z of [0.4, 0, -0.4]) {
        const leg = pivotLeg({ x: side * r * 0.45, y: r * 0.8, z: z * r }, r * 0.06, r * 0.8, dark);
        leg.rotation.z = side * 0.55;
        root.add(leg);
        legs.push(leg);
      }
    }

    return { body: root, head, jaw, legs, accents };
  },
};

const spider: Kit = {
  id: 'spider',
  description: 'Eight scuttling legs, fat abdomen, far too many eyes.',
  props: { eyeRows: 'number of eye pairs (default 2)', legSpan: 'leg length multiplier (default 1)' },
  build(ctx): KitParts {
    const fur = ctx.color(0, '#3b2f4d');
    const mark = ctx.color(1, '#e0543f');
    const r = ctx.radius;
    const span = ctx.num('legSpan', 1);
    const root = new THREE.Group();

    const abdomen = blob(r * 0.85, fur, { x: 1, y: 0.9, z: 1.1 });
    abdomen.position.set(0, r * 0.85, -r * 0.7);
    root.add(abdomen);
    const mark1 = blob(r * 0.3, mark, { x: 1, y: 0.4, z: 0.8 });
    mark1.position.set(0, r * 0.55, -r * 0.1);
    abdomen.add(mark1);

    const head = blob(r * 0.5, fur, { x: 1, y: 0.85, z: 0.9 });
    head.position.set(0, r * 0.75, r * 0.45);
    head.name = 'head';
    root.add(head);

    const rows = Math.max(1, Math.round(ctx.num('eyeRows', 2)));
    for (let i = 0; i < rows; i++) {
      const eyes = googlyEyes(r * 0.13 - i * 0.02 * r, r * (0.18 + i * 0.14), r * 0.38, r * (0.2 - i * 0.16));
      head.add(eyes);
    }

    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const z = (1.1 - i * 0.6) * r * 0.7;
        const pivot = new THREE.Group();
        pivot.position.set(side * r * 0.4, r * 0.85, z);
        const upper = stick(r * 0.06, r * 0.9 * span, fur);
        upper.position.set(side * r * 0.45 * span, r * 0.15, 0);
        upper.rotation.z = side * -1.1;
        pivot.add(upper);
        const lower = stick(r * 0.05, r * 0.95 * span, fur);
        lower.position.set(side * r * 0.85 * span, -r * 0.3, 0);
        lower.rotation.z = side * 0.5;
        pivot.add(lower);
        root.add(pivot);
        legs.push(pivot);
      }
    }

    return { body: root, head, legs };
  },
};

const moth: Kit = {
  id: 'moth',
  description: 'Fuzzy flier with huge flapping wings. Hovers above the ground.',
  props: { wingSpan: 'wing size multiplier (default 1)', hover: 'hover height (default 0.9)' },
  build(ctx): KitParts {
    const fuzz = ctx.color(0, '#d9c48f');
    const wing = ctx.color(1, '#f3e3b4');
    const spot = ctx.color(2, '#8a5fbf');
    const r = ctx.radius;
    const root = new THREE.Group();
    const hover = ctx.num('hover', 0.9) * r;

    const body = blob(r * 0.55, fuzz, { x: 0.8, y: 0.8, z: 1.5 });
    body.position.y = hover + r * 0.4;
    root.add(body);

    const head = blob(r * 0.35, fuzz, { x: 1, y: 1, z: 0.9 });
    head.position.set(0, hover + r * 0.55, r * 0.75);
    head.name = 'head';
    root.add(head);
    head.add(googlyEyes(r * 0.17, r * 0.22, r * 0.25, r * 0.05));

    const accents: THREE.Object3D[] = [];
    const span = ctx.num('wingSpan', 1);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * r * 0.25, hover + r * 0.55, 0);
      const upper = blob(r * 1.1 * span, wing, { x: 1, y: 0.12, z: 0.75 });
      upper.position.set(side * r * 0.9 * span, 0, r * 0.15);
      upper.rotation.z = side * -0.25;
      const dot = blob(r * 0.25, spot, { x: 1, y: 0.4, z: 1 });
      dot.position.set(side * r * 0.4, r * 0.15, 0);
      upper.add(dot);
      pivot.add(upper);
      const lower = blob(r * 0.7 * span, wing, { x: 1, y: 0.1, z: 0.6 });
      lower.position.set(side * r * 0.7 * span, -r * 0.12, -r * 0.6);
      pivot.add(lower);
      pivot.name = 'wing';
      root.add(pivot);
      accents.push(pivot);
    }
    for (const side of [-1, 1]) {
      const ant = stick(r * 0.04, r * 0.7, spot);
      ant.position.set(side * r * 0.15, r * 0.35, r * 0.1);
      ant.rotation.set(-0.6, 0, side * 0.6);
      head.add(ant);
      accents.push(ant);
    }

    return { body: root, head, accents };
  },
};

const snail: Kit = {
  id: 'snail',
  description: 'Slow, shelled, and absurdly tanky. Eyestalks on springs.',
  props: { shellTurns: 'spiral segments (default 5)' },
  build(ctx): KitParts {
    const foot = ctx.color(0, '#e8b9c9');
    const shell = ctx.color(1, '#b9743f');
    const shellDark = ctx.color(2, '#8a5228');
    const r = ctx.radius;
    const root = new THREE.Group();

    const body = blob(r * 0.8, foot, { x: 0.8, y: 0.55, z: 1.5 });
    body.position.y = r * 0.42;
    root.add(body);

    const turns = Math.max(2, Math.round(ctx.num('shellTurns', 5)));
    const spiral = new THREE.Group();
    spiral.position.set(0, r * 0.95, -r * 0.35);
    for (let i = 0; i < turns; i++) {
      const t = i / turns;
      const seg = blob(r * (0.8 - t * 0.55), i % 2 ? shellDark : shell, { x: 0.55, y: 1, z: 1 });
      const angle = t * Math.PI * 2.4;
      seg.position.set(0, Math.sin(angle) * r * 0.35 * (1 - t), Math.cos(angle) * r * 0.4 * (1 - t));
      spiral.add(seg);
    }
    root.add(spiral);

    const head = blob(r * 0.35, foot, { x: 0.9, y: 0.9, z: 1 });
    head.position.set(0, r * 0.5, r * 1.1);
    head.name = 'head';
    root.add(head);

    const accents: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const stalk = new THREE.Group();
      stalk.position.set(side * r * 0.18, r * 0.25, r * 0.05);
      const rod = stick(r * 0.06, r * 0.8, foot);
      rod.position.y = r * 0.4;
      stalk.add(rod);
      const eye = blob(r * 0.16, '#fffdf5');
      eye.position.y = r * 0.82;
      const pupil = blob(r * 0.08, '#1a1526');
      pupil.position.z = r * 0.11;
      eye.add(pupil);
      stalk.add(eye);
      stalk.rotation.z = side * 0.18;
      head.add(stalk);
      accents.push(stalk);
    }

    return { body: root, head, accents };
  },
};

export const BUG_KITS: Kit[] = [grub, beetle, hopper, ant, spider, moth, snail];
export { chunk };
