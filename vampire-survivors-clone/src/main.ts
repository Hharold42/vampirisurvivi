import "./style.css";
import { Application, Assets, Sprite } from "pixi.js";
import { Player } from "./entities/Player";
import { Enemy } from "./entities/Enemy";
import { Bullet } from "./entities/Bullet";
import { weaponsConfig, WeaponType } from "./core/weaponsConfig";
import * as PIXI from "pixi.js";
import { Obstacle, ensureObstaclesForVisibleChunks, updateObstaclesScreenPositions, circleRectCollision, obstaclesByChunk } from "./systems/ChunkSystem";

(async () => {
  // Инициализация приложения PixiJS v8
  const app = new Application();

  await app.init({
    width: 800,
    height: 600,
    backgroundColor: 0x222222,
  });

  // Очищаем #app и добавляем canvas
  const appDiv = document.querySelector<HTMLDivElement>("#app")!;
  appDiv.innerHTML = "";
  appDiv.appendChild(app.canvas as HTMLCanvasElement);

  // --- Нарезка спрайтов игрока из image.png (4x3, 192x256) ---
  // (Откат: убираю нарезку и загрузку image.png, возвращаю прежний код)

  // --- Инициализация игрока ---
  const player = new Player(0, 0); // центр мира
  await player.createSprite();
  app.stage.addChild(player.sprite!);

  // --- Инициализация врагов ---
  const enemies: Enemy[] = [];
  let enemySpawnTimer = 0;
  const ENEMY_SPAWN_INTERVAL = 18; // кадров (примерно 0.3 сек при 60fps)

  function spawnEnemy() {
    // Спавним врага по краям экрана (в мировых координатах)
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (edge === 0) {
      // сверху
      x = player.x + (Math.random() - 0.5) * app.screen.width;
      y = player.y - app.screen.height / 2 - 40;
    } else if (edge === 1) {
      // снизу
      x = player.x + (Math.random() - 0.5) * app.screen.width;
      y = player.y + app.screen.height / 2 + 40;
    } else if (edge === 2) {
      // слева
      x = player.x - app.screen.width / 2 - 40;
      y = player.y + (Math.random() - 0.5) * app.screen.height;
    } else {
      // справа
      x = player.x + app.screen.width / 2 + 40;
      y = player.y + (Math.random() - 0.5) * app.screen.height;
    }
    const enemy = new Enemy(x, y, 7 + Math.floor(Math.random() * 3)); // базовое здоровье 7-9
    enemy.health += enemyHealthBuff;
    enemy.speed = 2.1 + enemySpeedBuff + Math.random() * 0.5; // базовая скорость 2.1-2.6
    enemy.enemyBuffLevel = (typeof enemyHealthBuff === 'number' ? Math.floor(enemyHealthBuff / 2) : 0);
    enemy.sprite.x = enemy.x - player.x + app.screen.width / 2;
    enemy.sprite.y = enemy.y - player.y + app.screen.height / 2;
    enemies.push(enemy);
    app.stage.addChild(enemy.sprite);
  }

  // --- Инициализация пуль ---
  const bullets: Bullet[] = [];
  let mouseX = app.screen.width / 2;
  let mouseY = app.screen.height / 2;

  // Следим за положением мыши (переводим в мировые координаты)
  app.canvas.addEventListener("mousemove", (e) => {
    const rect = app.canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });

  // --- Оружие игрока ---
  let currentWeapon: WeaponType = "autoGun";
  type WeaponState = {
    type: WeaponType;
    level: number;
  };
  let fireCooldowns: Record<WeaponType, number> = {
    autoGun: 0,
    melee: 0,
    club: 0,
  };

  // --- Управление ---
  const keys: Record<string, boolean> = {};
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // --- Стрелка направления игрока ---
  let lastMoveDir = { x: 1, y: 0 };
  const arrow = new PIXI.Graphics();
  arrow.y = 0;
  player.sprite!.addChild(arrow);

  function updateArrow() {
    arrow.clear();
    const len =
      Math.sqrt(
        lastMoveDir.x * lastMoveDir.x + lastMoveDir.y * lastMoveDir.y
      ) || 1;
    const dx = lastMoveDir.x / len;
    const dy = lastMoveDir.y / len;
    const arrowLen = 36;
    const arrowWidth = 10;
    arrow.lineStyle(0);
    arrow.beginFill(0xffffff);
    arrow.moveTo(dx * arrowLen, dy * arrowLen);
    arrow.lineTo(
      dx * (arrowLen - 10) + dy * arrowWidth,
      dy * (arrowLen - 10) - dx * arrowWidth
    );
    arrow.lineTo(
      dx * (arrowLen - 10) - dy * arrowWidth,
      dy * (arrowLen - 10) + dx * arrowWidth
    );
    arrow.lineTo(dx * arrowLen, dy * arrowLen);
    arrow.endFill();
  }

  function handlePlayerInput() {
    let dx = 0,
      dy = 0;
    if (keys["ArrowLeft"] || keys["KeyA"]) dx -= 1;
    if (keys["ArrowRight"] || keys["KeyD"]) dx += 1;
    if (keys["ArrowUp"] || keys["KeyW"]) dy -= 1;
    if (keys["ArrowDown"] || keys["KeyS"]) dy += 1;
    // Нормализация движения по диагонали
    if (dx !== 0 && dy !== 0) {
      const norm = Math.sqrt(2) / 2;
      dx *= norm;
      dy *= norm;
    }
    if (dx !== 0 || dy !== 0) {
      lastMoveDir.x = dx;
      lastMoveDir.y = dy;
      player.setAnimation('walk');
    } else {
      player.setAnimation('idle');
    }
    player.move(dx, dy);
  }

  // --- UI ---
  const healthDiv = document.createElement("div");
  healthDiv.style.position = "absolute";
  healthDiv.style.left = "20px";
  healthDiv.style.top = "20px";
  healthDiv.style.color = "#fff";
  healthDiv.style.fontSize = "24px";
  healthDiv.style.fontFamily = "sans-serif";
  healthDiv.style.zIndex = "10";
  appDiv.appendChild(healthDiv);

  // --- UI для таймера ---
  const timerDiv = document.createElement("div");
  timerDiv.style.position = "absolute";
  timerDiv.style.right = "20px";
  timerDiv.style.top = "20px";
  timerDiv.style.color = "#fff";
  timerDiv.style.fontSize = "24px";
  timerDiv.style.fontFamily = "sans-serif";
  timerDiv.style.zIndex = "10";
  appDiv.appendChild(timerDiv);

  // --- Game Over UI ---
  const gameOverDiv = document.createElement("div");
  gameOverDiv.style.position = "absolute";
  gameOverDiv.style.left = "0";
  gameOverDiv.style.top = "0";
  gameOverDiv.style.width = "100%";
  gameOverDiv.style.height = "100%";
  gameOverDiv.style.display = "flex";
  gameOverDiv.style.alignItems = "center";
  gameOverDiv.style.justifyContent = "center";
  gameOverDiv.style.background = "rgba(0,0,0,0.7)";
  gameOverDiv.style.color = "#fff";
  gameOverDiv.style.fontSize = "48px";
  gameOverDiv.style.fontFamily = "sans-serif";
  gameOverDiv.style.zIndex = "100";
  gameOverDiv.style.display = "none";
  gameOverDiv.innerHTML = `<div><div>Game Over</div><button id="restartBtn" style="margin-top:32px;font-size:32px;">Начать заново</button></div>`;
  appDiv.appendChild(gameOverDiv);

  // --- HP Bar игрока ---
  const playerHpBar = new PIXI.Graphics();
  playerHpBar.y = -32;
  player.sprite!.addChild(playerHpBar);

  function updatePlayerHpBar() {
    playerHpBar.clear();
    const barWidth = 48;
    const barHeight = 8;
    const hpPercent = player.health / player.maxHealth;
    // Фон
    playerHpBar.beginFill(0x333333);
    playerHpBar.drawRect(-barWidth / 2, 0, barWidth, barHeight);
    playerHpBar.endFill();
    // HP
    playerHpBar.beginFill(0x00ff00);
    playerHpBar.drawRect(-barWidth / 2, 0, barWidth * hpPercent, barHeight);
    playerHpBar.endFill();
  }

  function updateHealthUI() {
    healthDiv.textContent = `Здоровье: ${player.health} / ${player.maxHealth}`;
  }

  function showGameOver() {
    gameOverDiv.style.display = "flex";
  }

  function hideGameOver() {
    gameOverDiv.style.display = "none";
  }

  document.getElementById("restartBtn")?.addEventListener("click", () => {
    window.location.reload();
  });

  // --- Класс опыта ---
  class ExpGem {
    sprite: PIXI.Graphics;
    x: number; // мировые координаты
    y: number;
    value: number;
    alive: boolean = true;
    constructor(x: number, y: number, value: number = 10) {
      this.value = value;
      this.x = x;
      this.y = y;
      this.sprite = new PIXI.Graphics();
      this.sprite.beginFill(0x3399ff);
      this.sprite.drawCircle(0, 0, 8);
      this.sprite.endFill();
    }
    setScreenPosition() {
      this.sprite.x = this.x - player.x + app.screen.width / 2;
      this.sprite.y = this.y - player.y + app.screen.height / 2;
    }
  }
  const expGems: ExpGem[] = [];

  // --- UI для опыта и уровня ---
  const expDiv = document.createElement("div");
  expDiv.style.position = "absolute";
  expDiv.style.left = "20px";
  expDiv.style.top = "56px";
  expDiv.style.color = "#fff";
  expDiv.style.fontSize = "20px";
  expDiv.style.fontFamily = "sans-serif";
  expDiv.style.zIndex = "10";
  appDiv.appendChild(expDiv);

  function updateExpUI() {
    expDiv.textContent = `Уровень: ${player.level} | Опыт: ${player.exp} / ${player.expToNext}`;
  }

  // --- Механика улучшений ---
  let pendingLevelUp = false;
  // --- Глобальные модификаторы для всего оружия ---
  let projectilesPerShot = 1;
  let projectileSizeMultiplier = 1;
  let extraVolley = 0;
  // --- Глобальный модификатор отталкивания ---
  let knockbackMultiplier = 1;

  // UI для выбора улучшения
  const upgradeDiv = document.createElement("div");
  upgradeDiv.style.position = "absolute";
  upgradeDiv.style.left = "0";
  upgradeDiv.style.top = "0";
  upgradeDiv.style.width = "100%";
  upgradeDiv.style.height = "100%";
  upgradeDiv.style.display = "flex";
  upgradeDiv.style.alignItems = "center";
  upgradeDiv.style.justifyContent = "center";
  upgradeDiv.style.background = "rgba(0,0,0,0.7)";
  upgradeDiv.style.color = "#fff";
  upgradeDiv.style.fontSize = "32px";
  upgradeDiv.style.fontFamily = "sans-serif";
  upgradeDiv.style.zIndex = "200";
  upgradeDiv.style.display = "none";
  appDiv.appendChild(upgradeDiv);

  // --- Экран выбора стартового оружия ---
  let gameStarted = false;
  const startDiv = document.createElement("div");
  startDiv.style.position = "absolute";
  startDiv.style.left = "0";
  startDiv.style.top = "0";
  startDiv.style.width = "100%";
  startDiv.style.height = "100%";
  startDiv.style.display = "flex";
  startDiv.style.alignItems = "center";
  startDiv.style.justifyContent = "center";
  startDiv.style.background = "rgba(0,0,0,0.85)";
  startDiv.style.color = "#fff";
  startDiv.style.fontSize = "32px";
  startDiv.style.fontFamily = "sans-serif";
  startDiv.style.zIndex = "300";
  startDiv.innerHTML = `<div style='text-align:center;'>
    <div style='margin-bottom:32px;'>Выберите стартовое оружие</div>
    <button id='start_autoGun' style='font-size:28px;padding:16px 32px;margin:8px;'>Auto Gun</button>
    <button id='start_melee' style='font-size:28px;padding:16px 32px;margin:8px;'>Melee</button>
    <button id='start_club' style='font-size:28px;padding:16px 32px;margin:8px;'>Club</button>
  </div>`;
  appDiv.appendChild(startDiv);

  let ownedWeapons: Record<WeaponType, WeaponState> = {
    autoGun: { type: "autoGun", level: 0 },
    melee: { type: "melee", level: 0 },
    club: { type: "club", level: 0 },
  };

  function startGameWithWeapon(w: WeaponType) {
    ownedWeapons[w].level = 1;
    gameStarted = true;
    startDiv.style.display = "none";
  }
  document
    .getElementById("start_autoGun")
    ?.addEventListener("click", () => startGameWithWeapon("autoGun"));
  document
    .getElementById("start_melee")
    ?.addEventListener("click", () => startGameWithWeapon("melee"));
  document
    .getElementById("start_club")
    ?.addEventListener("click", () => startGameWithWeapon("club"));

  // --- Смена оружия ---
  const weaponList: WeaponType[] = ["autoGun", "melee", "club"];
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyQ") {
      const idx = weaponList.indexOf(currentWeapon);
      currentWeapon = weaponList[(idx + 1) % weaponList.length];
    }
  });

  // --- UI для уровней оружия и модификаторов ---
  const upgradesDiv = document.createElement("div");
  upgradesDiv.style.position = "absolute";
  upgradesDiv.style.left = "0";
  upgradesDiv.style.top = "0";
  upgradesDiv.style.width = "100%";
  upgradesDiv.style.textAlign = "center";
  upgradesDiv.style.color = "#fff";
  upgradesDiv.style.fontSize = "18px";
  upgradesDiv.style.fontFamily = "sans-serif";
  upgradesDiv.style.zIndex = "20";
  upgradesDiv.style.marginTop = "8px";
  appDiv.appendChild(upgradesDiv);

  function updateUpgradesUI() {
    upgradesDiv.innerHTML =
      `Оружие: ` +
      weaponList
        .map(
          (w) =>
            `${weaponsConfig[w].name} <b>[${ownedWeapons[w]?.level ?? 0}]</b>`
        )
        .join(" | ") +
      `<br>Модификаторы: +${projectilesPerShot} Projectile | x${projectileSizeMultiplier} Size | +${extraVolley} Volley | x${knockbackMultiplier} Knockback`;
  }

  function showUpgradeChoice() {
    // Собираем доступные улучшения
    const upgrades = [];
    // Новое оружие
    for (const w of weaponList) {
      if (!ownedWeapons[w] || ownedWeapons[w].level === 0) {
        upgrades.push({
          id: `weapon_${w}`,
          label: `Новое оружие: ${weaponsConfig[w].name}`,
          action: () => {
            ownedWeapons[w].level = 1;
          },
        });
      }
    }
    // Улучшения оружия
    for (const w of weaponList) {
      if (
        ownedWeapons[w] &&
        ownedWeapons[w].level > 0 &&
        ownedWeapons[w].level < 5
      ) {
        upgrades.push({
          id: `upgrade_${w}`,
          label: `Улучшить ${weaponsConfig[w].name} (ур. ${
            ownedWeapons[w].level + 1
          })`,
          action: () => {
            ownedWeapons[w].level++;
          },
        });
      }
    }
    // --- Глобальные модификаторы ---
    upgrades.push({
      id: `mod_proj`,
      label: `+1 Projectile (глобально)`,
      action: () => {
        projectilesPerShot++;
      },
    });
    upgrades.push({
      id: `mod_size`,
      label: `Увеличить размер снаряда (глобально)`,
      action: () => {
        projectileSizeMultiplier += 0.5;
      },
    });
    upgrades.push({
      id: `mod_volley`,
      label: `Двойной выстрел (глобально)`,
      action: () => {
        extraVolley++;
      },
    });
    upgrades.push({
      id: `mod_knockback`,
      label: `Увеличить отталкивание (глобально)`,
      action: () => {
        knockbackMultiplier += 0.5;
      },
    });
    // Перемешиваем и берём первые 3
    const shuffled = upgrades.sort(() => Math.random() - 0.5).slice(0, 3);
    upgradeDiv.innerHTML = `<div style='text-align:center;'>
      <div style='margin-bottom:32px;'>Выберите улучшение</div>
      ${shuffled
        .map(
          (u, i) =>
            `<button id='upgrade${
              i + 1
            }' style='font-size:28px;padding:16px 32px;margin:8px;'>${
              u.label
            }</button>`
        )
        .join("")}
    </div>`;
    upgradeDiv.style.display = "flex";
    pendingLevelUp = true;
    app.ticker.stop();
    shuffled.forEach((u, i) => {
      document
        .getElementById(`upgrade${i + 1}`)
        ?.addEventListener("click", () => {
          u.action();
          hideUpgradeChoice();
        });
    });
  }

  function hideUpgradeChoice() {
    upgradeDiv.style.display = "none";
    pendingLevelUp = false;
    app.ticker.start();
  }

  // --- После инициализации игрока ---
  const origAddExp = player.addExp.bind(player);
  player.addExp = (amount: number) => {
    const prevLevel = player.level;
    origAddExp(amount);
    if (player.level > prevLevel) {
      showUpgradeChoice();
    }
  };

  // --- Мировые координаты ---
  let worldX = 0; // координаты центра экрана (игрока) в мире
  let worldY = 0;

  // --- Параметры чанков ---
  const CHUNK_SIZE = 512;
  const VISIBLE_RADIUS = 2; // сколько чанков вокруг игрока отрисовывать

  // --- Инертная камера ---
  let cameraX = 0;
  let cameraY = 0;

  // --- Позиционирование объектов относительно камеры ---
  // Препятствия
  function updateObstaclesScreenPositions() {
    for (const key in obstaclesByChunk) {
      for (const o of obstaclesByChunk[key]) {
        o.sprite.x = o.x - cameraX + app.screen.width / 2;
        o.sprite.y = o.y - cameraY + app.screen.height / 2;
      }
    }
  }

  // --- Таймер игры ---
  let gameTime = 0; // в секундах
  let lastWaveTime = 0;
  let lastBuffTime = 0;
  let enemyHealthBuff = 0;
  let enemySpeedBuff = 0;
  let frameCount = 0;

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function spawnBigWave() {
    // Спавним волну из 24 врагов по кругу вокруг игрока
    const N = 24;
    const R = 320;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const x = player.x + Math.cos(angle) * R;
      const y = player.y + Math.sin(angle) * R;
      const enemy = new Enemy(x, y, 7 + Math.floor(Math.random() * 3));
      enemy.health += enemyHealthBuff;
      enemy.speed = 2.1 + enemySpeedBuff + Math.random() * 0.5;
      enemy.enemyBuffLevel = (typeof enemyHealthBuff === 'number' ? Math.floor(enemyHealthBuff / 2) : 0);
      enemy.sprite.x = enemy.x - cameraX + app.screen.width / 2;
      enemy.sprite.y = enemy.y - cameraY + app.screen.height / 2;
      enemies.push(enemy);
      app.stage.addChild(enemy.sprite);
    }
  }

  // --- UI для победы ---
  const winDiv = document.createElement("div");
  winDiv.style.position = "absolute";
  winDiv.style.left = "0";
  winDiv.style.top = "0";
  winDiv.style.width = "100%";
  winDiv.style.height = "100%";
  winDiv.style.display = "flex";
  winDiv.style.alignItems = "center";
  winDiv.style.justifyContent = "center";
  winDiv.style.background = "rgba(0,0,0,0.85)";
  winDiv.style.color = "#fff";
  winDiv.style.fontSize = "48px";
  winDiv.style.fontFamily = "sans-serif";
  winDiv.style.zIndex = "1000";
  winDiv.style.display = "none";
  winDiv.innerHTML = `<div><div>Вы победили!<br><span style='font-size:32px'>Выжили 30 минут!</span></div><button id="restartBtnWin" style="margin-top:32px;font-size:32px;">Начать заново</button></div>`;
  appDiv.appendChild(winDiv);
  let gameWon = false;

  // --- Admin Panel ---
  const adminDiv = document.createElement("div");
  adminDiv.style.position = "absolute";
  adminDiv.style.right = "20px";
  adminDiv.style.top = "60px";
  adminDiv.style.background = "rgba(30,30,30,0.95)";
  adminDiv.style.border = "1px solid #888";
  adminDiv.style.borderRadius = "8px";
  adminDiv.style.padding = "16px";
  adminDiv.style.zIndex = "10000";
  adminDiv.style.color = "#fff";
  adminDiv.style.fontSize = "16px";
  adminDiv.style.fontFamily = "sans-serif";
  adminDiv.innerHTML = `
    <div style='font-weight:bold;margin-bottom:8px;'>Admin Panel</div>
    <div style='margin-bottom:8px;'>
      <button id='admin_add_proj' style='margin:2px;'>+Projectile</button>
      <button id='admin_add_size' style='margin:2px;'>+Size</button>
      <button id='admin_add_volley' style='margin:2px;'>+Volley</button>
      <button id='admin_add_knock' style='margin:2px;'>+Knockback</button>
    </div>
    <div style='margin-bottom:8px;'>
      <button id='admin_give_autogun' style='margin:2px;'>Give AutoGun</button>
      <button id='admin_give_melee' style='margin:2px;'>Give Melee</button>
      <button id='admin_give_club' style='margin:2px;'>Give Club</button>
    </div>
    <div style='margin-bottom:8px;'>
      <button id='admin_up_autogun' style='margin:2px;'>AutoGun +1 lvl</button>
      <button id='admin_up_melee' style='margin:2px;'>Melee +1 lvl</button>
      <button id='admin_up_club' style='margin:2px;'>Club +1 lvl</button>
    </div>
    <div style='font-size:12px;color:#aaa;'>Изменения применяются мгновенно</div>
  `;
  appDiv.appendChild(adminDiv);

  document.getElementById('admin_add_proj')?.addEventListener('click', () => { projectilesPerShot++; updateUpgradesUI(); });
  document.getElementById('admin_add_size')?.addEventListener('click', () => { projectileSizeMultiplier += 0.5; updateUpgradesUI(); });
  document.getElementById('admin_add_volley')?.addEventListener('click', () => { extraVolley++; updateUpgradesUI(); });
  document.getElementById('admin_add_knock')?.addEventListener('click', () => { knockbackMultiplier += 0.5; updateUpgradesUI(); });

  document.getElementById('admin_give_autogun')?.addEventListener('click', () => { ownedWeapons.autoGun.level = Math.max(ownedWeapons.autoGun.level, 1); updateUpgradesUI(); });
  document.getElementById('admin_give_melee')?.addEventListener('click', () => { ownedWeapons.melee.level = Math.max(ownedWeapons.melee.level, 1); updateUpgradesUI(); });
  document.getElementById('admin_give_club')?.addEventListener('click', () => { ownedWeapons.club.level = Math.max(ownedWeapons.club.level, 1); updateUpgradesUI(); });

  document.getElementById('admin_up_autogun')?.addEventListener('click', () => { if (ownedWeapons.autoGun.level > 0 && ownedWeapons.autoGun.level < 5) { ownedWeapons.autoGun.level++; updateUpgradesUI(); } });
  document.getElementById('admin_up_melee')?.addEventListener('click', () => { if (ownedWeapons.melee.level > 0 && ownedWeapons.melee.level < 5) { ownedWeapons.melee.level++; updateUpgradesUI(); } });
  document.getElementById('admin_up_club')?.addEventListener('click', () => { if (ownedWeapons.club.level > 0 && ownedWeapons.club.level < 5) { ownedWeapons.club.level++; updateUpgradesUI(); } });

  // Базовый игровой цикл
  app.ticker.add(() => {
    if (!gameStarted) return;
    if (player.health <= 0) {
      showGameOver();
      return;
    }
    // Синхронизируем мировые координаты с позицией игрока
    worldX = player.x;
    worldY = player.y;
    updateHealthUI();
    updatePlayerHpBar();
    updateExpUI();
    updateUpgradesUI();
    updateArrow();
    handlePlayerInput();

    // --- Плавное движение камеры к игроку ---
    const cameraSpeed = 0.12; // 0.1-0.2 — плавно, 1 — мгновенно
    cameraX += (player.x - cameraX) * cameraSpeed;
    cameraY += (player.y - cameraY) * cameraSpeed;

    // --- Генерация и обновление препятствий ---
    ensureObstaclesForVisibleChunks(worldX, worldY, CHUNK_SIZE, VISIBLE_RADIUS, app);
    updateObstaclesScreenPositions();

    // --- Движение врагов к игроку ---
    for (const enemy of enemies) {
      enemy.moveToward(player.x, player.y);
      // Проверка столкновения с игроком (в мировых координатах)
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (!enemy.dead && dist < 16 + 20) {
        // радиусы врага и игрока
        player.takeDamage(1);
        enemy.dead = true;
      }
    }
    // --- Коллизии враг-враг ---
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i];
        const b = enemies[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 16 * 2; // радиусы врагов
        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) / 2;
          const ox = (dx / dist) * overlap;
          const oy = (dy / dist) * overlap;
          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
        }
      }
    }
    // --- Коллизии враг-препятствие ---
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      for (const key in obstaclesByChunk) {
        for (const obs of obstaclesByChunk[key]) {
          if (circleRectCollision(enemy.x, enemy.y, 16, obs.x, obs.y, obs.w, obs.h)) {
            // Выталкиваем врага наружу по кратчайшему вектору
            // Находим ближайшую точку на прямоугольнике
            const hw = obs.w / 2;
            const hh = obs.h / 2;
            const closestX = Math.max(obs.x - hw, Math.min(enemy.x, obs.x + hw));
            const closestY = Math.max(obs.y - hh, Math.min(enemy.y, obs.y + hh));
            const dx = enemy.x - closestX;
            const dy = enemy.y - closestY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const push = 16 - Math.sqrt((enemy.x - closestX) ** 2 + (enemy.y - closestY) ** 2);
            if (push > 0) {
              enemy.x += (dx / len) * push;
              enemy.y += (dy / len) * push;
            }
          }
        }
      }
    }
    // --- Коллизии игрок-препятствие ---
    for (const key in obstaclesByChunk) {
      for (const obs of obstaclesByChunk[key]) {
        if (circleRectCollision(player.x, player.y, 20, obs.x, obs.y, obs.w, obs.h)) {
          const hw = obs.w / 2;
          const hh = obs.h / 2;
          const closestX = Math.max(obs.x - hw, Math.min(player.x, obs.x + hw));
          const closestY = Math.max(obs.y - hh, Math.min(player.y, obs.y + hh));
          const dx = player.x - closestX;
          const dy = player.y - closestY;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const push = 20 - Math.sqrt((player.x - closestX) ** 2 + (player.y - closestY) ** 2);
          if (push > 0) {
            player.x += (dx / len) * push;
            player.y += (dy / len) * push;
          }
        }
      }
    }
    // После движения и столкновений обновляем позицию спрайтов врагов
    for (const enemy of enemies) {
      enemy.sprite.x = enemy.x - cameraX + app.screen.width / 2;
      enemy.sprite.y = enemy.y - cameraY + app.screen.height / 2;
    }
    // --- Обновление экранных координат опыта ---
    for (const gem of expGems) {
      gem.sprite.x = gem.x - cameraX + app.screen.width / 2;
      gem.sprite.y = gem.y - cameraY + app.screen.height / 2;
    }
    // --- Обновление экранных координат пуль ---
    for (const bullet of bullets) {
      bullet.sprite.x = bullet.x - cameraX + app.screen.width / 2;
      bullet.sprite.y = bullet.y - cameraY + app.screen.height / 2;
    }
    // --- Игрок всегда по центру экрана ---
    player.setScreenPosition(app.screen.width / 2, app.screen.height / 2);

    // --- Кулдауны для каждого оружия ---
    for (const w of weaponList) {
      if (fireCooldowns[w] > 0) fireCooldowns[w]--;
    }

    // --- Атака всеми собранными оружиями ---
    for (const w of weaponList) {
      if (!ownedWeapons[w] || ownedWeapons[w].level === 0) continue;
      const weapon = weaponsConfig[w];
      const level = ownedWeapons[w].level;
      // Улучшаем параметры в зависимости от уровня
      const damage = weapon.damage + (level - 1);
      const fireRate = weapon.fireRate + (level - 1) * 0.5;
      const bulletSpeed = weapon.bulletSpeed + (level - 1) * 2;
      // --- AUTO GUN ---
      if (w === "autoGun") {
        if (fireCooldowns[w] > 0 || pendingLevelUp) continue;
        for (let volley = 0; volley <= extraVolley; volley++) {
          let availableEnemies = enemies.filter(e => !e.dead);
          for (let i = 0; i < projectilesPerShot; i++) {
            let target: Enemy | null = null;
            let minDist = weapon.range;
            for (const enemy of availableEnemies.length > 0 ? availableEnemies : enemies.filter(e => !e.dead)) {
              const dx = enemy.x - player.x;
              const dy = enemy.y - player.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDist) {
                minDist = dist;
                target = enemy;
              }
            }
            if (target && availableEnemies.length > 0) {
              const idx = availableEnemies.indexOf(target);
              if (idx !== -1) availableEnemies.splice(idx, 1);
            }
            if (target) {
              const angle = Math.atan2(target.y - player.y, target.x - player.x) + (volley * Math.PI) / 32;
              const dx = Math.cos(angle);
              const dy = Math.sin(angle);
              const bullet = new Bullet(
                player.x,
                player.y,
                dx,
                dy,
                {
                  speed: bulletSpeed,
                  radius: weapon.bulletRadius * projectileSizeMultiplier,
                  color: weapon.color,
                  damage: damage,
                }
              );
              bullet["bounces"] = level >= 5 ? 2 : 0; // для рикошета
              bullets.push(bullet);
              app.stage.addChild(bullet.sprite);
            }
          }
        }
        fireCooldowns[w] = Math.round(60 / fireRate); // индивидуальный кулдаун
      }
      // --- MELEE ---
      if (w === "melee") {
        if (fireCooldowns[w] > 0 || pendingLevelUp) continue;
        if (level < 5) {
          const len = Math.sqrt(lastMoveDir.x * lastMoveDir.x + lastMoveDir.y * lastMoveDir.y) || 1;
          const dirX = lastMoveDir.x / len;
          const dirY = lastMoveDir.y / len;
          const delay = 60; // мс между ударами
          for (let volley = 0; volley <= extraVolley; volley++) {
            for (let i = 0; i < projectilesPerShot; i++) {
              setTimeout(() => {
                const distFactor = (i + 1) / (projectilesPerShot + 1);
                const px = player.x + dirX * weapon.range * distFactor;
                const py = player.y + dirY * weapon.range * distFactor;
                const melee = new Bullet(px, py, 0, 0, {
                  speed: 0,
                  radius: weapon.bulletRadius * projectileSizeMultiplier,
                  color: weapon.color,
                  damage: damage,
                });
                bullets.push(melee);
                app.stage.addChild(melee.sprite);
                for (const enemy of enemies) {
                  if (enemy.dead) continue;
                  const ex = enemy.x - melee.x;
                  const ey = enemy.y - melee.y;
                  const dist = Math.sqrt(ex * ex + ey * ey);
                  if (dist < weapon.bulletRadius * projectileSizeMultiplier + 16) {
                    enemy.takeDamage(damage);
                  }
                }
                setTimeout(() => {
                  if (melee.alive) {
                    app.stage.removeChild(melee.sprite);
                    melee.alive = false;
                  }
                }, 100);
              }, i * delay + volley * 80);
            }
          }
        } else {
          // 5 уровень: атака по области (8 направлений)
          const angles = Array.from({ length: 8 }, (_, k) => (k * Math.PI) / 4);
          for (const angle of angles) {
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            const px = player.x + dirX * weapon.range * 0.7;
            const py = player.y + dirY * weapon.range * 0.7;
            const melee = new Bullet(px, py, 0, 0, {
              speed: 0,
              radius: weapon.bulletRadius * projectileSizeMultiplier,
              color: weapon.color,
              damage: damage,
            });
            bullets.push(melee);
            app.stage.addChild(melee.sprite);
            for (const enemy of enemies) {
              if (enemy.dead) continue;
              const ex = enemy.x - melee.x;
              const ey = enemy.y - melee.y;
              const dist = Math.sqrt(ex * ex + ey * ey);
              if (dist < weapon.bulletRadius * projectileSizeMultiplier + 16) {
                enemy.takeDamage(damage);
              }
            }
            setTimeout(() => {
              if (melee.alive) {
                app.stage.removeChild(melee.sprite);
                melee.alive = false;
              }
            }, 100);
          }
        }
        fireCooldowns[w] = Math.round(60 / fireRate);
      }
      // --- CLUB ---
      if (w === "club") {
        if (fireCooldowns[w] > 0 || pendingLevelUp) continue;
        const len = Math.sqrt(lastMoveDir.x * lastMoveDir.x + lastMoveDir.y * lastMoveDir.y) || 1;
        const dirX = lastMoveDir.x / len;
        const dirY = lastMoveDir.y / len;
        const delay = 80; // мс между взмахами
        for (let i = 0; i < projectilesPerShot; i++) {
          setTimeout(() => {
            const isFront = i % 2 === 0;
            const swingDir = isFront ? 1 : -1;
            const baseAngle = Math.atan2(dirY, dirX);
            const swingStart = baseAngle - (swingDir * Math.PI) / 6;
            const swingEnd = baseAngle + (swingDir * Math.PI) / 6;
            const clubLength = 100;
            const clubWidth =
              weapon.bulletRadius * projectileSizeMultiplier * 0.4;
            const clubOffset = 50;
            let swingAngle = swingStart;
            const club = new PIXI.Graphics();
            club.beginFill(weapon.color);
            club.drawRect(
              -clubLength * 0.2,
              -clubWidth / 2,
              clubLength,
              clubWidth
            );
            club.endFill();
            app.stage.addChild(club);
            const swingFrames = 12;
            let frame = 0;
            const hitEnemies = new Set();
            function animateSwing() {
              frame++;
              swingAngle =
                swingStart + (swingEnd - swingStart) * (frame / swingFrames);
              club.x = app.screen.width / 2 + Math.cos(swingAngle) * clubOffset;
              club.y = app.screen.height / 2 + Math.sin(swingAngle) * clubOffset;
              club.rotation = swingAngle;
              // Проверка попадания на каждом кадре
              for (const enemy of enemies) {
                if (enemy.dead || hitEnemies.has(enemy)) continue;
                const ex = (enemy.x - cameraX + app.screen.width / 2) - club.x;
                const ey = (enemy.y - cameraY + app.screen.height / 2) - club.y;
                const relAngle = -club.rotation;
                const rx = Math.cos(relAngle) * ex - Math.sin(relAngle) * ey;
                const ry = Math.sin(relAngle) * ex + Math.cos(relAngle) * ey;
                if (
                  rx > -clubLength * 0.2 &&
                  rx < clubLength * 0.8 &&
                  Math.abs(ry) < clubWidth / 2
                ) {
                  enemy.takeDamage(damage);
                  hitEnemies.add(enemy);
                  const kb =
                    (weapon.knockback + (ownedWeapons[w]?.level ?? 1) * 2) *
                    knockbackMultiplier;
                  const len2 = Math.sqrt(ex * ex + ey * ey) || 1;
                  enemy.sprite.x -= (ex / len2) * kb;
                  enemy.sprite.y -= (ey / len2) * kb;
                }
              }
              if (frame < swingFrames) {
                requestAnimationFrame(animateSwing);
              } else {
                app.stage.removeChild(club);
              }
            }
            animateSwing();
          }, i * delay);
        }
        fireCooldowns[w] = Math.round(60 / fireRate);
      }
    }

    // Спавн врагов
    enemySpawnTimer++;
    if (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL) {
      spawnEnemy();
      enemySpawnTimer = 0;
    }

    // --- Обновление и удаление пуль ---
    for (const bullet of bullets) {
      bullet.update();
      // Удаляем пулю, если она вышла за пределы экрана
      if (
        bullet.sprite.x < -20 ||
        bullet.sprite.x > app.screen.width + 20 ||
        bullet.sprite.y < -20 ||
        bullet.sprite.y > app.screen.height + 20
      ) {
        bullet.alive = false;
      }
    }
    // Удаляем неактивные пули со сцены и из массива
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (!bullets[i].alive) {
        app.stage.removeChild(bullets[i].sprite);
        bullets.splice(i, 1);
      }
    }

    // --- Столкновения пуль с врагами ---
    bulletLoop: for (const bullet of bullets) {
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        const dx = bullet.sprite.x - enemy.sprite.x;
        const dy = bullet.sprite.y - enemy.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 16 + bullet.radius) {
          // --- Рикошет для autoGun 5 уровня ---
          if (bullet.bounces && bullet.bounces > 0) {
            // Найти ближайшего другого врага
            let nextTarget: Enemy | null = null;
            let minDist = Infinity;
            for (const e2 of enemies) {
              if (e2 === enemy || e2.dead) continue;
              const d2 = Math.sqrt(
                (e2.x - enemy.x) ** 2 +
                (e2.y - enemy.y) ** 2
              );
              if (d2 < minDist) {
                minDist = d2;
                nextTarget = e2;
              }
            }
            if (nextTarget) {
              // Перенаправляем пулю к новому врагу
              const ricochetDx = nextTarget.x - enemy.x;
              const ricochetDy = nextTarget.y - enemy.y;
              const len = Math.sqrt(ricochetDx * ricochetDx + ricochetDy * ricochetDy) || 1;
              bullet.dx = ricochetDx / len;
              bullet.dy = ricochetDy / len;
              bullet.x = enemy.x; // старт рикошета с позиции поражённого врага
              bullet.y = enemy.y;
              bullet.sprite.x = bullet.x - cameraX + app.screen.width / 2;
              bullet.sprite.y = bullet.y - cameraY + app.screen.height / 2;
              bullet.bounces--;
              // Пуля не уничтожается, не наносит урон, не попадает в других врагов в этот кадр
              continue bulletLoop;
            }
          }
          // Если рикошета нет или не найдено цели — обычное поведение
          bullet.alive = false;
          enemy.takeDamage(bullet.damage);
          // --- ОТТАЛКИВАНИЕ ---
          const w = bullet.bounces !== undefined ? "autoGun" : "melee";
          const kb =
            (weaponsConfig[w].knockback + (ownedWeapons[w]?.level ?? 1) * 2) *
            knockbackMultiplier;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          enemy.sprite.x -= (dx / len) * kb;
          enemy.sprite.y -= (dy / len) * kb;
          // После обычного попадания — не попадаем в других врагов
          break;
        }
      }
    }

    // --- Удаляем убитых врагов, дропаем опыт ---
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].dead) {
        // Дроп опыта
        const buff = enemies[i].enemyBuffLevel || 0;
        const expValue = 7 * (1 + 2 * buff);
        const gem = new ExpGem(enemies[i].x, enemies[i].y, expValue);
        gem.sprite.x = gem.x - cameraX + app.screen.width / 2;
        gem.sprite.y = gem.y - cameraY + app.screen.height / 2;
        expGems.push(gem);
        app.stage.addChild(gem.sprite);
        app.stage.removeChild(enemies[i].sprite);
        enemies[i].sprite.destroy();
        enemies.splice(i, 1);
      }
    }
    // --- Сбор опыта игроком ---
    for (const gem of expGems) {
      const dx = gem.x - player.x;
      const dy = gem.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20 + 8 && gem.alive) {
        player.addExp(gem.value);
        gem.alive = false;
      }
    }
    // Удаляем собранные гемы
    for (let i = expGems.length - 1; i >= 0; i--) {
      if (!expGems[i].alive) {
        app.stage.removeChild(expGems[i].sprite);
        expGems.splice(i, 1);
      }
    }

    // --- Таймер ---
    frameCount++;
    if (frameCount % 60 === 0) { // раз в секунду
      gameTime++;
      timerDiv.textContent = `Время: ${formatTime(gameTime)}`;
    }
    // --- Волна врагов раз в 1.5 минуты ---
    if (gameTime > 0 && gameTime % 90 === 0 && lastWaveTime !== gameTime) {
      spawnBigWave();
      lastWaveTime = gameTime;
    }
    // --- Усиление врагов раз в 3 минуты ---
    if (gameTime > 0 && gameTime % 180 === 0 && lastBuffTime !== gameTime) {
      enemyHealthBuff += 1;
      enemySpeedBuff += 0.18;
      lastBuffTime = gameTime;
    }
    // --- Победа: прожить 30 минут ---
    if (!gameWon && gameTime >= 1800) {
      winDiv.style.display = "flex";
      app.ticker.stop();
      gameWon = true;
    }
  });
})();
