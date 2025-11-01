import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { createLevel } from "../environment/level1.js";
import { createPlayer } from "../models/player.js";
import { setupInput, input } from "../input/inputHandler.js";
import { updateWalking } from "../physics/movement.js";
import { updateFlying } from "../physics/flight.js";
import { getSpeedBoostState } from "../physics/flight.js";
import { getWalkSpeedBoostState as getWalkBoostState } from "../physics/movement.js";


export class Game {
    constructor(renderer) {
        this.renderer = renderer;
        const { scene, camera } = createLevel();
        this.scene = scene;
        this.camera = camera;

        this.player = createPlayer();
        this.scene.add(this.player);

        setupInput();

        // Game state
        this.score = 0;
        this.collectedItems = {};
        this.totalCollectibles = this.scene.userData.collectibles ? this.scene.userData.collectibles.length : 0;

        this.isFlying = false;
        this.prevFlyToggle = false;
        this.flyState = { isAscendingToFly: false, targetFlyHeight: 0 };

        // Camera control state (mouse-look)
        this.yaw = 0;
        this.pitch = 0;
        this.MOUSE_SENS = 0.0025;

        // Create a separate scene for UI elements (including minimap)
        this.uiScene = new THREE.Scene();
        this.uiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);

        // Bind handlers - MAKE SURE THESE METHODS EXIST!
        this._onPointerLockChange = this._onPointerLockChange.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._requestLock = this._requestLock.bind(this);

        // Setup pointer lock
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('click', this._requestLock);
            document.addEventListener('pointerlockchange', this._onPointerLockChange);
        }

        // Create UI elements
        this._createCrosshair();
        this._createCrosshair3D();
        this._createScoreUI();
        this._createSpeedBoostUI(); // ADDED: Speed boost UI
        
        // Initialize minimap
        this._initMinimap();
        
        this.lastTime = performance.now();
        this.loop();
    }

    // ADDED: Create speed boost UI elements
    _createSpeedBoostUI() {
        // Remove existing speed boost UI if any
        const existingBoost = document.getElementById('speed-boost-ui');
        if (existingBoost) {
            existingBoost.remove();
        }

        // Create speed boost container
        this.speedBoostContainer = document.createElement('div');
        this.speedBoostContainer.id = 'speed-boost-ui';
        this.speedBoostContainer.style.position = 'absolute';
        this.speedBoostContainer.style.bottom = '20px';
        this.speedBoostContainer.style.left = '20px';
        this.speedBoostContainer.style.zIndex = '1000';
        this.speedBoostContainer.style.pointerEvents = 'none';

        // Create progress bar background
        const boostBarBg = document.createElement('div');
        boostBarBg.style.width = '200px';
        boostBarBg.style.height = '20px';
        boostBarBg.style.background = '#333';
        boostBarBg.style.border = '2px solid #fff';
        boostBarBg.style.borderRadius = '10px';
        boostBarBg.style.overflow = 'hidden';

        // Create progress bar fill
        this.boostBarFill = document.createElement('div');
        this.boostBarFill.style.width = '0%';
        this.boostBarFill.style.height = '100%';
        this.boostBarFill.style.background = '#666';
        this.boostBarFill.style.transition = 'width 0.1s, background-color 0.3s';

        // Create boost text
        this.boostText = document.createElement('div');
        this.boostText.style.color = 'white';
        this.boostText.style.fontFamily = 'Arial, sans-serif';
        this.boostText.style.fontSize = '14px';
        this.boostText.style.marginTop = '5px';
        this.boostText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
        this.boostText.textContent = 'Speed Boost: Ready';

        // Assemble UI
        boostBarBg.appendChild(this.boostBarFill);
        this.speedBoostContainer.appendChild(boostBarBg);
        this.speedBoostContainer.appendChild(this.boostText);
        
        document.body.appendChild(this.speedBoostContainer);
    }

    // ADDED: Update speed boost UI
    _updateSpeedBoostUI() {
        if (!this.boostBarFill || !this.boostText) return;

        // Get the appropriate speed boost state based on current mode
        const boostState = this.isFlying ? getSpeedBoostState() : getWalkBoostState();
        
        // Update progress bar
        this.boostBarFill.style.width = `${boostState.progress * 100}%`;
        
        // Update colors based on state
        if (boostState.isCharging) {
            this.boostBarFill.style.background = '#ffa500'; // Orange for charging
            this.boostText.textContent = `Speed Boost: ${(boostState.progress * 100).toFixed(0)}%`;
        } else if (boostState.active) {
            this.boostBarFill.style.background = '#00ff00'; // Green for active
            this.boostText.textContent = `SPEED BOOST! ${boostState.timeRemaining.toFixed(1)}s`;
        } else {
            this.boostBarFill.style.background = '#666'; // Gray for inactive
            this.boostText.textContent = 'Speed Boost: Ready';
        }
    }

    // ADDED: Create screen effect overlay for boost
    _createScreenEffect() {
        // Remove existing screen effect if any
        const existingEffect = document.getElementById('screen-effect');
        if (existingEffect) {
            existingEffect.remove();
        }

        this.screenEffect = document.createElement('div');
        this.screenEffect.id = 'screen-effect';
        this.screenEffect.style.position = 'fixed';
        this.screenEffect.style.top = '0';
        this.screenEffect.style.left = '0';
        this.screenEffect.style.width = '100%';
        this.screenEffect.style.height = '100%';
        this.screenEffect.style.pointerEvents = 'none';
        this.screenEffect.style.zIndex = '999';
        this.screenEffect.style.opacity = '0';
        this.screenEffect.style.transition = 'opacity 0.3s';
        this.screenEffect.style.background = 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, transparent 70%)';
        
        document.body.appendChild(this.screenEffect);
    }

    // ADDED: Update screen effects for boost
    _updateScreenEffects() {
        if (!this.screenEffect) {
            this._createScreenEffect();
        }

        const boostState = this.isFlying ? getSpeedBoostState() : getWalkBoostState();
        
        if (boostState.isCharging) {
            this.screenEffect.style.opacity = (boostState.progress * 0.3).toString();
            this.screenEffect.style.background = 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, transparent 70%)';
        } else if (boostState.active) {
            this.screenEffect.style.opacity = '0.5';
            this.screenEffect.style.background = 'radial-gradient(circle, rgba(0,255,0,0.2) 0%, transparent 70%)';
        } else {
            this.screenEffect.style.opacity = '0';
        }
    }

    // ... REST OF YOUR EXISTING METHODS REMAIN UNCHANGED ...
    _requestLock() {
        if (this.renderer && this.renderer.domElement && document.pointerLockElement !== this.renderer.domElement) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    _onPointerLockChange() {
        if (document.pointerLockElement === (this.renderer && this.renderer.domElement)) {
            document.addEventListener('mousemove', this._onMouseMove);
        } else {
            document.removeEventListener('mousemove', this._onMouseMove);
        }
    }

    _onMouseMove(e) {
        this.yaw -= e.movementX * this.MOUSE_SENS;
        this.pitch += e.movementY * this.MOUSE_SENS;
        const PI_2 = Math.PI / 2;
        const maxPitch = PI_2 - 0.1;
        const minPitch = -maxPitch;
        this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    }

    _createCrosshair() {
        if (document.getElementById('game-crosshair')) return;
        const container = document.createElement('div');
        container.id = 'game-crosshair';
        container.style.position = 'absolute';
        container.style.left = '50%';
        container.style.top = '50%';
        container.style.transform = 'translate(-50%,-50%)';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';

        const vert = document.createElement('div');
        vert.style.width = '2px';
        vert.style.height = '20px';
        vert.style.background = 'white';
        vert.style.margin = '0 auto';

        const hor = document.createElement('div');
        hor.style.width = '20px';
        hor.style.height = '2px';
        hor.style.background = 'white';
        hor.style.position = 'relative';
        hor.style.top = '-11px';

        container.appendChild(vert);
        container.appendChild(hor);
        document.body.appendChild(container);
    }

    _createCrosshair3D() {
        const material = new THREE.SpriteMaterial({ color: 0xffffff });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.4, 0.4, 0.4);
        sprite.renderOrder = 999;
        this.crosshair3D = sprite;
        this.scene.add(this.crosshair3D);
    }

    _createScoreUI() {
        // Remove existing score UI if any
        const existingScore = document.getElementById('game-score');
        if (existingScore) {
            existingScore.remove();
        }

        // Create score display
        this.scoreElement = document.createElement('div');
        this.scoreElement.id = 'game-score';
        this.scoreElement.style.position = 'absolute';
        this.scoreElement.style.top = '20px';
        this.scoreElement.style.left = '20px';
        this.scoreElement.style.color = 'white';
        this.scoreElement.style.fontFamily = 'Arial, sans-serif';
        this.scoreElement.style.fontSize = '24px';
        this.scoreElement.style.fontWeight = 'bold';
        this.scoreElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.scoreElement.style.zIndex = '1000';
        this.scoreElement.innerHTML = `Items: ${this.score}/${this.totalCollectibles}`;
        
        document.body.appendChild(this.scoreElement);
    }

    _updateScoreUI() {
        if (this.scoreElement) {
            this.scoreElement.innerHTML = `Items: ${this.score}/${this.totalCollectibles}`;
        }
    }

_checkCollectibleCollisions() {
    if (!this.scene.userData.collectibles || !this.scene.userData.tokenPositions) return;

    const playerBox = new THREE.Box3();
    playerBox.setFromCenterAndSize(
        this.player.position,
        new THREE.Vector3(0.8, 1.0, 0.8)
    );

    this.scene.userData.collectibles.forEach((collectible, index) => {
        if (!collectible.userData.collected) {
            const collectibleBox = new THREE.Box3().setFromObject(collectible);
            
            if (playerBox.intersectsBox(collectibleBox)) {
                // Collect the item
                collectible.userData.collected = true;
                this.scene.remove(collectible);
                
                // Also mark the token position as collected
                if (this.scene.userData.tokenPositions[index]) {
                    this.scene.userData.tokenPositions[index].collected = true;
                }
                
                // Update score and collected items
                this.score++;
                const itemType = collectible.userData.type;
                this.collectedItems[itemType] = (this.collectedItems[itemType] || 0) + 1;
                
                // Update UI
                this._updateScoreUI();
                
                console.log(`Collected: ${itemType}! Total: ${this.score}/${this.totalCollectibles}`);
                
                if (this.score >= this.totalCollectibles) {
                    this._showVictoryMessage();
                }
            }
        }
    });
}

    _showVictoryMessage() {
        const victoryElement = document.createElement('div');
        victoryElement.id = 'victory-message';
        victoryElement.style.position = 'absolute';
        victoryElement.style.top = '50%';
        victoryElement.style.left = '50%';
        victoryElement.style.transform = 'translate(-50%, -50%)';
        victoryElement.style.color = 'gold';
        victoryElement.style.fontFamily = 'Arial, sans-serif';
        victoryElement.style.fontSize = '48px';
        victoryElement.style.fontWeight = 'bold';
        victoryElement.style.textShadow = '3px 3px 6px rgba(0,0,0,0.8)';
        victoryElement.style.zIndex = '1001';
        victoryElement.style.textAlign = 'center';
        victoryElement.innerHTML = 'VICTORY!<br><span style="font-size: 24px">All items collected!</span>';
        
        document.body.appendChild(victoryElement);
        
        // Remove message after 5 seconds
        setTimeout(() => {
            if (victoryElement.parentNode) {
                victoryElement.parentNode.removeChild(victoryElement);
            }
        }, 5000);
    }

    // MINIMAP METHODS (make sure these exist too)

_initMinimap() {
    const worldSize = 25 * 50;
    const minimapSize = worldSize * 0.3;
    
    this.minimapCamera = new THREE.OrthographicCamera(
        -minimapSize / 2,
        minimapSize / 2,
        minimapSize / 2,
        -minimapSize / 2,
        1,
        500
    );
    
    this.minimapCamera.position.set(0, 100, 0);
    this.minimapCamera.lookAt(0, 0, 0);

    this.minimapRenderTarget = new THREE.WebGLRenderTarget(256, 256);
    
    const minimapSizeUI = 0.4;
    const minimapGeometry = new THREE.PlaneGeometry(minimapSizeUI, minimapSizeUI);
    const minimapMaterial = new THREE.MeshBasicMaterial({
        map: this.minimapRenderTarget.texture,
        transparent: true,
        opacity: 0.9
    });
    
    this.minimapMesh = new THREE.Mesh(minimapGeometry, minimapMaterial);
    this.minimapMesh.position.set(0.8, 0.8, -1);
    this.uiScene.add(this.minimapMesh);
    
    // Create a canvas overlay for tokens
    this._createMinimapTokenOverlay();
    
}

_createMinimapTokenOverlay() {
    // Remove existing canvas if any
    const existingCanvas = document.getElementById('minimap-canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    // Create a canvas element for drawing the minimap
    this.minimapTokenCanvas = document.createElement('canvas');
    this.minimapTokenCanvas.id = 'minimap-canvas';
    this.minimapTokenCanvas.width = 150;
    this.minimapTokenCanvas.height = 150;
    this.minimapTokenCanvas.style.position = 'absolute';
    this.minimapTokenCanvas.style.top = '20px';
    this.minimapTokenCanvas.style.right = '20px';
    this.minimapTokenCanvas.style.pointerEvents = 'none';
    this.minimapTokenCanvas.style.zIndex = '1001';
    this.minimapTokenCanvas.style.borderRadius = '50%'; // Make it circular
    this.minimapTokenCanvas.style.border = '3px solid #2a2a2a';
    this.minimapTokenCanvas.style.boxShadow = '0 0 15px rgba(0,0,0,0.7)';
    this.minimapTokenCanvas.style.backgroundColor = 'rgba(40, 40, 60, 0.9)'; // Dark blue-gray background
    
    this.minimapTokenCtx = this.minimapTokenCanvas.getContext('2d');
    
    document.body.appendChild(this.minimapTokenCanvas);
}

_drawTokensOnMinimap() {
    if (!this.scene.userData.tokenPositions || !this.minimapTokenCtx) return;
    
    const ctx = this.minimapTokenCtx;
    const canvas = this.minimapTokenCanvas;
    
    // Clear canvas with background color
    ctx.fillStyle = 'rgba(40, 40, 60, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create circular clipping area
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4, 0, Math.PI * 2);
    ctx.clip();
    
    // Draw a subtle radifal gradient for better visibility
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(60, 60, 80, 0.8)');
    gradient.addColorStop(1, 'rgba(30, 30, 50, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const viewRadius = 300; // Radius around player to show (in world units)
    const scale = (canvas.width / 2 - 10) / viewRadius; // Leave some margin
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw distance rings (subtle guides)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // Draw rings at 33% and 66% of view radius
    for (let i = 1; i <= 2; i++) {
        const ringRadius = (canvas.width / 2 - 10) * (i * 0.33);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Draw each token
    this.scene.userData.tokenPositions.forEach(token => {
        if (!token.collected) {
            // Convert world coordinates to minimap canvas coordinates
            const tokenX = centerX + (token.x - this.player.position.x) * scale;
            const tokenZ = centerY + (token.z - this.player.position.z) * scale;
            
            // Check if token is within circular view
            const distanceFromCenter = Math.sqrt(
                Math.pow(tokenX - centerX, 2) + Math.pow(tokenZ - centerY, 2)
            );
            
            if (distanceFromCenter <= canvas.width / 2 - 8) {
                // Draw token as colored dot with glow
                ctx.fillStyle = '#' + token.color.toString(16).padStart(6, '0');
                ctx.beginPath();
                ctx.arc(tokenX, tokenZ, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Add a white border for visibility
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // Add subtle glow effect
                ctx.shadowColor = '#' + token.color.toString(16).padStart(6, '0');
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    });
    
    // Draw player position (red dot in center)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Add white border to player dot
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw player direction (red arrow)
    const playerDirection = new THREE.Vector3();
    this.camera.getWorldDirection(playerDirection);
    const arrowLength = 20;
    const arrowX = centerX + playerDirection.x * arrowLength;
    const arrowZ = centerY + playerDirection.z * arrowLength;
    
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(arrowX, arrowZ);
    ctx.stroke();
    
    // Draw arrow head
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowZ);
    ctx.lineTo(arrowX - playerDirection.x * 4 + playerDirection.z * 3, arrowZ - playerDirection.z * 4 - playerDirection.x * 3);
    ctx.lineTo(arrowX - playerDirection.x * 4 - playerDirection.z * 3, arrowZ - playerDirection.z * 4 + playerDirection.x * 3);
    ctx.closePath();
    ctx.fill();
    
    // Remove clipping and draw circular border
    ctx.restore();
    
    // Draw outer border
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, canvas.width / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw inner border
    ctx.strokeStyle = '#555577';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, canvas.width / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw cardinal direction indicators (N, E, S, W)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // North
    ctx.fillText('N', centerX, 15);
    // East
    ctx.fillText('E', canvas.width - 15, centerY);
    // South
    ctx.fillText('S', centerX, canvas.height - 15);
    // West
    ctx.fillText('W', 15, centerY);
}

   

_updateMinimap() {

    // Draw tokens on minimap overlay
    this._drawTokensOnMinimap();
}

    // Add this new method to create and update token indicators
    

_updateCamera() {
    const distance = 6;  // Distance behind player
    const height = 2.5;  // Height above player

    // Calculate camera position behind the player
    const camOffset = new THREE.Vector3(0, 0, -distance)
        .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    this.camera.position.copy(this.player.position).add(camOffset);
    this.camera.position.y += height;
    
    // Make camera look at a point slightly ahead of the player
    const lookAtPoint = this.player.position.clone();
    const lookOffset = new THREE.Vector3(0, 0, 3) 
        .applyEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    lookAtPoint.add(lookOffset);
    lookAtPoint.y += 1; // Look at player's head level
    
    this.camera.lookAt(lookAtPoint);
}

    loop = () => {
        requestAnimationFrame(this.loop);

        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Check for collectible collisions
        this._checkCollectibleCollisions();

        // Animate collectibles (gentle floating rotation)
        if (this.scene.userData.collectibles) {
            this.scene.userData.collectibles.forEach(collectible => {
                if (!collectible.userData.collected) {
                    collectible.rotation.y += delta * 0.5;
                    collectible.position.y = 0.5 + Math.sin(now * 0.001) * 0.1;
                }
            });
        }

        // Toggle flying on key-down edge only
        if (input.flyToggle && !this.prevFlyToggle) {
            this.isFlying = !this.isFlying;
            if (this.isFlying) {
                this.flyState.isAscendingToFly = true;
                this.flyState.targetFlyHeight = this.player.position.y + 10;
            }
        }
        this.prevFlyToggle = input.flyToggle;

        if (this.isFlying) {
            const landed = updateFlying(this.player, this.camera, this.scene, delta, this.flyState);
            if (landed) {
                this.isFlying = false;
                this.flyState.isAscendingToFly = false;
            }
        } else {
            updateWalking(this.player, this.camera, this.scene, delta);
        }

        if (!this.isFlying) {
            // Make arrow face movement direction when walking
            if (input.forward !== 0 || input.right !== 0) {
                // Get camera forward and right vectors
                const cameraForward = new THREE.Vector3();
                this.camera.getWorldDirection(cameraForward);
                cameraForward.normalize();
                
                const cameraRight = new THREE.Vector3();
                cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraForward).normalize();
                
                // Calculate movement direction relative to camera (include vertical component)
                const moveDirection = new THREE.Vector3();
                moveDirection.addScaledVector(cameraForward, input.forward);
                moveDirection.addScaledVector(cameraRight, -input.right);
                moveDirection.normalize();
                
                // Calculate rotation angles for both yaw and pitch
                const yaw = Math.atan2(moveDirection.x, moveDirection.z);
                const pitch = -Math.asin(moveDirection.y); // Negative because Three.js pitch is inverted
                
                
                // Apply both rotations to the arrow
                this.player.rotation.y = yaw;
                this.player.rotation.x = pitch;
            }
        } else {
            // Make arrow face camera direction when flying (include pitch)
            const camDirection = new THREE.Vector3();
            this.camera.getWorldDirection(camDirection);
            camDirection.normalize();
            
            const yaw = Math.atan2(camDirection.x, camDirection.z);
            const pitch = -Math.asin(camDirection.y); // Negative because Three.js pitch is inverted
            
            this.player.rotation.y = yaw;
            this.player.rotation.x = pitch;
        }

        // Update main camera
        this._updateCamera();

        // Update minimap
        this._updateMinimap();

        // ADDED: Update speed boost UI
        this._updateSpeedBoostUI();
        this._updateScreenEffects();

        // Position 3D crosshair
        if (this.crosshair3D) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            dir.normalize();
            const distance = 5.0;
            const targetPos = this.player.position.clone().add(dir.multiplyScalar(distance));
            targetPos.y = this.player.position.y + 0.6;
            this.crosshair3D.position.copy(targetPos);
            this.crosshair3D.lookAt(this.camera.position);
        }

        // Render main scene
        this.renderer.render(this.scene, this.camera);
        
        // Render UI scene on top (with autoClear disabled to preserve main scene)
        this.renderer.autoClear = false;
        this.renderer.render(this.uiScene, this.uiCamera);
        this.renderer.autoClear = true;
    }
}