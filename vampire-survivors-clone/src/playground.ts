import { Assets, AnimatedSprite, Spritesheet, Application } from "pixi.js";

(async () => {
  // Параметры атласа
  const frameWidth = 256;
  const frameHeight = 341;
  const marginY = 2;
  const imageUrl = "/sprites/hero.png";

  const app = new Application();
  await app.init({ width: 640, height: 360});

  // Загружаем изображение для получения размеров
  const img = new Image();
  img.src = imageUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
  });
  const imgW = img.width;
  console.log("imgW:", imgW);
  const imgH = img.height;
  console.log("imgH:", imgH);
  const cols = Math.floor(imgW / frameWidth);
  const rows = Math.floor(imgH / frameHeight);

  // Генерируем atlasData
  const atlasData: any = {
    frames: {},
    meta: {
      image: imageUrl,
      format: "RGBA8888",
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
      const name = (row === 0 ? "walk_" : row === 1 ? "idle_" : "frame_") + col;
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

  const spritesheet = new Spritesheet(texture, atlasData);
  await spritesheet.parse();

  const animatedSprite = new AnimatedSprite(spritesheet.animations["walk"]);
  app.stage.addChild(animatedSprite);

  animatedSprite.play();
  animatedSprite.animationSpeed = 0.1;

  document.body.appendChild(app.canvas);
})();
