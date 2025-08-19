import Phaser from 'phaser';
import { CAMERA_ZOOM, HERO_COLLIDER_OFFSET, HERO_COLLIDER_SIZE, HERO_SCALE } from '../config/huntingConfig';
import { PLAYER_CONFIG, getPlayerSpeed } from '../config/playerConfig';
import { collisions } from '../../../src/game/map/forest/collisions.js';
import { EncounterManager } from '../managers/EncounterManager.js';

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
    this.collisionMap = null;
    this.tileSize = PLAYER_CONFIG.TILE_SIZE; // Use config tile size
    
    // Player movement state
    this.isMoving = false;
    this.targetTileX = null;
    this.targetTileY = null;
    this.currentSpeed = getPlayerSpeed('WALK'); // Default speed
    this.animationStopTimer = null; // Timer for smooth animation transitions
    
    // Encounter system
    this.encounterManager = null;
    this.isEncounterModalOpen = false; // Flag to track encounter modal state
  }

  init(data) {
    if (data && data.selectedMapId) this.selectedMapId = data.selectedMapId;
  }

  create() {
    // Display large forest-map image as a temporary background.
    // Later we will switch to a Tiled JSON tilemap with collisions.
    const bg = this.add.image(0, 0, 'forest-map').setOrigin(0, 0);
    bg.setDepth(0); // Background layer - lowest depth

    // Enable world bounds to image size
    const worldWidth = bg.width;
    const worldHeight = bg.height;
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // Initialize collision map
    this.initCollisionMap();

    // Visual debugging: Draw collision blocks
    // this.drawCollisionBlocks();

    // Create placeholder player
    // Use provided hero spritesheet if available with enough frames, else fallback
    const hasHeroSheet = this.textures.exists('hero') && this.textures.get('hero').frameTotal >= 12;
    const textureKey = hasHeroSheet ? 'hero' : 'hero-fallback';
    
    // Ensure player starts at exact tile center (not between tiles)
    const startTileX = (10 * this.tileSize) + (this.tileSize / 2) ;  // 160 + 8 = 168
    const startTileY = (10 * this.tileSize) + (this.tileSize / 2);  // 160 + 8 = 168

    
    this.player = this.physics.add.sprite(startTileX, startTileY, textureKey, 0);
    if (textureKey !== 'hero-fallback') {
      this.player.setScale(HERO_SCALE);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setSize(HERO_COLLIDER_SIZE, HERO_COLLIDER_SIZE).setOffset(HERO_COLLIDER_OFFSET.x, HERO_COLLIDER_OFFSET.y);
    
    // Set player depth to be above background but below foreground
    this.player.setDepth(1);

    // Simple 4-direction animations if spritesheet exists
    if (hasHeroSheet) {
      const total = this.textures.get('hero').frameTotal;
      // Support 12 (3 frames/dir) or 16 (4 frames/dir)
      this.framesPerDirection = Math.floor(total / 4);
      const fpd = this.framesPerDirection;
      if ((fpd === 3 || fpd === 4) && !this.anims.exists('walk-down')) {
        const ranges = {
          down: { start: 0, end: 3 },
          left: { start: 4, end: 7 },
          right: { start: 8, end: 11 },
          up: { start: 12, end: 15 },
        };
        this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('hero', ranges.down), frameRate: PLAYER_CONFIG.ANIMATION.WALK_FRAME_RATE, repeat: -1 });
        this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('hero', ranges.left), frameRate: PLAYER_CONFIG.ANIMATION.WALK_FRAME_RATE, repeat: -1 });
        this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('hero', ranges.right), frameRate: PLAYER_CONFIG.ANIMATION.WALK_FRAME_RATE, repeat: -1 });
        this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('hero', ranges.up), frameRate: PLAYER_CONFIG.ANIMATION.WALK_FRAME_RATE, repeat: -1 });
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

    // Add foreground layer LAST so it renders on top of everything
    // Foreground is exported at 250% zoom to match camera zoom 2.5x
    const foreground = this.add.image(0, 0, 'forest-map-foreground').setOrigin(0, 0);
    foreground.setDepth(2); // Foreground layer - highest depth (above hero)
    
    // Force depth sorting to ensure correct layer order
    this.children.sort('depth');

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Add speed control keys (optional)
    this.addSpeedControls();

    // Initialize encounter manager
    this.encounterManager = new EncounterManager(this);
    
    // Set up encounter callback to communicate with React
    this.encounterManager.setEncounterCallback((wildPet) => {
      // Disable player movement when encounter modal is open
      this.isEncounterModalOpen = true;
      
      // Dispatch custom event to communicate with React
      const encounterEvent = new CustomEvent('wildPetEncounter', {
        detail: { wildPet }
      });
      window.dispatchEvent(encounterEvent);
    });
    
    // Listen for encounter modal close to re-enable movement
    window.addEventListener('encounterModalClosed', () => {
      this.isEncounterModalOpen = false;
      // console.log('🎯 Encounter modal closed - movement re-enabled');
    });
  }

  // Add keyboard controls for speed adjustment
  addSpeedControls() {
    // Speed control keys
    this.input.keyboard.on('keydown-ONE', () => {
      this.setPlayerSpeed('SLOW');
      // console.log('Speed set to SLOW:', this.currentSpeed);
    });
    
    this.input.keyboard.on('keydown-TWO', () => {
      this.setPlayerSpeed('WALK');
      // console.log('Speed set to WALK:', this.currentSpeed);
    });
    
    this.input.keyboard.on('keydown-THREE', () => {
      this.setPlayerSpeed('FAST');
      // console.log('Speed set to FAST:', this.currentSpeed);
    });
    
    this.input.keyboard.on('keydown-FOUR', () => {
      this.setPlayerSpeed('RUN');
      // console.log('Speed set to RUN:', this.currentSpeed);
    });
    
    // DEBUG: Test encounter system
    this.input.keyboard.on('keydown-E', () => {
      // console.log('🎯 Testing encounter system...');
      if (this.encounterManager) {
        const cooldownStatus = this.encounterManager.getCooldownStatus();
        // console.log('Cooldown status:', cooldownStatus);
        
        // Force encounter for testing
        const currentTileX = Math.floor(this.player.x / this.tileSize);
        const currentTileY = Math.floor(this.player.y / this.tileSize);
        // console.log('Current tile position:', { x: currentTileX, y: currentTileY });
        
        const isBattleZone = this.encounterManager.isInBattleZone(currentTileX, currentTileY);
        // console.log('Is in battle zone:', isBattleZone);
        
        if (isBattleZone) {
          // console.log('🎯 Player is in battle zone - checking for encounter...');
          this.encounterManager.checkForEncounter(currentTileX, currentTileY);
        } else {
          // console.log('❌ Player is NOT in battle zone');
        }
      }
    });
    
    // DEBUG: Show encounter info
    this.input.keyboard.on('keydown-I', () => {
      if (this.encounterManager) {
        //  console.log('📊 ENCOUNTER SYSTEM INFO:');
        // console.log('Current zone:', this.encounterManager.currentZone);
        // console.log('Base encounter rate:', this.encounterManager.currentZone.baseEncounterRate);
        // console.log('Cooldown seconds:', this.encounterManager.currentZone.cooldownSeconds);
        // console.log('Available pets:', this.encounterManager.currentZone.availablePetIds);
        
        const cooldownStatus = this.encounterManager.getCooldownStatus();
        // console.log('Cooldown status:', cooldownStatus);
      }
    });
  }

  // Set player speed
  setPlayerSpeed(speedType) {
    this.currentSpeed = getPlayerSpeed(speedType);
  }

  // Get current player speed
  getPlayerSpeed() {
    return this.currentSpeed;
  }

  initCollisionMap() {
    // Convert 1D array to 2D grid for easier collision checking
    const mapWidth = 50; // Based on your collision data structure
    const mapHeight = 40; // Based on your collision data structure
    
    this.collisionMap = [];
    for (let y = 0; y < mapHeight; y++) {
      this.collisionMap[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        const index = y * mapWidth + x;
        this.collisionMap[y][x] = collisions[index] || 0;
      }
    }
  }

  // Check if a specific tile is walkable
  isTileWalkable(tileX, tileY) {
    // Check bounds
    if (tileX < 0 || tileX >= this.collisionMap[0].length || 
        tileY < 0 || tileY >= this.collisionMap.length) {
      return false;
    }
    
    // Check if tile is walkable (0 = walkable, 320 = blocked)
    return this.collisionMap[tileY][tileX] === 0;
  }

  // Helper function to check if two rectangles overlap (kept for reference)
  boxesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
  }

  update() {
    if (!this.player || !this.cursors) return;
    
    const body = this.player.body;
    body.setVelocity(0, 0);

    // If player is currently moving to a target tile, continue movement
    if (this.isMoving && this.targetTileX !== null && this.targetTileY !== null) {
      this.continueMovement();
      return;
    }

    // Get current tile position (bottom of tile for character center)
    const currentTileX = Math.floor(this.player.x / this.tileSize) * this.tileSize + (this.tileSize / 2);
    const currentTileY = Math.floor(this.player.y / this.tileSize) * this.tileSize + (this.tileSize / 2) - 8;
    
    // Only snap player to tile center if they're not moving and are significantly off-center
    if (!this.isMoving && (Math.abs(this.player.x - currentTileX) > 2 || Math.abs(this.player.y - currentTileY) > 2)) {
      // console.log('Snapping player to tile center:', { from: { x: this.player.x, y: this.player.y }, to: { x: currentTileX, y: currentTileY } });
      this.player.x = currentTileX;
      this.player.y = currentTileY;
    }

    // Handle new input for movement
    this.handleMovementInput(currentTileX, currentTileY);

         // Handle standing animation - only when completely stopped
     if (this.hasHeroAnimations && !this.isMoving) {
       // Add a small delay before stopping animation to avoid jarring transitions
       if (!this.animationStopTimer) {
         this.animationStopTimer = this.time.delayedCall(100, () => {
           if (this.hasHeroAnimations && !this.isMoving && this.player.anims.isPlaying) {
             this.player.anims.stop();
             const frameIndex = this.standFrame[this.facingDirection] ?? 0;
             if (this.player.texture && this.player.texture.key === 'hero') {
               this.player.setFrame(frameIndex);
             }
           }
           this.animationStopTimer = null;
         });
       }
     } else {
       // Clear timer if player starts moving again
       if (this.animationStopTimer) {
         this.animationStopTimer.destroy();
         this.animationStopTimer = null;
       }
     }
  }

  // Continue movement towards target tile
  continueMovement() {
    const deltaTime = this.game.loop.delta / 1000;
    
    // Calculate direction to target tile
    const dirX = this.targetTileX - this.player.x;
    const dirY = this.targetTileY - this.player.y;
    
    // Move towards target with current speed
    if (Math.abs(dirX) > 0.1) {
      this.player.x += Math.sign(dirX) * this.currentSpeed * deltaTime;
    }
    if (Math.abs(dirY) > 0.1) {
      this.player.y += Math.sign(dirY) * this.currentSpeed * deltaTime;
    }
    
    // Check if we've reached the target tile
    if (Math.abs(this.player.x - this.targetTileX) < 2 && Math.abs(this.player.y - this.targetTileY) < 2) {
      // Snap to exact tile center position
      this.player.x = this.targetTileX;
      this.player.y = this.targetTileY;
      this.stopMovement();
    }
  }

  // Handle movement input and set target tile
  handleMovementInput(currentTileX, currentTileY) {
    // Don't allow movement if encounter modal is open
    if (this.isEncounterModalOpen) {
      return;
    }
    
    let targetTileX = currentTileX;
    let targetTileY = currentTileY;
    let anim = null;
    let moved = false;

    // Priority: Left > Right > Up > Down (no diagonal movement)
    if (this.cursors.left.isDown) {
      targetTileX = currentTileX - this.tileSize;
      anim = 'walk-left';
      this.facingDirection = 'left';
      moved = true;
    } else if (this.cursors.right.isDown) {
      targetTileX = currentTileX + this.tileSize;
      anim = 'walk-right';
      this.facingDirection = 'right';
      moved = true;
    } else if (this.cursors.up.isDown) {
      targetTileY = currentTileY - this.tileSize;
      anim = 'walk-up';
      this.facingDirection = 'up';
      moved = true;
    } else if (this.cursors.down.isDown) {
      targetTileY = currentTileY + this.tileSize;
      anim = 'walk-down';
      this.facingDirection = 'down';
      moved = true;
    }

    // Start movement if input is pressed and target tile is walkable
    if (moved && !this.isMoving) {
      const targetTileGridX = Math.floor(targetTileX / this.tileSize);
      const targetTileGridY = Math.floor(targetTileY / this.tileSize);
      
      if (this.isTileWalkable(targetTileGridX, targetTileGridY)) {
        this.startMovement(targetTileX, targetTileY, anim);
      } else {
        // console.log('Target tile is not walkable!');
      }
    }
  }

  // Start movement to target tile
  startMovement(targetTileX, targetTileY, anim) {
    // Ensure target coordinates are exactly at tile centers
    this.targetTileX = Math.floor(targetTileX / this.tileSize) * this.tileSize + (this.tileSize / 2);
    this.targetTileY = Math.floor(targetTileY / this.tileSize) * this.tileSize + (this.tileSize / 2) - 8;
    this.isMoving = true;
    
    // Start walking animation - don't restart if already playing the same animation
    if (this.hasHeroAnimations && anim) {
      if (!this.player.anims.isPlaying || this.player.anims.currentAnim.key !== anim) {
        this.player.anims.play(anim, true);
      }
    }
  }

  // Stop movement
  stopMovement() {
    this.isMoving = false;
    this.targetTileX = null;
    this.targetTileY = null;
    
    // Don't stop animation immediately - let it continue smoothly
    // Animation will be handled in update() when player stops moving
    
    // Check for encounter when player stops moving
    this.checkForEncounter();
  }

  // Check for encounter at current position
  checkForEncounter() {
    if (!this.encounterManager) return;
    
    // Get current tile position
    const currentTileX = Math.floor(this.player.x / this.tileSize);
    const currentTileY = Math.floor(this.player.y / this.tileSize);
    
    // Check for encounter
    this.encounterManager.checkForEncounter(currentTileX, currentTileY);
  }

  // Visual debugging: Draw collision blocks
  drawCollisionBlocks() {
    this.collisionGraphics = this.add.graphics();
    
    // Draw grid lines first (optional, for better visualization)
    this.collisionGraphics.lineStyle(0.5, 0x666666, 0.3); // Gray grid lines
    for (let x = 0; x <= this.collisionMap[0].length * this.tileSize; x += this.tileSize) {
      this.collisionGraphics.moveTo(x, 0);
      this.collisionGraphics.lineTo(x, this.collisionMap.length * this.tileSize);
    }
    for (let y = 0; y <= this.collisionMap.length * this.tileSize; y += this.tileSize) {
      this.collisionGraphics.moveTo(0, y);
      this.collisionGraphics.lineTo(this.collisionMap[0].length * this.tileSize, y);
    }
    this.collisionGraphics.stroke(); // Use stroke() instead of strokePaths()
    
    // Draw collision blocks in red with consistent line thickness
    this.collisionGraphics.lineStyle(1, 0xff0000, 1); // Red border, thickness 1
    this.collisionGraphics.fillStyle(0xff0000, 0.3); // Red fill with transparency
    
    for (let y = 0; y < this.collisionMap.length; y++) {
      for (let x = 0; x < this.collisionMap[0].length; x++) {
        if (this.collisionMap[y][x] === 320) { // Blocked tile
          const worldX = x * this.tileSize;
          const worldY = y * this.tileSize;
          this.collisionGraphics.fillRect(worldX, worldY, this.tileSize, this.tileSize);
          this.collisionGraphics.strokeRect(worldX, worldY, this.tileSize, this.tileSize);
        }
      }
    }
  }


  // Visual debugging: Draw player collision box
  // drawPlayerCollisionBox() {
  //   if (this.playerCollisionGraphics) {
  //     this.playerCollisionGraphics.destroy();
  //   }
    
  //   this.playerCollisionGraphics = this.add.graphics();
    
  //   // Player should always be at exact tile center
  //   const currentTileX = Math.floor(this.player.x / this.tileSize) * this.tileSize + (this.tileSize / 2);
  //   const currentTileY = Math.floor(this.player.y / this.tileSize) * this.tileSize + (this.tileSize / 2);
    
    // // Draw current tile position indicator (blue box - 16x16) ONLY
    // this.playerCollisionGraphics.lineStyle(1, 0x0000ff, 0.8); // Blue border for current tile
    // this.playerCollisionGraphics.strokeRect(currentTileX - this.tileSize / 2, currentTileY - this.tileSize / 2, this.tileSize, this.tileSize);
    
    // // Draw target tile indicator if moving
    // if (this.isMoving && this.targetTileX !== null && this.targetTileY !== null) {
    //   this.playerCollisionGraphics.lineStyle(1, 0xffff00, 0.8); // Yellow border for target tile
    //   this.playerCollisionGraphics.strokeRect(this.targetTileX - this.tileSize / 2, this.targetTileY - this.tileSize / 2, this.tileSize, this.tileSize);
    // }
  }



