export const weaponsConfig = {
  autoGun: {
    name: 'Auto Gun',
    fireRate: 1, // выстрелов в секунду
    bulletSpeed: 8,
    bulletRadius: 6,
    damage: 1,
    color: 0xffff00,
    range: 600 as number,
    knockback: 8,
  },
  melee: {
    name: 'Melee',
    fireRate: 2, // ударов в секунду
    bulletSpeed: 16, // скорость "удара" (визуально)
    bulletRadius: 24, // радиус удара
    damage: 2,
    color: 0xff66cc,
    range: 80 as number,
    knockback: 18,
  },
  club: {
    name: 'Club',
    fireRate: 1.2,
    bulletSpeed: 0,
    bulletRadius: 40,
    damage: 3,
    color: 0x996633,
    range: 90 as number,
    knockback: 24,
  },
  // Здесь будут другие виды оружия
} as const;

export type WeaponType = keyof typeof weaponsConfig; 