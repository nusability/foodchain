/**
 * Scenery props for the Food Chain tower-defense game.
 * Everything scales from ctx.radius.
 */
import * as THREE from 'three';
import { blob, chunk, cone, googlyEyes, pivotLeg, type Kit, type KitParts } from './kit';

const house: Kit = {
  id: 'prop.house',
  description: 'Wonky cartoon cottage: lovable sloped roof, crooked chimney with smoke, round door, two windows.',
  props: {
    chimney: 'chimney lean multiplier (default 1)',
    windows: 'window size multiplier (default 1)',
  },
  build(ctx): KitParts {
    const walls = ctx.color(0, '#d4a574');
    const roof = ctx.color(1, '#8b5a3c');
    const door = ctx.color(2, '#4a3428');
    const trim = '#f5f5f5';
    const r = ctx.radius;
    const root = new THREE.Group();

    // Main house body: wide base, tapers up slightly
    const body = chunk(r * 2.2, r * 1.8, r * 1.6, walls);
    body.position.y = r * 0.9;
    root.add(body);

    // Sloped roof: two sides of a peaked roof
    for (const side of [-1, 1]) {
      const roofPart = blob(r * 1.3, roof, { x: 1.2, y: 0.4, z: 1.0 });
      roofPart.position.set(side * r * 0.6, r * 1.9, 0);
      roofPart.rotation.z = side * 0.35;
      root.add(roofPart);
    }

    // Crooked chimney with lean
    const chimneyLean = ctx.num('chimney', 1);
    const chimney = cone(r * 0.3, r * 1.3, '#8b4513');
    chimney.position.set(r * 0.6 * chimneyLean, r * 2.4, -r * 0.6);
    chimney.rotation.x = 0.15 * chimneyLean;
    root.add(chimney);

    // Smoke puff on top of chimney
    const smoke = blob(r * 0.4, '#e8e8e8', { x: 1, y: 0.8, z: 0.9 });
    smoke.position.set(r * 0.6 * chimneyLean, r * 3.0, -r * 0.6);
    root.add(smoke);

    // Round door
    const doorSize = r * 0.6;
    const doorMesh = blob(doorSize, door, { x: 0.8, y: 1, z: 0.3 });
    doorMesh.position.set(0, r * 0.6, r * 0.95);
    root.add(doorMesh);
    // Door handle
    const handle = blob(r * 0.1, '#ffd700');
    handle.position.set(r * 0.3, r * 0.65, r * 1.15);
    doorMesh.add(handle);

    // Two windows
    const windowSize = r * ctx.num('windows', 1) * 0.5;
    for (const side of [-1, 1]) {
      const window = chunk(windowSize * 1.2, windowSize, windowSize * 0.2, '#4da6ff');
      window.position.set(side * r * 0.7, r * 1.4, r * 0.95);
      root.add(window);
      // Window pane dividers
      for (let i = 0; i < 2; i++) {
        const pane = chunk(windowSize * 0.08, windowSize * 0.8, windowSize * 0.15, trim);
        pane.position.set(side * r * 0.7, r * 1.4 + (i - 0.5) * windowSize * 0.5, r * 1.0);
        root.add(pane);
      }
    }

    return { body: root };
  },
};

const tree: Kit = {
  id: 'prop.tree',
  description: 'Stylised tree: thick tapering trunk with 2-3 overlapping blobby canopy masses.',
  props: {
    canopyLumps: 'number of canopy blobs (default 3)',
    trunkLean: 'trunk lean angle multiplier (default 1)',
  },
  build(ctx): KitParts {
    const trunkColor = ctx.color(0, '#6b4423');
    const leafColor = ctx.color(1, '#2d8a2d');
    const r = ctx.radius;
    const root = new THREE.Group();

    // Trunk tapers from thick base
    const trunk = cone(r * 0.5, r * 2.0, trunkColor);
    trunk.position.y = r * 1.0;
    trunk.rotation.x = ctx.num('trunkLean', 1) * 0.15;
    root.add(trunk);

    // Canopy lumps - overlapping blobs
    const lumps = Math.max(2, Math.round(ctx.num('canopyLumps', 3)));
    const accents: THREE.Object3D[] = [];
    for (let i = 0; i < lumps; i++) {
      const t = i / lumps;
      const size = r * (1.0 - t * 0.3);
      const lump = blob(size, leafColor, { x: 1.1, y: 1.0, z: 1.1 });
      const angle = (t * Math.PI * 2) + (i % 2) * 0.3 - 0.15;
      lump.position.set(
        Math.sin(angle) * r * 0.4,
        r * (1.8 + t * 0.5),
        Math.cos(angle) * r * 0.4 + r * 0.2
      );
      root.add(lump);
      accents.push(lump);
    }

    return { body: root, accents };
  },
};

const rock: Kit = {
  id: 'prop.rock',
  description: 'Cluster of 2-4 faceted boulders of different sizes.',
  props: {
    chunks: 'number of rock chunks (default 3)',
  },
  build(ctx): KitParts {
    const color = ctx.color(0, '#6b6b6b');
    const r = ctx.radius;
    const root = new THREE.Group();

    const numChunks = Math.max(2, Math.min(4, Math.round(ctx.num('chunks', 3))));
    for (let i = 0; i < numChunks; i++) {
      const size = r * (0.8 - i * 0.15);
      const boulder = chunk(size * 1.1, size * 0.9, size * 1.2, color);
      boulder.rotation.set(
        (i % 3) * 0.4 - 0.4,
        (i * Math.PI * 2) / numChunks,
        (i % 2) * 0.3 - 0.3
      );
      boulder.position.set(
        (i % 2) * r * 0.4 - r * 0.2,
        size * (i * 0.45 + 0.8),
        (i % 2) * r * 0.3 - r * 0.15
      );
      root.add(boulder);
    }

    return { body: root };
  },
};

const bush: Kit = {
  id: 'prop.bush',
  description: '3-5 overlapping small blobs with a few berry dots.',
  props: {
    berries: 'number of berry dots (default 5)',
  },
  build(ctx): KitParts {
    const foliage = ctx.color(0, '#4a7c3c');
    const berry = ctx.color(1, '#d62828');
    const r = ctx.radius;
    const root = new THREE.Group();

    // Overlapping foliage blobs
    for (let i = 0; i < 4; i++) {
      const size = r * (0.7 - i * 0.12);
      const blob_ = blob(size, foliage, { x: 1.1, y: 0.95, z: 1.1 });
      const angle = (i * Math.PI * 0.7);
      blob_.position.set(
        Math.sin(angle) * r * 0.3,
        r * (0.8 + i * 0.2),
        Math.cos(angle) * r * 0.2
      );
      blob_.rotation.set(
        (i % 3) * 0.15 - 0.15,
        angle,
        (i % 2) * 0.15 - 0.15
      );
      root.add(blob_);
    }

    // Berry dots scattered on the bush
    const numBerries = Math.max(3, Math.round(ctx.num('berries', 5)));
    const accents: THREE.Object3D[] = [];
    for (let i = 0; i < numBerries; i++) {
      const berryDot = blob(r * 0.12, berry);
      const angle = (i * Math.PI * 2) / numBerries;
      berryDot.position.set(
        Math.sin(angle) * r * 0.35,
        r * 0.65 + Math.cos(angle) * r * 0.35,
        Math.cos(angle) * r * 0.25
      );
      root.add(berryDot);
      accents.push(berryDot);
    }

    return { body: root, accents };
  },
};

const totem: Kit = {
  id: 'prop.totem',
  description: 'Stacked carved totem: base, 2-3 stacked blocks, glowing orb on top.',
  props: {
    blocks: 'number of stacked blocks (default 3)',
  },
  build(ctx): KitParts {
    const wood = ctx.color(0, '#8b6f47');
    const glow = ctx.color(3, '#ffff00');
    const r = ctx.radius;
    const root = new THREE.Group();

    // Base - wider chunk at the bottom
    const base = chunk(r * 1.6, r * 0.8, r * 1.4, wood);
    base.position.y = r * 0.4;
    root.add(base);

    // Stacked blocks with carved details
    const numBlocks = Math.max(2, Math.min(3, Math.round(ctx.num('blocks', 3))));
    const accents: THREE.Object3D[] = [];
    let currentHeight = r * 1.2;

    for (let i = 0; i < numBlocks; i++) {
      const blockSize = r * (1.0 - i * 0.15);
      const block = chunk(blockSize * 1.3, blockSize * 0.75, blockSize * 1.2, wood);
      block.position.y = currentHeight;
      root.add(block);
      accents.push(block);

      // Carved face on block
      const face = blob(blockSize * 0.3, '#5a4a3a', { x: 1, y: 0.8, z: 0.5 });
      face.position.set(0, currentHeight - blockSize * 0.15, blockSize * 0.7);
      root.add(face);

      currentHeight += blockSize * 0.75 + r * 0.1;
    }

    // Glowing orb on top
    const orb = blob(r * 0.5, glow);
    orb.position.y = currentHeight + r * 0.3;
    root.add(orb);
    accents.push(orb);

    return { body: root, accents };
  },
};

const king: Kit = {
  id: 'prop.king',
  description: 'The player avatar: small round monarch with big head, oversized crown, tiny legs, and cape.',
  props: {
    crownSize: 'crown size multiplier (default 1)',
    cape: 'boolean, draw cape (default true)',
  },
  build(ctx): KitParts {
    const skin = ctx.color(0, '#f5d9b5');
    const royal = ctx.color(1, '#c41e3a');
    const gold = ctx.color(2, '#ffd700');
    const r = ctx.radius;
    const root = new THREE.Group();

    // Stubby body
    const body = blob(r * 0.5, skin, { x: 0.9, y: 0.75, z: 0.85 });
    body.position.y = r * 0.4;
    root.add(body);

    // Big round head
    const head = blob(r * 0.75, skin, { x: 1.0, y: 1.0, z: 1.0 });
    head.position.y = r * 1.2;
    head.name = 'head';
    root.add(head);

    // Googly eyes
    head.add(googlyEyes(r * 0.2, r * 0.3, r * 0.4, r * 0.15));

    // Oversized crown - the whole joke
    const crownScale = ctx.num('crownSize', 1);
    const crown = cone(r * 0.5 * crownScale, r * 0.8 * crownScale, gold);
    crown.position.y = r * 1.85;
    root.add(crown);
    // Crown jewels
    for (const side of [-1, 1]) {
      const jewel = blob(r * 0.12, '#ff1493');
      jewel.position.set(side * r * 0.35 * crownScale, r * 1.75, 0);
      root.add(jewel);
    }

    // Cape - behind the body
    const accents: THREE.Object3D[] = [];
    if (ctx.bool('cape', true)) {
      const cape = blob(r * 0.6, royal, { x: 1.2, y: 0.8, z: 0.4 });
      cape.position.set(0, r * 0.9, -r * 0.4);
      cape.rotation.x = 0.2;
      root.add(cape);
      accents.push(cape);
    }

    // Tiny legs - just two pivots
    const legs: THREE.Object3D[] = [];
    for (const side of [-1, 1]) {
      const leg = pivotLeg(
        { x: side * r * 0.3, y: r * 0.35, z: 0 },
        r * 0.1,
        r * 0.35,
        skin
      );
      root.add(leg);
      legs.push(leg);
    }

    return { body: root, head, legs, accents };
  },
};

export const PROP_KITS: Kit[] = [house, tree, rock, bush, totem, king];
