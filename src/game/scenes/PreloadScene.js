import Phaser from 'phaser';
import { HERO_FRAME_SIZE } from '../config/huntingConfig';

export default class PreloadScene extends Phaser.Scene {
  constructor(initData = {}) {
    super('PreloadScene');
    this.selectedMapId = initData.selectedMapId;
  }

  init(data) {
    // Allow scene transitions to override selectedMapId
    if (data && data.selectedMapId) this.selectedMapId = data.selectedMapId;
  }

  preload() {
    // For now, we load a static image map as background to unblock collisions work
    // Place your forest map image under public/hunting/maps/forest-map.png
    this.load.image('forest-map', '/hunting/maps/forest-map.png');

    // Load hero spritesheet. HERO_FRAME_SIZE defines source frame (e.g., 64),
    // we scale in scene to desired display size.
    this.load.spritesheet('hero', '/hunting/sprites/hero.png', {
      frameWidth: HERO_FRAME_SIZE,
      frameHeight: HERO_FRAME_SIZE,
    });

    // Always prepare a fallback texture in case hero.png is not provided
    const g = this.add.graphics();
    g.fillStyle(0x4caf50, 1);
    g.fillRect(0, 0, HERO_FRAME_SIZE, HERO_FRAME_SIZE);
    g.lineStyle(2, 0x0d3b1d, 1);
    g.strokeRect(1, 1, HERO_FRAME_SIZE - 2, HERO_FRAME_SIZE - 2);
    g.generateTexture('hero-fallback', HERO_FRAME_SIZE, HERO_FRAME_SIZE);
    g.destroy();
  }

  create() {
    this.scene.start('MainScene', { selectedMapId: this.selectedMapId });
  }
}


