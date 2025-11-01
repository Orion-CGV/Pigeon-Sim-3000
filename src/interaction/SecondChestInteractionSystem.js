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
        if (this.isInViewingMode && e.key.toLowerCase() === 'f' && !this.fKeyLocked) {
            this.collectPaper();
            this.fKeyLocked = true;
            setTimeout(() => {
                this.fKeyLocked = false;
            }, 500);
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
            font-family: 'Press Start 2P', cursive;
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
        this.collectionPrompt.textContent = "F to collect paper";
        document.body.appendChild(this.collectionPrompt);
        console.log('✅ Collection prompt initialized');
    }
    
    /**
     * Handles second chest interaction - toggles between viewing mode and normal view
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
            console.warn('Second chest or lid not found - cannot enter viewing mode');
            return;
        }
        
        // Check if already opened (lid opened)
        const chestOpened = this.scene.userData.secondChestOpened || false;
        
        // Enter viewing mode
        this.enterViewingMode(chestOpened);
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
                
                // Refresh paper
                this.findPaper();
                
                // Show prompt if paper is available
                if (this.paper && !this.paper.userData.collected && this.collectionPrompt) {
                    this.collectionPrompt.style.visibility = "visible";
                    this.collectionPrompt.style.display = "block";
                    this.collectionPrompt.style.opacity = "1";
                    this.collectionPrompt.textContent = "F to collect paper";
                }
                
                console.log('Entered viewing mode - Press E to exit, F to collect paper');
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
     * Collects the paper and triggers cutscene/credits
     */
    collectPaper() {
        if (!this.isInViewingMode || !this.paper || this.paper.userData.collected) {
            return;
        }
        
        // Mark paper as collected
        this.paper.userData.collected = true;
        
        // Hide the paper
        this.paper.visible = false;
        
        console.log('✅ Paper collected! Triggering cutscene...');
        
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
        console.log('🎬 Starting cutscene...');
        
        // TODO: Play cutscene here
        // For now, we'll just show a placeholder message and then credits
        
        // Show cutscene placeholder
        const cutsceneOverlay = document.createElement('div');
        cutsceneOverlay.id = 'second-chest-cutscene';
        cutsceneOverlay.style.cssText = `
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
            font-family: 'Press Start 2P', cursive;
            font-size: 24px;
            text-align: center;
        `;
        cutsceneOverlay.innerHTML = `
            <div>
                <p>Cutscene will play here...</p>
                <p style="font-size: 16px; margin-top: 20px;">Loading credits...</p>
            </div>
        `;
        document.body.appendChild(cutsceneOverlay);
        
        // After a delay, show credits
        setTimeout(() => {
            cutsceneOverlay.remove();
            this.showCredits();
        }, 3000); // 3 seconds placeholder for cutscene
    }
    
    /**
     * Shows the credits screen
     */
    showCredits() {
        console.log('🎬 Showing credits...');
        
        // TODO: Implement credits screen
        // For now, show a placeholder
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
            font-family: 'Press Start 2P', cursive;
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
            
            // Handle collection key - InputSystem stores keys as lowercase
            if (keys && keys['f']) {
                this.handleCollectionKey(true);
            }
        }
    }
    
    /**
     * Handles F key press to collect paper
     * @param {boolean} fKeyPressed - Whether F key is currently pressed
     */
    handleCollectionKey(fKeyPressed) {
        if (!this.isInViewingMode || !fKeyPressed || this.fKeyLocked) {
            return;
        }
        
        // Collect paper
        this.collectPaper();
        this.fKeyLocked = true;
        
        // Unlock after delay
        setTimeout(() => {
            this.fKeyLocked = false;
        }, 500);
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
