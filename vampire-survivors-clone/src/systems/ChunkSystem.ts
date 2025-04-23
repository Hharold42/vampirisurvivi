import * as PIXI from "pixi.js";

export class Obstacle {
  sprite: PIXI.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.sprite = new PIXI.Graphics();
    this.sprite.beginFill(0x666666);
    this.sprite.drawRect(-w / 2, -h / 2, w, h);
    this.sprite.endFill();
  }
}

export type ChunkKey = string;
export const obstaclesByChunk: Record<ChunkKey, Obstacle[]> = {};

export function getChunkKey(cx: number, cy: number): ChunkKey {
  return `${cx},${cy}`;
}

export function generateObstaclesForChunk(cx: number, cy: number, CHUNK_SIZE: number): Obstacle[] {
  function seededRandom(seed: number) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }
  const seed = cx * 10007 + cy * 10009;
  const rnd = seededRandom(seed);
  const obstacles: Obstacle[] = [];
  const n = 3 + Math.floor(rnd() * 3) + Math.floor(Math.abs(cx) + Math.abs(cy)) % 2;
  const centerX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const centerY = cy * CHUNK_SIZE + CHUNK_SIZE / 2;
  for (let i = 0; i < n; i++) {
    const angle = rnd() * Math.PI * 2;
    const dist = (0.25 + 0.65 * rnd()) * (CHUNK_SIZE / 2);
    const ox = centerX + Math.cos(angle) * dist;
    const oy = centerY + Math.sin(angle) * dist;
    const w = 40 + rnd() * 100;
    const h = 40 + rnd() * 100;
    obstacles.push(new Obstacle(ox, oy, w, h));
  }
  return obstacles;
}

export function ensureObstaclesForVisibleChunks(worldX: number, worldY: number, CHUNK_SIZE: number, VISIBLE_RADIUS: number, app: PIXI.Application): void {
  const pcx = Math.floor(worldX / CHUNK_SIZE);
  const pcy = Math.floor(worldY / CHUNK_SIZE);
  for (let dx = -VISIBLE_RADIUS; dx <= VISIBLE_RADIUS; dx++) {
    for (let dy = -VISIBLE_RADIUS; dy <= VISIBLE_RADIUS; dy++) {
      const cx = pcx + dx;
      const cy = pcy + dy;
      const key = getChunkKey(cx, cy);
      if (!obstaclesByChunk[key]) {
        const obs = generateObstaclesForChunk(cx, cy, CHUNK_SIZE);
        obstaclesByChunk[key] = obs;
        for (const o of obs) {
          app.stage.addChild(o.sprite);
        }
      }
    }
  }
}

export function updateObstaclesScreenPositions(cameraX: number, cameraY: number, app: PIXI.Application) {
  for (const key in obstaclesByChunk) {
    for (const o of obstaclesByChunk[key]) {
      o.sprite.x = o.x - cameraX + app.screen.width / 2;
      o.sprite.y = o.y - cameraY + app.screen.height / 2;
    }
  }
}

export function circleRectCollision(cx: number, cy: number, radius: number, rx: number, ry: number, rw: number, rh: number) {
  const hw = rw / 2;
  const hh = rh / 2;
  const closestX = Math.max(rx - hw, Math.min(cx, rx + hw));
  const closestY = Math.max(ry - hh, Math.min(cy, ry + hh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
} 