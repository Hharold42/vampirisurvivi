import { Assets, AnimatedSprite, Spritesheet } from 'pixi.js';

export class Player {
  public sprite: AnimatedSprite | null = null;
  public speed: number = 3;
  public health: number = 50;
  public maxHealth: number = 5;
  public exp: number = 0;
  public level: number = 1;
  public expToNext: number = 100;
  public x: number;
  public y: number;
  private spritesheet: Spritesheet | null = null;
  private currentAnim: 'walk' | 'idle' | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  async createSprite() {
    const frameWidth = 256;
    const frameHeight = 341;
    const marginY = 2;
    const imageUrl = '/sprites/hero.png';
    // Получаем размеры изображения
    const img = new Image();
    img.src = imageUrl;
    await new Promise(resolve => { img.onload = resolve; });
    const imgW = img.width;
    const imgH = img.height;
    const cols = Math.floor(imgW / frameWidth);
    const rows = Math.floor(imgH / frameHeight);
    // Генерируем atlasData
    const atlasData: any = {
      frames: {},
      meta: {
        image: imageUrl,
        format: 'RGBA8888',
        size: { w: imgW, h: imgH },
        scale: 1,
      },
      animations: {
        walk: [],
        idle: [],
      },
    };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const name = (row === 0 ? 'walk_' : row === 1 ? 'idle_' : 'frame_') + col;
        const frame = {
          frame: {
            x: col * frameWidth,
            y: row * frameHeight + marginY,
            w: frameWidth,
            h: frameHeight - marginY * 2,
          },
          sourceSize: { w: frameWidth, h: frameHeight },
          spriteSourceSize: {
            x: 0,
            y: 0,
            w: frameWidth,
            h: frameHeight - marginY * 2,
          },
        };
        atlasData.frames[name] = frame;
        if (row === 0) atlasData.animations.walk.push(name);
        if (row === 1) atlasData.animations.idle.push(name);
      }
    }
    const texture = await Assets.load(atlasData.meta.image);
    this.spritesheet = new Spritesheet(texture, atlasData);
    await this.spritesheet.parse();
    this.sprite = new AnimatedSprite(this.spritesheet.animations['idle']);
    this.sprite.anchor.set(0.5);
    this.sprite.animationSpeed = 0.1;
    this.sprite.scale.set(0.2);
    this.sprite.play();
    this.currentAnim = 'idle';
    return this.sprite;
  }

  setAnimation(name: 'walk' | 'idle') {
    if (
      this.sprite &&
      this.spritesheet &&
      this.spritesheet.animations[name] &&
      this.currentAnim !== name
    ) {
      this.sprite.textures = this.spritesheet.animations[name];
      this.sprite.play();
      this.currentAnim = name;
    }
  }

  move(dx: number, dy: number) {
    this.x += dx * this.speed;
    this.y += dy * this.speed;
  }

  setScreenPosition(screenX: number, screenY: number) {
    if (this.sprite) {
      this.sprite.x = screenX;
      this.sprite.y = screenY;
    }
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health < 0) this.health = 0;
  }

  addExp(amount: number) {
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = 100 * this.level;
    }
  }
} 