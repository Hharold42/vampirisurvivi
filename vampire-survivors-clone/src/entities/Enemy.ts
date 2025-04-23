import * as PIXI from 'pixi.js';

export class Enemy {
  public sprite: PIXI.Graphics;
  public speed: number = 1.5;
  public dead: boolean = false;
  public health: number;
  public maxHealth: number;
  public x: number;
  public y: number;
  public enemyBuffLevel: number = 0;

  constructor(x: number, y: number, health: number = 3) {
    this.sprite = new PIXI.Graphics();
    this.sprite.beginFill(0xff3333);
    this.sprite.drawCircle(0, 0, 16);
    this.sprite.endFill();
    this.x = x;
    this.y = y;
    this.maxHealth = health;
    this.health = health;
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
    }
  }

  moveToward(targetX: number, targetY: number) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
  }

  setScreenPosition(screenX: number, screenY: number) {
    this.sprite.x = screenX;
    this.sprite.y = screenY;
  }
} 