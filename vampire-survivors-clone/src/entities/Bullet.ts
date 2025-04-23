import * as PIXI from 'pixi.js';

export class Bullet {
  public sprite: PIXI.Graphics;
  public speed: number;
  public dx: number;
  public dy: number;
  public alive: boolean = true;
  public damage: number;
  public radius: number;
  public bounces?: number;
  public x: number;
  public y: number;

  constructor(x: number, y: number, dx: number, dy: number, options: { speed: number, radius: number, color: number, damage: number, bounces?: number }) {
    this.sprite = new PIXI.Graphics();
    this.sprite.beginFill(options.color);
    this.sprite.drawCircle(0, 0, options.radius);
    this.sprite.endFill();
    this.x = x;
    this.y = y;
    // Нормализуем направление
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.dx = dx / len;
    this.dy = dy / len;
    this.speed = options.speed;
    this.damage = options.damage;
    this.radius = options.radius;
    if (options.bounces !== undefined) this.bounces = options.bounces;
  }

  update() {
    this.x += this.dx * this.speed;
    this.y += this.dy * this.speed;
  }

  setScreenPosition(screenX: number, screenY: number) {
    this.sprite.x = screenX;
    this.sprite.y = screenY;
  }
} 