import Phaser from 'phaser';
import {
  CAMERA_ZOOM,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  HERO_COLLIDER_OFFSET,
  HERO_COLLIDER_SIZE,
  HERO_SCALE,
  HERO_TILE_Y_OFFSET,
  MOVE_SPEED_MAX,
  MOVE_SPEED_MIN,
} from '../config/huntingConfig';
import { PLAYER_CONFIG } from '../config/playerConfig';
import { getHuntingMap, normalizeHuntingMapRecord } from '../map/mapRegistry.js';
import { TILE } from '../map/tiles.js';
import { EncounterManager } from '../managers/EncounterManager.js';
import {
  loadHuntingSession,
  saveHuntingSession,
  clearHuntingSessionIfOtherMap,
} from '../../utils/huntingSessionStorage.js';

const DIR = {
  left: { dx: -1, dy: 0, anim: 'left' },
  right: { dx: 1, dy: 0, anim: 'right' },
  up: { dx: 0, dy: -1, anim: 'up' },
  down: { dx: 0, dy: 1, anim: 'down' },
};

function setTextureFilter(scene, key, filterMode) {
  if (!scene.textures.exists(key)) return;
  scene.textures.get(key).setFilter(filterMode);
}

export default class MainScene extends Phaser.Scene {
  constructor(initData = {}) {
    super('MainScene');
    this.selectedMapId = initData.selectedMapId;
    this.mapOverrideRaw = initData.mapOverride != null ? initData.mapOverride : null;
    this.player = null;
    this.huntingMap = null;
    this.mapData = null;
    this.gridX = 0;
    this.gridY = 0;
    this.isMoving = false;
    this.stepTween = null;
    this.hasHeroAnimations = false;
    this.facingDirection = 'down';
    this.framesPerDirection = 0;
    this.standFrame = { down: 0, left: 0, right: 0, up: 0 };
    this.walkOnceDurationMs = 320;
    this.moveSpeedMultiplier = 1;
    this.defaultCameraZoom = CAMERA_ZOOM;
    this.cameraZoom = CAMERA_ZOOM;
    this.worldWidth = 0;
    this.worldHeight = 0;

    /** @type {string|null} */
    this.dpadHoldDir = null;
    /** @type {number|null} giới hạn bước từ map; null = không giới hạn */
    this.mapMaxSteps = null;
    /** @type {number|null} */
    this.stepsRemaining = null;
    this._lastDpadHoldPoll = 0;
    /** Hết bước: khóa di chuyển, UI hiện modal */
    this.huntingStepsExhausted = false;

    this.cursors = null;
    this.keyW = null;
    this.keyA = null;
    this.keyS = null;
    this.keyD = null;

    this.encounterManager = null;
    this.isEncounterModalOpen = false;

    this._onHuntingInput = null;
    this._onEncounterModalClosed = null;
  }

  init(data) {
    if (data && data.selectedMapId) this.selectedMapId = data.selectedMapId;
    if (data && data.mapOverride != null) this.mapOverrideRaw = data.mapOverride;
    this.mapData =
      this.mapOverrideRaw != null
        ? normalizeHuntingMapRecord(this.mapOverrideRaw)
        : getHuntingMap(this.selectedMapId);
    this.huntingMap = this.mapData;
  }

  get tileSize() {
    return this.mapData ? this.mapData.tileSize : PLAYER_CONFIG.TILE_SIZE;
  }

  tileIndex(gx, gy) {
    return gy * this.mapData.width + gx;
  }

  getTile(gx, gy) {
    if (gx < 0 || gx >= this.mapData.width || gy < 0 || gy >= this.mapData.height) {
      return TILE.WALL;
    }
    return this.mapData.tiles[this.tileIndex(gx, gy)];
  }

  isWalkable(gx, gy) {
    return this.getTile(gx, gy) !== TILE.WALL;
  }

  isEncounterTile(gx, gy) {
    return this.getTile(gx, gy) === TILE.ENCOUNTER;
  }

  tileCenterWorld(gx, gy) {
    return {
      x: (gx + 0.5) * this.tileSize,
      y: (gy + 0.5) * this.tileSize + HERO_TILE_Y_OFFSET,
    };
  }

  resolveStartTile() {
    const { x, y } = this.mapData.start;
    if (this.isWalkable(x, y)) return { gx: x, gy: y };
    for (let gy = 0; gy < this.mapData.height; gy++) {
      for (let gx = 0; gx < this.mapData.width; gx++) {
        if (this.isWalkable(gx, gy)) return { gx, gy };
      }
    }
    return { gx: 0, gy: 0 };
  }

  create() {
    const map = this.mapData;
    clearHuntingSessionIfOtherMap(this.selectedMapId);

    const bg = this.add.image(0, 0, 'hunting-map-bg').setOrigin(0, 0);
    bg.setDepth(0);
    // pixelArt toàn game = NEAREST; với ảnh nền độ phân giải cao thu nhỏ xuống canvas, LINEAR giữ chi tiết mượt hơn.
    setTextureFilter(this, 'hunting-map-bg', Phaser.Textures.FilterMode.LINEAR);

    // Luôn khớp thế giới với lưới logic: width×tileSize × height×tileSize (giống Admin: ảnh stretch full lưới).
    // Nếu dùng kích thước pixel gốc của ảnh khi lưới nhỏ hơn (vd forest 800×640 với map 30×20@16),
    // va chạm / spawn chỉ khớp góc trên-trái — nhìn như "sai block" và sai start.
    const worldWidth = map.width * this.tileSize;
    const worldHeight = map.height * this.tileSize;
    const natW = bg.width;
    const natH = bg.height;
    if (natW !== worldWidth || natH !== worldHeight) {
      console.warn(
        `[hunting map "${map.id}"] Ảnh nền ${natW}×${natH}px ≠ lưới ${worldWidth}×${worldHeight}px (width×tileSize × height×tileSize). Đã scale để khớp lưới.`
      );
      bg.setDisplaySize(worldWidth, worldHeight);
    }
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    this.mapMaxSteps = map.maxSteps != null ? map.maxSteps : null;
    this.stepsRemaining = this.mapMaxSteps != null ? this.mapMaxSteps : null;

    const start = this.resolveStartTile();
    this.gridX = start.gx;
    this.gridY = start.gy;

    const saved = loadHuntingSession(this.selectedMapId, this.mapMaxSteps);
    if (saved) {
      this.stepsRemaining = saved.stepsRemaining;
      if (
        saved.gridX != null &&
        saved.gridY != null &&
        this.isWalkable(saved.gridX, saved.gridY)
      ) {
        this.gridX = saved.gridX;
        this.gridY = saved.gridY;
      }
    }

    const spawn = this.tileCenterWorld(this.gridX, this.gridY);

    const hasHeroSheet = this.textures.exists('hero') && this.textures.get('hero').frameTotal >= 12;
    const textureKey = hasHeroSheet ? 'hero' : 'hero-fallback';

    this.player = this.physics.add.sprite(spawn.x, spawn.y, textureKey, 0);
    if (textureKey !== 'hero-fallback') {
      this.player.setScale(HERO_SCALE);
    }
    this.player.setCollideWorldBounds(true);
    this.player
      .setSize(HERO_COLLIDER_SIZE, HERO_COLLIDER_SIZE)
      .setOffset(HERO_COLLIDER_OFFSET.x, HERO_COLLIDER_OFFSET.y);
    this.player.setDepth(1);

    if (hasHeroSheet) {
      this.setupHeroAnimations();
    }

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    // Auto-fit ngay lần đầu vào map để giảm khoảng trống nền ở map tỉ lệ lạ.
    this.defaultCameraZoom = this.getFitZoom();
    this.cameraZoom = this.defaultCameraZoom;
    this.cameras.main.setZoom(this.cameraZoom);
    this.updateCameraBoundsForZoom();

    if (map.assets.foreground && this.textures.exists('hunting-map-fg')) {
      const foreground = this.add.image(0, 0, 'hunting-map-fg').setOrigin(0, 0);
      setTextureFilter(this, 'hunting-map-fg', Phaser.Textures.FilterMode.LINEAR);
      const fgw = foreground.width;
      const fgh = foreground.height;
      if (fgw !== worldWidth || fgh !== worldHeight) {
        foreground.setDisplaySize(worldWidth, worldHeight);
      }
      foreground.setDepth(2);
    }

    setTextureFilter(this, 'hero', Phaser.Textures.FilterMode.NEAREST);
    setTextureFilter(this, 'hero-fallback', Phaser.Textures.FilterMode.NEAREST);

    this.children.sort('depth');

    window.dispatchEvent(
      new CustomEvent('petaria-hunting-camera-state', {
        detail: { zoom: this.cameraZoom },
      })
    );
    window.dispatchEvent(
      new CustomEvent('petaria-hunting-speed-state', {
        detail: { multiplier: this.moveSpeedMultiplier },
      })
    );

    this.emitStepsState();

    if (this.mapMaxSteps != null && this.stepsRemaining === 0) {
      this.huntingStepsExhausted = true;
      this.dpadHoldDir = null;
      window.dispatchEvent(new CustomEvent('petaria-hunting-steps-exhausted'));
    }

    this.persistHuntingSession();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.encounterManager = new EncounterManager(this, {
      isEncounterTile: (tx, ty) => this.isEncounterTile(tx, ty),
      encounterPool: map.encounterPool,
    });

    this.encounterManager.setEncounterCallback((result) => {
      this.isEncounterModalOpen = true;
      window.dispatchEvent(
        new CustomEvent('wildPetEncounter', {
          detail: {
            encounterType: result.encounterType,
            wildPet: result.wildPet,
            itemEncounter: result.item,
          },
        })
      );
    });

    this._onEncounterModalClosed = () => {
      this.isEncounterModalOpen = false;
    };
    window.addEventListener('encounterModalClosed', this._onEncounterModalClosed);

    this._onHuntingInput = (e) => {
      const dir = e.detail?.dir;
      if (!dir || this.isEncounterModalOpen) return;
      if (!this.isMoving) {
        this.tryStepDir(dir);
      }
    };
    window.addEventListener('petaria-hunting-move', this._onHuntingInput);

    this._onDpad = (e) => {
      const phase = e.detail?.phase;
      const dir = e.detail?.dir;
      if (phase === 'down' && dir) {
        this.dpadHoldDir = dir;
        if (!this.isMoving && !this.isEncounterModalOpen) {
          this.tryStepDir(dir);
        }
      } else if (phase === 'up' || phase === 'cancel') {
        this.dpadHoldDir = null;
      }
    };
    window.addEventListener('petaria-hunting-dpad', this._onDpad);

    this._onHuntingCamera = (e) => {
      const action = e.detail?.action;
      const cam = this.cameras.main;
      if (!cam) return;
      if (action === 'zoomIn') {
        this.cameraZoom = Phaser.Math.Clamp(this.cameraZoom * 1.12, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
      } else if (action === 'zoomOut') {
        this.cameraZoom = Phaser.Math.Clamp(this.cameraZoom / 1.12, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
      } else if (action === 'zoomReset') {
        this.cameraZoom = this.defaultCameraZoom;
      } else if (action === 'zoomFit') {
        this.cameraZoom = this.getFitZoom();
      } else {
        return;
      }
      cam.setZoom(this.cameraZoom);
      this.updateCameraBoundsForZoom();
      window.dispatchEvent(
        new CustomEvent('petaria-hunting-camera-state', {
          detail: { zoom: this.cameraZoom },
        })
      );
    };
    window.addEventListener('petaria-hunting-camera', this._onHuntingCamera);

    this._onHuntingSpeed = (e) => {
      const action = e.detail?.action;
      if (action === 'faster') {
        this.moveSpeedMultiplier = Phaser.Math.Clamp(this.moveSpeedMultiplier * 1.2, MOVE_SPEED_MIN, MOVE_SPEED_MAX);
      } else if (action === 'slower') {
        this.moveSpeedMultiplier = Phaser.Math.Clamp(this.moveSpeedMultiplier / 1.2, MOVE_SPEED_MIN, MOVE_SPEED_MAX);
      } else if (action === 'speedReset') {
        this.moveSpeedMultiplier = 1;
      } else {
        return;
      }
      window.dispatchEvent(
        new CustomEvent('petaria-hunting-speed-state', {
          detail: { multiplier: this.moveSpeedMultiplier },
        })
      );
    };
    window.addEventListener('petaria-hunting-move-speed', this._onHuntingSpeed);

    this.addDebugControls();

    this.events.once('shutdown', () => {
      window.removeEventListener('encounterModalClosed', this._onEncounterModalClosed);
      window.removeEventListener('petaria-hunting-move', this._onHuntingInput);
      window.removeEventListener('petaria-hunting-dpad', this._onDpad);
      window.removeEventListener('petaria-hunting-camera', this._onHuntingCamera);
      window.removeEventListener('petaria-hunting-move-speed', this._onHuntingSpeed);
      if (this.stepTween) {
        this.stepTween.stop();
        this.stepTween = null;
      }
    });
  }

  setupHeroAnimations() {
    const total = this.textures.get('hero').frameTotal;
    this.framesPerDirection = Math.floor(total / 4);
    const fpd = this.framesPerDirection;
    if (!(fpd === 3 || fpd === 4)) return;

    const dirs = ['down', 'left', 'right', 'up'];
    const ranges = dirs.map((_, i) => ({
      start: i * fpd,
      end: i * fpd + fpd - 1,
    }));

    const rate = PLAYER_CONFIG.ANIMATION.WALK_FRAME_RATE;
    dirs.forEach((dir, i) => {
      const keyLoop = `walk-${dir}`;
      const keyOnce = `walk-${dir}-once`;
      if (!this.anims.exists(keyLoop)) {
        const frames = this.anims.generateFrameNumbers('hero', ranges[i]);
        this.anims.create({
          key: keyLoop,
          frames,
          frameRate: rate,
          repeat: -1,
        });
        this.anims.create({
          key: keyOnce,
          frames,
          frameRate: rate,
          repeat: 0,
        });
      }
      this.standFrame[dir] = ranges[i].start + 1;
    });

    this.walkOnceDurationMs = (fpd / rate) * 1000;
    this.hasHeroAnimations = true;
    this.applyStandFrame();
  }

  applyStandFrame() {
    if (!this.hasHeroAnimations || !this.player || this.player.texture.key !== 'hero') return;
    const fi = this.standFrame[this.facingDirection] ?? 0;
    this.player.anims.stop();
    this.player.setFrame(fi);
  }

  getHeldDirectionKey() {
    if (this.cursors.left.isDown || this.keyA.isDown) return 'left';
    if (this.cursors.right.isDown || this.keyD.isDown) return 'right';
    if (this.cursors.up.isDown || this.keyW.isDown) return 'up';
    if (this.cursors.down.isDown || this.keyS.isDown) return 'down';
    return null;
  }

  /** Bàn phím ưu tiên hơn D-pad khi cả hai có thể active */
  getChainedMoveDir() {
    return this.getHeldDirectionKey() || this.dpadHoldDir;
  }

  hasStepsRemaining() {
    if (this.huntingStepsExhausted) return false;
    if (this.stepsRemaining == null) return true;
    return this.stepsRemaining > 0;
  }

  persistHuntingSession() {
    if (this.mapMaxSteps == null || this.stepsRemaining == null) return;
    saveHuntingSession(this.selectedMapId, {
      maxSteps: this.mapMaxSteps,
      stepsRemaining: this.stepsRemaining,
      gridX: this.gridX,
      gridY: this.gridY,
    });
  }

  emitStepsState() {
    window.dispatchEvent(
      new CustomEvent('petaria-hunting-steps-changed', {
        detail: {
          remaining: this.stepsRemaining,
          max: this.mapMaxSteps,
          unlimited: this.mapMaxSteps == null,
        },
      })
    );
  }

  consumeJustPressedDirection() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keyA)) {
      return 'left';
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keyD)) {
      return 'right';
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keyW)) {
      return 'up';
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keyS)) {
      return 'down';
    }
    return null;
  }

  tryStepDir(dirKey) {
    if (!this.hasStepsRemaining()) return;
    const spec = DIR[dirKey];
    if (!spec) return;
    const ngx = this.gridX + spec.dx;
    const ngy = this.gridY + spec.dy;
    if (!this.isWalkable(ngx, ngy)) return;
    this.startStep(ngx, ngy, dirKey);
  }

  startStep(ngx, ngy, dirKey) {
    this.isMoving = true;
    this.facingDirection = dirKey;
    const world = this.tileCenterWorld(ngx, ngy);

    if (this.stepTween) {
      this.stepTween.stop();
      this.stepTween = null;
    }

    const mult = this.moveSpeedMultiplier;
    if (this.hasHeroAnimations && this.player.anims) {
      this.player.anims.timeScale = mult;
      this.player.anims.play(`walk-${dirKey}-once`, true);
    }

    const stepMs = this.walkOnceDurationMs / mult;
    this.stepTween = this.tweens.add({
      targets: this.player,
      x: world.x,
      y: world.y,
      duration: stepMs,
      ease: 'Linear',
      onComplete: () => {
        this.stepTween = null;
        this.finishStep(ngx, ngy);
      },
    });
  }

  finishStep(ngx, ngy) {
    this.gridX = ngx;
    this.gridY = ngy;
    this.player.x = this.tileCenterWorld(this.gridX, this.gridY).x;
    this.player.y = this.tileCenterWorld(this.gridX, this.gridY).y;
    this.isMoving = false;
    if (this.player?.anims) {
      this.player.anims.timeScale = 1;
    }
    this.applyStandFrame();
    this.checkForEncounter();

    if (this.mapMaxSteps != null && this.stepsRemaining != null) {
      // Đồng bộ với giá trị mới nhất giữa các tab trước khi trừ bước.
      const latest = loadHuntingSession(this.selectedMapId, this.mapMaxSteps);
      if (latest && Number.isFinite(Number(latest.stepsRemaining))) {
        this.stepsRemaining = Math.min(this.stepsRemaining, Number(latest.stepsRemaining));
      }
      this.stepsRemaining = Math.max(0, this.stepsRemaining - 1);
      this.emitStepsState();
      this.persistHuntingSession();
      if (this.stepsRemaining === 0) {
        this.huntingStepsExhausted = true;
        this.dpadHoldDir = null;
        window.dispatchEvent(new CustomEvent('petaria-hunting-steps-exhausted'));
      }
    }

    const held = this.getChainedMoveDir();
    if (held && !this.isEncounterModalOpen && this.hasStepsRemaining()) {
      this.tryStepDir(held);
    }
  }

  checkForEncounter() {
    if (!this.encounterManager) return;
    this.encounterManager.checkForEncounter(this.gridX, this.gridY);
  }

  updateCameraBoundsForZoom() {
    const cam = this.cameras?.main;
    if (!cam || this.worldWidth <= 0 || this.worldHeight <= 0) return;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const extraX = Math.max(0, viewW - this.worldWidth);
    const extraY = Math.max(0, viewH - this.worldHeight);
    cam.setBounds(
      -extraX / 2,
      -extraY / 2,
      this.worldWidth + extraX,
      this.worldHeight + extraY
    );
  }

  getFitZoom() {
    const cam = this.cameras?.main;
    if (!cam) return CAMERA_ZOOM;
    const gw = this.scale?.width || cam.width;
    const gh = this.scale?.height || cam.height;
    if (this.worldWidth <= 0 || this.worldHeight <= 0 || gw <= 0 || gh <= 0) {
      return CAMERA_ZOOM;
    }
    const pad = 1;
    const zx = (gw * pad) / this.worldWidth;
    const zy = (gh * pad) / this.worldHeight;
    // Cover: map lấp đầy canvas theo cả 2 chiều (có thể crop nhẹ 1 chiều nếu khác tỉ lệ).
    let target = Math.max(zx, zy);
    if (typeof window !== 'undefined') {
      const vw = window.innerWidth || gw;
      const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      // Mobile màn rộng một chút: boost nhẹ để sprite đỡ nhỏ.
      if (isCoarsePointer && vw > 430 && vw <= 600) {
        target = Math.max(target * 1.15, 1.15);
      }
      if (isCoarsePointer && vw <= 430) {
        target = Math.max(target * 1.25, 1.25);
      }
    }
    return Phaser.Math.Clamp(target, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
  }

  addDebugControls() {
    this.input.keyboard.on('keydown-E', () => {
      if (this.encounterManager && this.isEncounterTile(this.gridX, this.gridY)) {
        this.encounterManager.checkForEncounter(this.gridX, this.gridY);
      }
    });
  }

  update() {
    if (!this.player || !this.cursors) return;

    const body = this.player.body;
    if (body) body.setVelocity(0, 0);

    if (this.isMoving) return;

    if (this.isEncounterModalOpen) return;

    const pressed = this.consumeJustPressedDirection();
    if (pressed) {
      this.tryStepDir(pressed);
    }

    if (
      this.dpadHoldDir &&
      !this.isMoving &&
      !this.isEncounterModalOpen &&
      this.hasStepsRemaining()
    ) {
      const now = this.time.now;
      if (now - this._lastDpadHoldPoll > 95) {
        this._lastDpadHoldPoll = now;
        this.tryStepDir(this.dpadHoldDir);
      }
    }
  }
}
