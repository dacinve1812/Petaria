import Phaser from 'phaser';
import { CAMERA_ZOOM, HERO_COLLIDER_OFFSET, HERO_COLLIDER_SIZE, HERO_SCALE } from '../config/huntingConfig';

export default class MainScene extends Phaser.Scene {
  constructor(initData = {}) {
    super('MainScene');
    this.selectedMapId = initData.selectedMapId;
    this.player = null;
    this.cursors = null;
    this.hasHeroAnimations = false;
    this.facingDirection = 'down';
    this.framesPerDirection = 0;
    this.standFrame = { down: 0, left: 0, right: 0, up: 0 };
  }

  init(data) {
    if (data && data.selectedMapId) this.selectedMapId = data.selectedMapId;
  }

  create() {
    // Display large forest-map image as a temporary background.
    // Later we will switch to a Tiled JSON tilemap with collisions.
    const bg = this.add.image(0, 0, 'forest-map').setOrigin(0, 0);

    // Enable world bounds to image size
    const worldWidth = bg.width;
    const worldHeight = bg.height;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Create placeholder player
    // Use provided hero spritesheet if available with enough frames, else fallback
    const hasHeroSheet = this.textures.exists('hero') && this.textures.get('hero').frameTotal >= 12;
    const textureKey = hasHeroSheet ? 'hero' : 'hero-fallback';
    this.player = this.physics.add.sprite(160, 160, textureKey, 0);
    if (textureKey !== 'hero-fallback') {
      this.player.setScale(HERO_SCALE);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setSize(HERO_COLLIDER_SIZE, HERO_COLLIDER_SIZE).setOffset(HERO_COLLIDER_OFFSET.x, HERO_COLLIDER_OFFSET.y);

    // Simple 4-direction animations if spritesheet exists
    if (hasHeroSheet) {
      const total = this.textures.get('hero').frameTotal;
      // Support 12 (3 frames/dir) or 16 (4 frames/dir)
      this.framesPerDirection = Math.floor(total / 4);
      const fpd = this.framesPerDirection;
      if ((fpd === 3 || fpd === 4) && !this.anims.exists('walk-down')) {
        const ranges = {
          down: { start: 0, end: fpd - 1 },
          left: { start: fpd, end: 2 * fpd - 1 },
          right: { start: 2 * fpd, end: 3 * fpd - 1 },
          up: { start: 3 * fpd, end: 4 * fpd - 1 },
        };
        this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('hero', ranges.down), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('hero', ranges.left), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('hero', ranges.right), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('hero', ranges.up), frameRate: 8, repeat: -1 });
        // Choose a stand frame per direction (center frame for 3, second for 4)
        this.standFrame.down = ranges.down.start + (fpd === 3 ? 1 : 1);
        this.standFrame.left = ranges.left.start + (fpd === 3 ? 1 : 1);
        this.standFrame.right = ranges.right.start + (fpd === 3 ? 1 : 1);
        this.standFrame.up = ranges.up.start + (fpd === 3 ? 1 : 1);
        this.hasHeroAnimations = true;
      }
    }

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(CAMERA_ZOOM);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    if (!this.player || !this.cursors) return;
    const speed = 100;
    const body = this.player.body;
    body.setVelocity(0, 0);

    let anim = null;
    if (this.cursors.left.isDown) {
      body.setVelocityX(-speed);
      anim = 'walk-left';
      this.facingDirection = 'left';
    } else if (this.cursors.right.isDown) {
      body.setVelocityX(speed);
      anim = 'walk-right';
      this.facingDirection = 'right';
    }
    if (this.cursors.up.isDown) {
      body.setVelocityY(-speed);
      anim = 'walk-up';
      this.facingDirection = 'up';
    } else if (this.cursors.down.isDown) {
      body.setVelocityY(speed);
      anim = 'walk-down';
      this.facingDirection = 'down';
    }

    if (this.hasHeroAnimations) {
      if (body.velocity.length() === 0) {
        // Maintain last facing: stop current anim and set standing frame
        if (this.player.anims.isPlaying) this.player.anims.stop();
        const frameIndex = this.standFrame[this.facingDirection] ?? 0;
        if (this.player.texture && this.player.texture.key === 'hero') {
          this.player.setFrame(frameIndex);
        }
      } else {
        if (anim) this.player.anims.play(anim, true);
        body.velocity.normalize().scale(speed);
      }
    } else {
      // No animations available; still keep movement speed consistent
      if (body.velocity.length() > 0) {
        body.velocity.normalize().scale(speed);
      }
    }
  }
}


