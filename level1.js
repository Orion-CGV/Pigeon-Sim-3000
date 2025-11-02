// level1.js - Wrapper for level1 directory Game class
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Game } from './level1/src/gameManager/game.js';
import { input } from './level1/src/input/inputHandler.js';
import { updateWalking } from './level1/src/physics/movement.js';
import { updateFlying, getSpeedBoostState } from './level1/src/physics/flight.js';
import { getWalkSpeedBoostState as getWalkBoostState } from './level1/src/physics/movement.js';

let gameInstance = null;
let scene, camera, renderer, labelRenderer;
let returnToMainCallback;
let isInitialized = false;
let gameLoopRunning = false;
let lastUpdateTime = performance.now();

// Store reference to original Game loop so we can override it
let originalGameLoop = null;

/**
 * Initialize level 1 - adapts Game class to work with main.js system
 */
export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
    scene = sceneRef;
    camera = cameraRef;
    renderer = rendererRef;
    labelRenderer = labelRendererRef;
    returnToMainCallback = callback;
    isInitialized = true;

    // Clear the scene (main.js handles most cleanup, but this ensures a clean slate)
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }

    // Patch texture loading to fix paths (textures are in level1/src/models/textures)
    // This fixes the relative path issue when running from root index.html
    const originalTextureLoad = THREE.TextureLoader.prototype.load;
    THREE.TextureLoader.prototype.load = function(url, onLoad, onProgress, onError) {
        // Fix relative paths that expect to be in level1/src/
        if (url && typeof url === 'string') {
            // If path starts with ./models/textures, fix it
            if (url.startsWith('./models/textures/') || url.startsWith('models/textures/')) {
                url = url.replace(/^\.?\/?models\/textures\//, 'level1/src/models/textures/');
            }
            // Also handle ./models/ paths for other models
            if (url.startsWith('./models/') && !url.includes('textures')) {
                url = url.replace(/^\.?\/?models\//, 'level1/src/models/');
            }
        }
        return originalTextureLoad.call(this, url, onLoad, onProgress, onError);
    };

    // Patch GLTFLoader to fix paths for models (like pigeon.glb)
    // Store original for potential restoration
    let originalGLTFLoad = null;
    if (GLTFLoader && GLTFLoader.prototype) {
        originalGLTFLoad = GLTFLoader.prototype.load;
        GLTFLoader.prototype.load = function(url, onLoad, onProgress, onError) {
            // Fix paths for models in level1/src/models
            if (url && typeof url === 'string') {
                if (url.startsWith('./models/') || url.startsWith('models/')) {
                    url = url.replace(/^\.?\/?models\//, 'level1/src/models/');
                }
                // Fix /assets/models/pigeon.glb to level1/src/models/pigeon.glb
                if (url.startsWith('/assets/models/')) {
                    url = url.replace('/assets/models/', 'level1/src/models/');
                }
            }
            return originalGLTFLoad.call(this, url, onLoad, onProgress, onError);
        };
    }

    // Create Game instance - it will use the provided renderer
    gameInstance = new Game(renderer);

    // Restore original loaders after Game is created (in case other systems need original behavior)
    // Actually, we'll keep the patch active for the duration of the level

    // Override Game's _loadAudio to fix asset paths (they're in level1/src/assets, not root assets)
    const originalLoadAudio = gameInstance._loadAudio.bind(gameInstance);
    gameInstance._loadAudio = async function() {
        const audioLoader = new THREE.AudioLoader();
        
        // Fix paths to point to level1/src/assets from root
        const soundList = {
            collect   : 'level1/src/assets/sounds/collect.wav',
            fly       : 'level1/src/assets/sounds/fly.wav',
            boost     : 'level1/src/assets/sounds/boost.wav',
            pause     : 'level1/src/assets/sounds/pause.wav',
            victory   : 'level1/src/assets/sounds/victory.wav',
            background: 'level1/src/assets/music/nyc_ambient.mp3'
        };
        
        // Load every file in parallel
        const loadPromises = Object.entries(soundList).map(([name, url]) => {
            return audioLoader.loadAsync(url).then(buffer => ({ name, buffer }));
        });
        
        const results = await Promise.all(loadPromises);
        results.forEach(({ name, buffer }) => {
            const sound = new THREE.Audio(this.listener);
            sound.setBuffer(buffer);
            sound.setVolume(name === 'background' ? 0.35 : 0.6);
            this.sounds[name] = sound;
        });
        
        // Background music – loop + auto-start
        this.music = this.sounds.background;
        if (this.music) {
            this.music.setLoop(true);
            this.music.play();
        }
    };

    // Override Game's _startGame to prevent it from starting its own render loop
    const originalStartGame = gameInstance._startGame.bind(gameInstance);
    gameInstance._startGame = function() {
        // Call original to set up UI and game state
        originalStartGame();
        
        // Set lastTime for delta calculations
        this.lastTime = performance.now();
        
        // Override loop to prevent requestAnimationFrame
        // Store original loop logic for reference
        const originalLoop = this.loop;
        
        // Replace loop with controlled version (no requestAnimationFrame)
        this.loop = () => {
            // Don't call requestAnimationFrame - main.js handles the loop
            // All update logic will be handled in updateLevel()
            if (gameLoopRunning && this.gameLoaded) {
                // Just ensure lastTime is set
                if (!this.lastTime) {
                    this.lastTime = performance.now();
                }
            }
        };
        
        // Start our controlled update flag
        gameLoopRunning = true;
        
        console.log('✅ Level 1 game started (integrated with main.js loop)');
    };

    // Override Game's pause system to use main.js pause menu
    const originalTogglePause = gameInstance._togglePause;
    gameInstance._togglePause = function(e) {
        if (e.key !== 'Escape' || !this.gameLoaded) return;
        
        e.preventDefault();
        e.stopPropagation(); // Prevent main.js from also handling ESC
        
        // Use main.js pause menu
        if (window.pauseMenu && window.pauseMenu.show) {
            if (this.isPaused) {
                // Resume
                window.pauseMenu.resume();
                this.isPaused = false;
                if (this.timerRunning && this.pauseStartTime) {
                    const pauseDuration = (performance.now() - this.pauseStartTime) / 1000;
                    this.gameStartTime += pauseDuration * 1000;
                }
                this._requestLock();
            } else {
                // Pause
                window.pauseMenu.show(1);
                this.isPaused = true;
                if (this.timerRunning) {
                    this.pauseStartTime = performance.now();
                }
                document.exitPointerLock();
            }
        } else {
            // Fallback to original pause system
            originalTogglePause.call(this, e);
        }
    };

    // Mark Game instance as being in wrapped context
    gameInstance._isWrappedContext = true;
    
    // Set callback for when level completes (timer expires or all items collected)
    gameInstance._onLevelComplete = () => {
        // Award medal and show brief completion state
        if (gameInstance._awardMedal) {
            gameInstance._awardMedal();
        }
        
        // Stop music
        if (gameInstance.music) {
            gameInstance.music.stop();
        }
        
        // Play victory sound
        if (gameInstance._playSound) {
            gameInstance._playSound('victory');
        }
        
        // Brief delay to show completion, then return to basement
        setTimeout(() => {
            if (returnToMainCallback) {
                returnToMainCallback();
            }
        }, 1500); // 1.5 second delay to show completion state
    };

    // Override Game's end game to call return callback
    const originalEndGame = gameInstance._endGame;
    gameInstance._endGame = function() {
        // If we're in wrapped context and have completion callback, use it
        if (this._isWrappedContext && this._onLevelComplete) {
            this._awardMedal();
            // Stop music
            if (this.music) this.music.stop();
            // Play victory sound
            this._playSound('victory');
            // Call completion callback
            setTimeout(() => {
                if (this._onLevelComplete) {
                    this._onLevelComplete();
                }
            }, 1500);
        } else {
            // Original behavior for standalone mode
            originalEndGame.call(this);
        }
    };

    console.log('✅ Level 1 wrapper initialized');
}

/**
 * Update game state - extracted from Game's loop
 */
function updateGameState() {
    if (!gameInstance || !gameInstance.gameLoaded || gameInstance.isPaused || !gameInstance.timerRunning) {
        return;
    }

    const now = performance.now();
    const delta = (now - (gameInstance.lastTime || now)) / 1000;
    gameInstance.lastTime = now;

    // Update timer
    gameInstance._updateTimer();

    // Check for collectible collisions
    gameInstance._checkCollectibleCollisions();

    // Animate collectibles
    if (gameInstance.scene && gameInstance.scene.userData.collectibles) {
        gameInstance.scene.userData.collectibles.forEach(collectible => {
            if (!collectible.userData.collected) {
                collectible.rotation.y += delta * 0.5;
                collectible.position.y = 0.5 + Math.sin(now * 0.001) * 0.1;
            }
        });
    }

    // Handle flying toggle
    if (input.flyToggle && !gameInstance.prevFlyToggle) {
        gameInstance.isFlying = !gameInstance.isFlying;
        if (gameInstance.isFlying) {
            gameInstance.flyState.isAscendingToFly = true;
            gameInstance.flyState.targetFlyHeight = gameInstance.player.position.y + 10;
            gameInstance._playSound('fly', 0.8);
        }
    }
    gameInstance.prevFlyToggle = input.flyToggle;

    // Update physics
    if (gameInstance.isFlying) {
        const landed = updateFlying(gameInstance.player, gameInstance.camera, gameInstance.scene, delta, gameInstance.flyState);
        if (landed) {
            gameInstance.isFlying = false;
            gameInstance.flyState.isAscendingToFly = false;
        }
    } else {
        updateWalking(gameInstance.player, gameInstance.camera, gameInstance.scene, delta);
    }

    // Update player rotation
    if (!gameInstance.isFlying) {
        if (input.forward !== 0 || input.right !== 0) {
            const cameraForward = new THREE.Vector3();
            gameInstance.camera.getWorldDirection(cameraForward);
            cameraForward.normalize();
            
            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraForward).normalize();
            
            const moveDirection = new THREE.Vector3();
            moveDirection.addScaledVector(cameraForward, input.forward);
            moveDirection.addScaledVector(cameraRight, -input.right);
            moveDirection.normalize();
            
            const yaw = Math.atan2(moveDirection.x, moveDirection.z);
            const pitch = -Math.asin(moveDirection.y);
            
            gameInstance.player.rotation.y = yaw;
            gameInstance.player.rotation.x = pitch;
        }
    } else {
        const camDirection = new THREE.Vector3();
        gameInstance.camera.getWorldDirection(camDirection);
        camDirection.normalize();
        
        const yaw = Math.atan2(camDirection.x, camDirection.z);
        const pitch = -Math.asin(camDirection.y);
        
        gameInstance.player.rotation.y = yaw;
        gameInstance.player.rotation.x = pitch;
    }

    // Update camera
    gameInstance._updateCamera();

    // Update minimap
    gameInstance._updateMinimap();

    // Update UI
    gameInstance._updateSpeedBoostUI();
    gameInstance._updateScreenEffects();

    // Update 3D crosshair
    if (gameInstance.crosshair3D) {
        const dir = new THREE.Vector3();
        gameInstance.camera.getWorldDirection(dir);
        dir.normalize();
        const distance = 5.0;
        const targetPos = gameInstance.player.position.clone().add(dir.multiplyScalar(distance));
        targetPos.y = gameInstance.player.position.y + 0.6;
        gameInstance.crosshair3D.position.copy(targetPos);
        gameInstance.crosshair3D.lookAt(gameInstance.camera.position);
    }

    // Speed boost sounds
    const boostState = gameInstance.isFlying ? getSpeedBoostState() : getWalkBoostState();
    if (boostState.active && !gameInstance._lastBoostActive) {
        gameInstance._playSound('boost');
    }
    gameInstance._lastBoostActive = boostState.active;
}

/**
 * Update level - called by main.js animation loop
 */
export function updateLevel() {
    if (!gameInstance || !isInitialized) return;

    // Update game state
    if (gameInstance.gameLoaded && gameLoopRunning) {
        updateGameState();
        
        // Sync Game's scene/camera to main.js references
        // This ensures main.js renders Game's scene
        if (gameInstance.scene && gameInstance.camera) {
            // Copy all objects from Game's scene to main.js scene
            // (only copy children that aren't already there to avoid duplicates)
            gameInstance.scene.children.forEach(child => {
                if (child.parent !== scene) {
                    scene.add(child);
                }
            });
            
            // Sync camera properties (position, rotation, etc.)
            camera.position.copy(gameInstance.camera.position);
            camera.rotation.copy(gameInstance.camera.rotation);
            camera.quaternion.copy(gameInstance.camera.quaternion);
            camera.fov = gameInstance.camera.fov;
            camera.aspect = gameInstance.camera.aspect;
            camera.near = gameInstance.camera.near;
            camera.far = gameInstance.camera.far;
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
        }
        
        // Render UI scene on top (Game's UI elements)
        if (gameInstance.uiScene && gameInstance.uiCamera) {
            renderer.autoClear = false;
            renderer.render(gameInstance.uiScene, gameInstance.uiCamera);
            renderer.autoClear = true;
        }
    }
    
    // Note: main.js will render the scene after this, so we don't render here
}

/**
 * Cleanup level - called by main.js when leaving level
 */
export function cleanupLevel() {
    gameLoopRunning = false;

    // Remove level-specific UI elements
    const uiElements = document.querySelectorAll('.game-ui');
    uiElements.forEach(el => {
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        const isStoryUI = el.classList.contains('story-ui');
        const isInventoryUI = el.classList.contains('inventory-ui');
        const isSubtitleUI = el.classList.contains('subtitle-display');
        const isLoadingSpinner = el.classList.contains('loading-spinner');
        
        if (!isMainMenuElement && !isStoryUI && !isInventoryUI && !isSubtitleUI && !isLoadingSpinner) {
            el.remove();
        }
    });

    // Clean up Game instance
    if (gameInstance) {
        // Stop any ongoing timers
        if (gameInstance.progressInterval) {
            clearInterval(gameInstance.progressInterval);
        }
        
        // Remove welcome screen if exists
        if (gameInstance.welcomeScreen) {
            gameInstance.welcomeScreen.remove();
        }
        
        // Remove pause menu if exists
        if (gameInstance.pauseMenuElement) {
            gameInstance.pauseMenuElement.remove();
        }
        
        // Remove UI elements
        const elementsToRemove = [
            'game-crosshair', 'game-score', 'speed-boost-ui', 'screen-effect', 
            'minimap-canvas', 'game-timer', 'medal-display', 'persistent-controls',
            'victory-message', 'welcome-screen', 'pause-menu', 'progress-container'
        ];
        elementsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });

        // Stop music
        if (gameInstance.music) {
            gameInstance.music.stop();
        }

        // Stop all sounds
        if (gameInstance.sounds) {
            Object.values(gameInstance.sounds).forEach(sound => {
                if (sound && sound.stop) sound.stop();
            });
        }

        // Remove event listeners
        document.removeEventListener('keydown', gameInstance._togglePause);
        if (gameInstance.renderer && gameInstance.renderer.domElement) {
            gameInstance.renderer.domElement.removeEventListener('click', gameInstance._requestLock);
        }
        document.removeEventListener('pointerlockchange', gameInstance._onPointerLockChange);
        document.removeEventListener('mousemove', gameInstance._onMouseMove);

        gameInstance = null;
    }

    // Store references for potential restoration (currently keeping patches active)
    // THREE.TextureLoader.prototype.load = originalTextureLoad;
    // if (originalGLTFLoad && GLTFLoader) {
    //     GLTFLoader.prototype.load = originalGLTFLoad;
    // }

    isInitialized = false;
    
    console.log('✅ Level 1 cleanup complete');
}
