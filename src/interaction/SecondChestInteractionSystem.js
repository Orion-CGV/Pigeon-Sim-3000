// Second Chest Interaction System - Handles second chest interaction and viewing mode
import * as THREE from 'three';
// gsap is loaded globally via script tag in index.html

/**
 * SecondChestInteractionSystem - Manages second chest interaction, camera sequences, and viewing mode
 * Similar to TreasureInteractionSystem but for the second chest (mChest__0) that unlocks after all levels
 */
export class SecondChestInteractionSystem {
    constructor(scene, camera, cameraControl, storySystem, storyUI) {
        this.scene = scene;
        this.camera = camera;
        this.cameraControl = cameraControl;
        this.storySystem = storySystem;
        this.storyUI = storyUI;
        
        // Viewing mode state
        this.isInViewingMode = false;
        this.secondChest = null;
        this.secondChestLid = null;
        this.chestPosition = new THREE.Vector3();
        
        // Stored positions for transitions
        this.originalCameraPos = null;
        this.playerPos = null;
        this.closeUpPosition = null;
        this.topDownPosition = null;
        
        // Paper collection
        this.paper = null;
        this.fKeyLocked = false;
        this.collectionPrompt = null;
        
        // Direct keydown listener for F key
        this.boundFKeyHandler = this.handleFKeyPress.bind(this);
    }
    
    /**
     * Handle F key press directly (fallback method)
     */
    handleFKeyPress(e) {
        if (e.key.toLowerCase() === 'f' && !this.fKeyLocked) {
            // Check if we're interacting with the second chest
            const isInteracting = this.scene.userData.currentInteractable === this.secondChest ||
                                 (this.secondChest && this.scene.userData.currentInteractable?.name === this.secondChest?.name);
            
            if (this.isInViewingMode || isInteracting) {
                this.triggerCutsceneFromChest();
                this.fKeyLocked = true;
                setTimeout(() => {
                    this.fKeyLocked = false;
                }, 500);
            }
        }
    }
    
    /**
     * Initializes the second chest interaction system
     */
    init() {
        // Get chest objects from scene
        this.secondChest = this.scene.userData.secondChest;
        this.secondChestLid = this.scene.userData.secondChestLid;
        
        if (this.secondChest && this.secondChestLid) {
            this.secondChest.getWorldPosition(this.chestPosition);
            console.log('✅ SecondChestInteractionSystem initialized');
            console.log('📍 Second chest found:', this.secondChest.name, 'at position:', this.chestPosition);
            console.log('✅ Second chest lid found:', this.secondChestLid.name);
        } else {
            // Try to find chest in the scene manually
            this.scene.traverse((child) => {
                if (child.name && (
                    child.name === 'mChest__0' || 
                    child.name.toLowerCase() === 'mchest__0'
                )) {
                    this.secondChest = child;
                    this.scene.userData.secondChest = child;
                }
                if (child.name && (
                    child.name === 'mLid__0' || 
                    child.name.toLowerCase() === 'mlid__0'
                )) {
                    this.secondChestLid = child;
                    this.scene.userData.secondChestLid = child;
                }
            });
            
            if (this.secondChest && this.secondChestLid) {
                this.secondChest.getWorldPosition(this.chestPosition);
                console.log('✅ SecondChestInteractionSystem initialized (found by traversal)');
            }
        }
        
        // Find paper in the chest
        this.findPaper();
        
        // Initialize collection prompt UI
        this.initCollectionPrompt();
        
        // Add direct F key listener
        document.addEventListener('keydown', this.boundFKeyHandler);
    }
    
    /**
     * Finds paper object in the scene (inside the chest)
     */
    findPaper() {
        this.paper = null;
        
        this.scene.traverse((child) => {
            if (!child.name) return;
            
            const name = child.name.toLowerCase();
            const isPaper = name.includes('paper') || name.includes('note') || name.includes('letter');
            
            if (isPaper) {
                this.paper = child;
                console.log('✅ Found paper:', child.name);
            }
        });
        
        // Also check in scene.userData if paper is stored there
        if (!this.paper && this.scene.userData.paper) {
            this.paper = this.scene.userData.paper;
        }
        
        console.log(`📍 Paper found: ${this.paper ? this.paper.name : 'none'}`);
    }
    
    /**
     * Initialize collection prompt UI
     */
    initCollectionPrompt() {
        if (this.collectionPrompt) return;
        
        this.collectionPrompt = document.createElement("div");
        this.collectionPrompt.className = "game-ui collection-prompt";
        this.collectionPrompt.style.cssText = `
            position: fixed;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            color: #00ff00;
            font-family: 'Jersey 10', sans-serif;
            font-size: 16px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.2s ease;
            text-align: center;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px 18px;
            border-radius: 5px;
            border: 1px solid #00ff00;
        `;
        this.collectionPrompt.textContent = "F to play cutscene";
        document.body.appendChild(this.collectionPrompt);
        console.log('✅ Collection prompt initialized');
    }
    
    /**
     * Handles second chest interaction - goes straight to end scene cutscene
     */
    handleInteraction() {
        // If already in viewing mode, exit it
        if (this.isInViewingMode) {
            this.exitViewingMode();
            return;
        }
        
        // Try to get chest objects - refresh from scene if needed
        if (!this.secondChest) {
            this.secondChest = this.scene.userData.secondChest;
        }
        if (!this.secondChestLid) {
            this.secondChestLid = this.scene.userData.secondChestLid;
        }
        
        // If still not found, try to find them by traversing the scene
        if (!this.secondChest || !this.secondChestLid) {
            this.scene.traverse((child) => {
                if (child.name && (
                    child.name === 'mChest__0' || 
                    child.name.toLowerCase() === 'mchest__0'
                )) {
                    this.secondChest = child;
                    this.scene.userData.secondChest = child;
                }
                if (child.name && (
                    child.name === 'mLid__0' || 
                    child.name.toLowerCase() === 'mlid__0'
                )) {
                    this.secondChestLid = child;
                    this.scene.userData.secondChestLid = child;
                }
            });
        }
        
        // If still not found, try one more time to refresh from scene.userData
        if (!this.secondChest) {
            this.secondChest = this.scene.userData.secondChest;
        }
        if (!this.secondChestLid) {
            this.secondChestLid = this.scene.userData.secondChestLid;
        }
        
        // Only warn if we still can't find them
        if (!this.secondChest || !this.secondChestLid) {
            console.warn('Second chest or lid not found - cannot trigger cutscene');
            return;
        }
        
        // Go straight to cutscene (skip viewing mode)
        console.log('✅ Second chest interacted - triggering end scene cutscene...');
        this.startCutsceneSequence();
    }
    
    /**
     * Enters viewing mode - locks player and shows chest
     * @param {boolean} alreadyOpened - Whether the chest is already opened
     */
    enterViewingMode(alreadyOpened = false) {
        const player = this.scene.getObjectByName('player');
        
        // Lock player in place
        this.scene.userData.playerLocked = true;
        if (player) {
            this.scene.userData.lockedPlayerPosition = player.position.clone();
            this.playerPos = player.position.clone();
        }
        
        // Update chest position
        this.secondChest.getWorldPosition(this.chestPosition);
        
        // Store original camera state
        this.originalCameraPos = this.camera.position.clone();
        
        // Calculate camera positions
        this.closeUpPosition = new THREE.Vector3(
            this.chestPosition.x + 0.75,
            this.chestPosition.y + 0.75,
            this.chestPosition.z + 0.75
        );
        
        this.topDownPosition = new THREE.Vector3(
            this.chestPosition.x,
            this.chestPosition.y + 0.75,
            this.chestPosition.z
        );
        
        // Disable camera control temporarily
        if (this.cameraControl) {
            this.cameraControl.useCollision = false;
            this.cameraControl.isPointerLocked = false;
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
        
        if (alreadyOpened) {
            // If already opened, go straight to top-down view
            this.showTopDownView();
        } else {
            // If not opened, do the opening sequence
            this.openChestSequence();
        }
    }
    
    /**
     * Opens the chest with camera sequence
     */
    openChestSequence() {
        // Step 1: Pan camera to close-up view
        gsap.to(this.camera.position, {
            x: this.closeUpPosition.x,
            y: this.closeUpPosition.y,
            z: this.closeUpPosition.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(this.chestPosition);
            },
            onComplete: () => {
                // Step 2: Open the lid
                this.openLid();
            }
        });
    }
    
    /**
     * Opens the chest lid (rotates -90 degrees on X-axis)
     */
    openLid() {
        const originalRotationX = this.secondChestLid.rotation.x;
        const targetRotationX = originalRotationX - (Math.PI / 2); // -90 degrees in radians (rotate around X axis)
        
        // Play chest open sound
        this.playChestSound();
        
        gsap.to(this.secondChestLid.rotation, {
            x: targetRotationX,
            duration: 1.5,
            ease: "power2.out",
            onComplete: () => {
                console.log('Second chest lid opened!');
                
                // Mark chest as opened
                this.scene.userData.secondChestOpened = true;
                
                // Step 3: Move to top-down view
                this.showTopDownView();
            }
        });
    }
    
    /**
     * Shows top-down view of chest (viewing mode)
     */
    showTopDownView() {
        gsap.to(this.camera.position, {
            x: this.topDownPosition.x,
            y: this.topDownPosition.y,
            z: this.topDownPosition.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(this.chestPosition);
            },
            onComplete: () => {
                this.camera.lookAt(this.chestPosition);
                this.isInViewingMode = true;
                
                // Log camera position and angle for top-down view
                const position = this.camera.position;
                const rotation = this.camera.rotation;
                console.log('📹 Top-down view - Camera Position:', {
                    x: position.x,
                    y: position.y,
                    z: position.z
                });
                console.log('📹 Top-down view - Camera Rotation (angles in radians):', {
                    x: rotation.x,
                    y: rotation.y,
                    z: rotation.z
                });
                
                // Refresh paper
                this.findPaper();
                
                // Show prompt to play cutscene
                if (this.collectionPrompt) {
                    this.collectionPrompt.style.visibility = "visible";
                    this.collectionPrompt.style.display = "block";
                    this.collectionPrompt.style.opacity = "1";
                    this.collectionPrompt.textContent = "F to play cutscene";
                }
                
                console.log('Entered viewing mode - Press E to exit, F to play cutscene');
            }
        });
    }
    
    /**
     * Exits viewing mode and returns to normal view
     */
    exitViewingMode() {
        if (!this.originalCameraPos) return;
        
        const player = this.scene.getObjectByName('player');
        
        // Get current player position if playerPos is null
        if (!this.playerPos && player) {
            this.playerPos = player.position.clone();
        }
        
        // Hide collection prompt immediately
        if (this.collectionPrompt) {
            this.collectionPrompt.style.opacity = "0";
            this.collectionPrompt.style.display = "none";
            this.collectionPrompt.style.visibility = "hidden";
        }
        
        // Close the lid first (if chest is opened)
        const chestOpened = this.scene.userData.secondChestOpened || false;
        if (chestOpened && this.secondChestLid) {
            // Play chest close sound
            this.playChestSound();
            
            // Get the original rotation (before it was opened)
            // The lid was rotated -90 degrees, so we need to add 90 to close it
            const currentRotationX = this.secondChestLid.rotation.x;
            const originalRotationX = currentRotationX + (Math.PI / 2); // Reverse the rotation (X axis)
            
            gsap.to(this.secondChestLid.rotation, {
                x: originalRotationX,
                duration: 1.5,
                ease: "power2.out",
                onComplete: () => {
                    // Mark chest as closed
                    this.scene.userData.secondChestOpened = false;
                    console.log('Second chest lid closed');
                }
            });
        }
        
        // Fallback: use original camera position as target if no player pos
        const targetLookAt = this.playerPos || this.originalCameraPos;
        
        // Return camera to player view
        gsap.to(this.camera.position, {
            x: this.originalCameraPos.x,
            y: this.originalCameraPos.y,
            z: this.originalCameraPos.z,
            duration: 2.0,
            ease: "power2.inOut",
            onUpdate: () => {
                // Get current player position if available
                if (player) {
                    const currentPlayerPos = player.position;
                    this.camera.lookAt(
                        currentPlayerPos.x,
                        currentPlayerPos.y + 1.5,
                        currentPlayerPos.z
                    );
                } else if (this.playerPos) {
                    // Fallback to stored position
                    this.camera.lookAt(
                        this.playerPos.x,
                        this.playerPos.y + 1.5,
                        this.playerPos.z
                    );
                } else {
                    // Fallback: look at original camera position
                    this.camera.lookAt(
                        this.originalCameraPos.x,
                        this.originalCameraPos.y - 1.5,
                        this.originalCameraPos.z
                    );
                }
            },
            onComplete: () => {
                // Re-enable camera control and player movement
                if (this.cameraControl) {
                    this.cameraControl.useCollision = true;
                }
                this.scene.userData.playerLocked = false;
                this.isInViewingMode = false;
                
                // Ensure collection prompt is hidden
                if (this.collectionPrompt) {
                    this.collectionPrompt.style.opacity = "0";
                    this.collectionPrompt.style.display = "none";
                    this.collectionPrompt.style.visibility = "hidden";
                }
                
                // Clear stored positions
                this.originalCameraPos = null;
                this.playerPos = null;
                
                console.log('Exited viewing mode');
            }
        });
    }
    
    /**
     * Plays the chest open/close sound effect
     */
    playChestSound() {
        if (window.audioManager) {
            window.audioManager.playSoundEffect('chestOpen');
        }
    }
    
    /**
     * Triggers cutscene from chest (when F is pressed)
     */
    triggerCutsceneFromChest() {
        if (!this.isInViewingMode) {
            // If not in viewing mode, enter it first, then trigger cutscene
            const chestOpened = this.scene.userData.secondChestOpened || false;
            this.enterViewingMode(chestOpened);
            
            // Wait for viewing mode to complete, then trigger cutscene
            setTimeout(() => {
                this.startCutsceneSequence();
            }, 3000); // Wait for camera animation to complete
            return;
        }
        
        // Already in viewing mode, trigger cutscene
        this.startCutsceneSequence();
    }
    
    /**
     * Starts the cutscene sequence (exits viewing mode and plays cutscene)
     */
    startCutsceneSequence() {
        console.log('✅ Triggering cutscene from chest...');
        
        // Hide collection prompt
        if (this.collectionPrompt) {
            this.collectionPrompt.style.opacity = "0";
            this.collectionPrompt.style.display = "none";
        }
        
        // Exit viewing mode first
        this.exitViewingMode();
        
        // Trigger cutscene and credits
        // Give a small delay for viewing mode to exit
        setTimeout(() => {
            this.triggerCutscene();
        }, 2000);
    }
    
    /**
     * Triggers the cutscene, then shows credits
     */
    triggerCutscene() {
        console.log('🎬 Starting end scene cutscene...');
        
        // Stop any playing music when cutscene starts
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }
        
        // Create cutscene screen (similar to story cutscene)
        const screen = document.createElement('div');
        screen.id = 'end-scene-cutscene';
        screen.className = 'cutscene-screen';
        screen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            z-index: 1002;
            display: flex;
            align-items: stretch;
            opacity: 1;
        `;
        
        // Create video element
        const video = document.createElement('video');
        video.id = 'end-scene-video';
        video.src = 'assets/videos/EndScene.mp4';
        video.preload = 'auto';
        video.playsInline = true;
        video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: cover;
        `;
        
        // Create overlay with controls
        const overlay = document.createElement('div');
        overlay.className = 'cutscene-overlay';
        overlay.style.cssText = `
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            opacity: 0;
            transition: opacity 0.3s ease-out 1s;
        `;
        
        // Create skip button
        const skipBtn = document.createElement('button');
        skipBtn.className = 'cutscene-skip-btn';
        skipBtn.textContent = 'Skip (S)';
        skipBtn.style.cssText = `
            background: rgba(0, 255, 0, 0.9);
            border: none;
            color: #000;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            font-family: 'Jersey 10', sans-serif;
        `;
        
        // Create mute/unmute button
        const unmuteBtn = document.createElement('button');
        unmuteBtn.className = 'cutscene-unmute-btn';
        unmuteBtn.textContent = 'Mute';
        unmuteBtn.style.cssText = `
            background: rgba(255,255,255,.9);
            border: none;
            color: #000;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            font-family: 'Jersey 10', sans-serif;
        `;
        
        // Create hint text
        const hint = document.createElement('div');
        hint.className = 'cutscene-hint';
        hint.textContent = 'Click anywhere or press S to skip • Tap Mute/Unmute to toggle sound';
        hint.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            font-family: 'Jersey 10', sans-serif;
            text-align: center;
        `;
        
        // Create progress bar container (matching cutscene styling)
        const progressContainer = document.createElement('div');
        progressContainer.className = 'cutscene-progress';
        progressContainer.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            overflow: hidden;
            opacity: 0.7;
        `;
        
        const progressBar = document.createElement('div');
        progressBar.id = 'end-scene-progress-bar';
        progressBar.style.cssText = `
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #00ff00, #87CEEB);
            border-radius: 2px;
            transition: width 0.1s ease;
        `;
        
        // Assemble elements
        overlay.appendChild(skipBtn);
        overlay.appendChild(unmuteBtn);
        overlay.appendChild(hint);
        progressContainer.appendChild(progressBar);
        screen.appendChild(video);
        screen.appendChild(overlay);
        screen.appendChild(progressContainer);
        document.body.appendChild(screen);
        
        // Show overlay on hover
        screen.addEventListener('mouseenter', () => {
            overlay.style.opacity = '1';
        });
        screen.addEventListener('mouseleave', () => {
            overlay.style.opacity = '0';
        });
        
        // Reset video
        video.currentTime = 0;
        video.muted = false;
        video.load();
        progressBar.style.width = '0%';
        
        // Progress bar update
        const update = () => {
            if (video.duration) {
                const pct = (video.currentTime / video.duration) * 100;
                progressBar.style.width = `${pct}%`;
            }
        };
        video.addEventListener('timeupdate', update);
        
        // Mute/unmute toggle
        const toggleMute = () => {
            video.muted = !video.muted;
            unmuteBtn.textContent = video.muted ? 'Unmute' : 'Mute';
        };
        unmuteBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMute();
        };
        
        // Finish function - hide cutscene, cleanup, and show credits
        const finish = () => {
            screen.classList.add('ended', 'hidden');
            screen.style.opacity = '0';
            video.pause();
            video.removeEventListener('timeupdate', update);
            video.onended = null;
            video.onclick = null;
            if (document._endSceneKeyHandler) {
                document.removeEventListener('keydown', document._endSceneKeyHandler);
                document._endSceneKeyHandler = null;
            }
            
            // Remove cutscene, cleanup, and show credits
            setTimeout(() => {
                screen.remove();
                
                // Cleanup the 3D scene
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.style.display = 'none';
                }
                
                // Exit viewing mode if active
                if (this.isInViewingMode) {
                    this.exitViewingMode();
                }
                
                // Cleanup this system
                this.cleanup();
                
                // Show credits (credits will return to main menu when finished/skipped)
                this.showCredits();
            }, 400);
        };
        
        // Skip handlers
        skipBtn.onclick = (e) => {
            e.stopPropagation();
            finish();
        };
        
        video.onclick = (e) => {
            e.stopPropagation();
            finish();
        };
        
        screen.onclick = (e) => {
            const target = e.target;
            const isButton = target.closest('button');
            const isProgressBar = target.id === 'end-scene-progress-bar' || target.closest('#end-scene-progress-bar');
            
            if (!isButton && !isProgressBar) {
                finish();
            }
        };
        
        progressContainer.onclick = (e) => {
            e.stopPropagation();
            finish();
        };
        
        // S key to skip
        const keyHandler = (e) => {
            if (e.key.toLowerCase() === 's') {
                finish();
            }
        };
        document._endSceneKeyHandler = keyHandler;
        document.addEventListener('keydown', keyHandler);
        
        // Auto-finish when video ends
        video.onended = () => setTimeout(finish, 400);
        
        // Start playing
        video.addEventListener('loadeddata', () => {
            const playPromise = video.play();
            if (playPromise) {
                playPromise.catch((err) => {
                    console.log('End scene video autoplay blocked or error:', err);
                });
            }
        }, { once: true });
        
        // Fallback: try to play after a short delay
        setTimeout(() => {
            if (video.readyState >= 2) {
                const playPromise = video.play();
                if (playPromise) {
                    playPromise.catch((err) => {
                        console.log('End scene video play failed:', err);
                    });
                }
            }
        }, 200);
    }
    
    /**
     * Shows the credits screen
     */
    showCredits() {
        console.log('🎬 Showing credits...');
        
        // Use the existing cinematic credits system
        if (window.showCinematicCredits && typeof window.showCinematicCredits === 'function') {
            // Hide any 3D scene elements if needed
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.style.display = 'none';
            }
            
            // Show the cinematic credits
            window.showCinematicCredits();
            
            // Add skip button handler - the skip button already exists in the HTML,
            // but we can ensure ESC key works to skip credits
            const skipCreditsHandler = (e) => {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    if (window.skipCinematicCredits && typeof window.skipCinematicCredits === 'function') {
                        window.skipCinematicCredits();
                        document.removeEventListener('keydown', skipCreditsHandler);
                    }
                }
            };
            document.addEventListener('keydown', skipCreditsHandler);
        } else {
            console.warn('Cinematic credits system not available - showing fallback');
            // Fallback: show simple credits screen
            const creditsScreen = document.createElement('div');
            creditsScreen.id = 'credits-screen';
            creditsScreen.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-family: 'Jersey 10', sans-serif;
                font-size: 20px;
                text-align: center;
                overflow-y: auto;
                padding: 50px;
            `;
            creditsScreen.innerHTML = `
                <div>
                    <h1 style="font-size: 32px; margin-bottom: 30px;">CREDITS</h1>
                    <p style="font-size: 16px; margin: 20px 0;">Credits will be added here...</p>
                    <p style="font-size: 12px; margin-top: 50px; opacity: 0.7;">Thank you for playing!</p>
                </div>
            `;
            document.body.appendChild(creditsScreen);
        }
    }
    
    /**
     * Updates the system (called every frame)
     * @param {object} keys - Input keys object
     */
    update(keys = {}) {
        // Update chest position if needed (in case it moves)
        if (this.secondChest && this.isInViewingMode) {
            this.secondChest.getWorldPosition(this.chestPosition);
            // Keep camera looking at chest in viewing mode
            this.camera.lookAt(this.chestPosition);
            
            // Handle F key to trigger cutscene - InputSystem stores keys as lowercase
            if (keys && keys['f']) {
                this.handleCutsceneKey(true);
            }
        }
    }
    
    /**
     * Handles F key press to trigger cutscene
     * @param {boolean} fKeyPressed - Whether F key is currently pressed
     */
    handleCutsceneKey(fKeyPressed) {
        if (!fKeyPressed || this.fKeyLocked) {
            return;
        }
        
        // Check if we're interacting with the second chest
        const isInteracting = this.isInViewingMode || 
                             (this.scene.userData.currentInteractable === this.secondChest) ||
                             (this.secondChest && this.scene.userData.currentInteractable?.name === this.secondChest?.name);
        
        if (isInteracting) {
            // Trigger cutscene
            this.triggerCutsceneFromChest();
            this.fKeyLocked = true;
            
            // Unlock after delay
            setTimeout(() => {
                this.fKeyLocked = false;
            }, 500);
        }
    }
    
    /**
     * Checks if currently in viewing mode
     * @returns {boolean} True if in viewing mode
     */
    isViewingMode() {
        return this.isInViewingMode;
    }
    
    /**
     * Cleanup the system
     */
    cleanup() {
        // Exit viewing mode if active
        if (this.isInViewingMode) {
            this.exitViewingMode();
        }
        
        // Remove collection prompt
        if (this.collectionPrompt && this.collectionPrompt.parentNode) {
            this.collectionPrompt.parentNode.removeChild(this.collectionPrompt);
            this.collectionPrompt = null;
        }
        
        // Remove F key listener
        if (this.boundFKeyHandler) {
            document.removeEventListener('keydown', this.boundFKeyHandler);
            this.boundFKeyHandler = null;
        }
        
        // Re-enable player movement
        this.scene.userData.playerLocked = false;
        
        // Clear references
        this.secondChest = null;
        this.secondChestLid = null;
        this.paper = null;
    }
}
