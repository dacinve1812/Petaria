import Phaser from 'phaser';
import { HERO_FRAME_SIZE } from '../config/huntingConfig';
import { getHuntingMap, normalizeHuntingMapRecord } from '../map/mapRegistry.js';

export default class PreloadScene extends Phaser.Scene {
  constructor(initData = {}) {
    super('PreloadScene');
    this.selectedMapId = initData.selectedMapId;
    this.mapOverrideRaw = initData.mapOverride != null ? initData.mapOverride : null;
    this.huntingMap = null;
  }

  init(data) {
    if (data && data.selectedMapId) this.selectedMapId = data.selectedMapId;
    if (data && data.mapOverride != null) this.mapOverrideRaw = data.mapOverride;
    this.huntingMap =
      this.mapOverrideRaw != null
        ? normalizeHuntingMapRecord(this.mapOverrideRaw)
        : getHuntingMap(this.selectedMapId);
  }

  preload() {
    const map =
      this.mapOverrideRaw != null
        ? normalizeHuntingMapRecord(this.mapOverrideRaw)
        : getHuntingMap(this.selectedMapId);

    this.load.image('hunting-map-bg', map.assets.background);
    if (map.assets.foreground) {
      this.load.image('hunting-map-fg', map.assets.foreground);
    }

    this.load.spritesheet('hero', '/hunting/sprites/hero6.png', {
      frameWidth: HERO_FRAME_SIZE,
      frameHeight: HERO_FRAME_SIZE,
    });

    const g = this.add.graphics();
    g.fillStyle(0x4caf50, 1);
    g.fillRect(0, 0, HERO_FRAME_SIZE, HERO_FRAME_SIZE);
    g.lineStyle(2, 0x0d3b1d, 1);
    g.strokeRect(1, 1, HERO_FRAME_SIZE - 2, HERO_FRAME_SIZE - 2);
    g.generateTexture('hero-fallback', HERO_FRAME_SIZE, HERO_FRAME_SIZE);
    g.destroy();
  }

  create() {
    this.scene.start('MainScene', {
      selectedMapId: this.selectedMapId,
      mapOverride: this.mapOverrideRaw,
    });
  }
}
