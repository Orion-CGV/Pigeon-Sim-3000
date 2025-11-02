// Interaction System - Handles detecting and processing interactions with interactive objects
import * as THREE from 'three';

/**
 * InteractionSystem - Manages interaction detection (raycasting, prompts, interactions)
 */
export class InteractionSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.interactionDistance = 3; // How close player needs to be to interact
        this.currentInteractable = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0); // Screen coordinates (center of screen)
        this.eKeyLocked = false; // Prevent rapid E key presses
        this.interactionPrompt = null;
        this.crosshair = null;
        this.onInteractCallback = null; // Callback when interaction occurs
        this.joystickSubtitleShown = false; // Track if the "no joysticks" subtitle has been shown
        this.lockedMachineSubtitleShown = new Set(); // Track which locked machines have shown the "joysticks don't work" subtitle
    }

    /**
     * Initializes the interaction system
     * Creates UI elements (prompt, crosshair) and sets up raycaster
     */
    init() {
        // Create interaction prompt (className 'game-ui' for easy cleanup)
        this.interactionPrompt = document.createElement("div");
        // Add class for easy identification and cleanup
        this.interactionPrompt.className = "game-ui";
        // Style the prompt with CSS text for better performance
        this.interactionPrompt.style.cssText = `
            position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%); 
            color: white; font-family: 'Jersey 10', sans-serif; font-size: 20px; font-weight: bold; 
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8); pointer-events: none; z-index: 10; 
            text-align: center; opacity: 0; transition: opacity 0.3s ease;
        `;
        // Set default prompt text
        this.interactionPrompt.textContent = "E to interact";
        // Add prompt to document
        document.body.appendChild(this.interactionPrompt);

        // Crosshair (className 'game-ui' for easy cleanup)
        this.crosshair = document.createElement("div");
        // Add class for easy identification and cleanup
        this.crosshair.className = "game-ui";
        // Style crosshair
        this.crosshair.style.cssText = `
            position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; 
            margin-left: -10px; margin-top: -10px; pointer-events: none; z-index: 10;
        `;
        // Create crosshair using HTML divs
        this.crosshair.innerHTML = `
            <div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:white"></div>
            <div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:white"></div>
        `;
        // Add crosshair to document
        document.body.appendChild(this.crosshair);

        // Store interaction system data in scene for easy access
        this.scene.userData.interactionPrompt = this.interactionPrompt;
        this.scene.userData.currentInteractable = this.currentInteractable;
        this.scene.userData.raycaster = this.raycaster;
        this.scene.userData.mouse = this.mouse;
    }

    /**
     * Sets callback to be called when interaction occurs
     * @param {Function} callback - Callback function that receives the interactable object
     */
    setOnInteract(callback) {
        this.onInteractCallback = callback;
    }
    
    /**
     * Sets callback to be called when treasure interaction occurs
     * @param {Function} callback - Callback function for treasure interaction
     */
    setOnTreasureInteract(callback) {
        this.onTreasureInteractCallback = callback;
    }
    
    /**
     * Gets the color name for an arcade based on its level
     * Level 1 = Blue (Pigeon Simulator)
     * Level 2 = Green (Speed Delivery Game)
     * Level 3 = Grey (Gravity Cube Game)
     * @param {number} level - Level number
     * @returns {string} Color name
     */
    getArcadeColorName(level) {
        const colorMap = {
            1: 'Blue',   // Pigeon Simulator
            2: 'Green',  // Speed Delivery Game
            3: 'Grey'    // Gravity Cube Game
        };
        return colorMap[level] || 'Unknown';
    }

    /**
     * Checks if player is looking at an interactive object and close enough to interact
     * @param {string} currentLevel - Current level identifier
     */
    checkInteractions(currentLevel) {
        // Only check interactions in main menu, not during levels
        if (currentLevel !== 'main') return;
        
        // Get interactable objects (arcades and treasure)
        const arcades = this.scene.userData.arcades || [];
        const treasure = this.scene.userData.treasure;
        const secondChest = this.scene.userData.secondChest;
        
        const player = this.scene.getObjectByName('player');
        if (!player) {
            this.interactionPrompt.style.opacity = "0";
            return;
        }
        
        // Check story system for lock status
        const storySystem = this.scene.userData.storySystem;
        const allLevelsCompleted = storySystem ? storySystem.areAllLevelsCompleted() : false;
        
        // Build array of all interactable objects for raycasting
        const interactableObjects = [...arcades];
        if (treasure) {
            interactableObjects.push(treasure);
        }
        if (secondChest) {
            interactableObjects.push(secondChest);
        }
        
        if (interactableObjects.length === 0) {
            this.interactionPrompt.style.opacity = "0";
            this.currentInteractable = null;
            this.scene.userData.currentInteractable = null;
            return;
        }
        
        // Raycast from center of screen
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // SAFE: Filter out objects without .layers to prevent Three.js crash
        // But also ensure treasure meshes are included in raycast
        const validObjects = interactableObjects.filter(obj => {
            if (!obj.layers) {
                // Try to set layers if missing
                if (obj.layers === undefined) {
                    obj.layers = new THREE.Layers();
                }
            }
            return obj.layers !== undefined;
        });
        
        // If no valid objects, skip raycast
        if (validObjects.length === 0) {
            this.interactionPrompt.style.opacity = "0";
            this.currentInteractable = null;
            this.scene.userData.currentInteractable = null;
            return;
        }

        // Perform raycast (recursive = true) - this will hit all child meshes
        const intersects = this.raycaster.intersectObjects(validObjects, true);
        
        if (intersects.length > 0 && player) {
            const hitObject = intersects[0].object;
            
            // Check if we hit the second chest (traverse up the parent tree)
            let secondChestHit = hitObject;
            let foundSecondChest = null;
            while (secondChestHit) {
                if (secondChestHit === secondChest || 
                    secondChestHit.name === 'mChest__0' || 
                    secondChestHit.name === 'mChest__0' ||
                    (secondChest && secondChestHit.parent === secondChest)) {
                    foundSecondChest = secondChest;
                    break;
                }
                secondChestHit = secondChestHit.parent;
            }
            
            // If we hit the second chest
            if (foundSecondChest) {
                const secondChestWorldPos = new THREE.Vector3();
                foundSecondChest.getWorldPosition(secondChestWorldPos);
                const distance = player.position.distanceTo(secondChestWorldPos);
                if (distance <= this.interactionDistance) {
                    // Check if in viewing mode
                    const isSecondChestViewingMode = this.scene.userData.secondChestInteractionSystem?.isViewingMode?.() || false;
                    
                    if (isSecondChestViewingMode) {
                        this.interactionPrompt.textContent = "E to exit viewing mode";
                        this.interactionPrompt.style.opacity = "1";
                        this.currentInteractable = foundSecondChest;
                        this.scene.userData.currentInteractable = foundSecondChest;
                        this.scene.userData.currentInteractableType = 'secondChest';
                        return;
                    } else if (allLevelsCompleted) {
                        const secondChestOpened = this.scene.userData.secondChestOpened || false;
                        if (!secondChestOpened) {
                            this.interactionPrompt.textContent = "E to open chest";
                        } else {
                            this.interactionPrompt.textContent = "E to view chest";
                        }
                        this.interactionPrompt.style.opacity = "1";
                        this.currentInteractable = foundSecondChest;
                        this.scene.userData.currentInteractable = foundSecondChest;
                        this.scene.userData.currentInteractableType = 'secondChest';
                        return;
                    } else {
                        // Not all levels completed - show locked message
                        this.interactionPrompt.textContent = "Chest is locked - Complete all levels";
                        this.interactionPrompt.style.opacity = "1";
                        this.currentInteractable = foundSecondChest;
                        this.scene.userData.currentInteractable = foundSecondChest;
                        this.scene.userData.currentInteractableType = 'secondChest';
                        return;
                    }
                }
            }
            
            // Check if we hit the treasure (traverse up the parent tree)
            let treasureHit = hitObject;
            let foundTreasure = null;
            while (treasureHit) {
                if (treasureHit === treasure || 
                    treasureHit.name === 'treasure' || 
                    treasureHit.name === 'Treasure' ||
                    (treasure && treasureHit.parent === treasure)) {
                    foundTreasure = treasure;
                    break;
                }
                treasureHit = treasureHit.parent;
            }
            
            // If we hit the treasure
            if (foundTreasure) {
                const treasureWorldPos = new THREE.Vector3();
                foundTreasure.getWorldPosition(treasureWorldPos);
                const distance = player.position.distanceTo(treasureWorldPos);
                if (distance <= this.interactionDistance) {
                    // Check if in viewing mode
                    const isTreasureViewingMode = this.scene.userData.treasureInteractionSystem?.isViewingMode?.() || false;
                    
                    if (isTreasureViewingMode) {
                        this.interactionPrompt.textContent = "E to exit viewing mode";
                        this.interactionPrompt.style.opacity = "1";
                        this.currentInteractable = foundTreasure;
                        this.scene.userData.currentInteractable = foundTreasure;
                        this.scene.userData.currentInteractableType = 'treasure';
                        return;
                    } else {
                        // Check if treasure has already been opened
                        const treasureOpened = this.scene.userData.treasureOpened || false;
                        if (!treasureOpened) {
                            this.interactionPrompt.textContent = "E to open treasure chest";
                        } else {
                            this.interactionPrompt.textContent = "E to view treasure";
                        }
                        this.interactionPrompt.style.opacity = "1";
                        this.currentInteractable = foundTreasure;
                        this.scene.userData.currentInteractable = foundTreasure;
                        this.scene.userData.currentInteractableType = 'treasure';
                        return;
                    }
                }
            }
            
            // Otherwise check for arcades
            // Traverse up to find root arcade (named arcade-1, arcade-2, etc.)
            let arcade = hitObject;
            while (arcade && !arcade.name.startsWith('arcade-')) {
                arcade = arcade.parent;
            }
            
            if (arcade && arcade.userData.level) {
                const distance = player.position.distanceTo(arcade.position);
                
                if (distance <= this.interactionDistance) {
                    // Check story system for level access
                    const storySystem = this.scene.userData.storySystem;
                    const level = arcade.userData.level;
                    
                    if (storySystem && !storySystem.canAccessLevel(level)) {
                        // Check if joysticks have been collected
                        const inventorySystem = this.scene.userData.inventorySystem || window.inventorySystem;
                        const hasJoysticks = inventorySystem && inventorySystem.hasItem('Joystick');
                        
                        if (!hasJoysticks) {
                            // Allow interaction even if level is locked, if joysticks haven't been collected
                            const colorName = this.getArcadeColorName(level);
                            this.interactionPrompt.textContent = `E to interact with ${colorName} machine`;
                            this.interactionPrompt.style.opacity = "1";
                            this.currentInteractable = arcade;
                            this.scene.userData.currentInteractable = arcade;
                            this.scene.userData.currentInteractableType = 'arcade';
                            return;
                        } else {
                            // Level is locked but joysticks are collected - allow interaction to show subtitle
                            const colorName = this.getArcadeColorName(level);
                            this.interactionPrompt.textContent = `E to interact with ${colorName} machine`;
                            this.interactionPrompt.style.opacity = "1";
                            this.currentInteractable = arcade;
                            this.scene.userData.currentInteractable = arcade;
                            this.scene.userData.currentInteractableType = 'arcade';
                            // Hide lock reason if visible
                            if (this.lockReasonElement) {
                                this.lockReasonElement.style.opacity = "0";
                            }
                            return;
                        }
                    } else {
                        // Hide lock reason if visible
                        if (this.lockReasonElement) {
                            this.lockReasonElement.style.opacity = "0";
                        }
                    }
                    
                    // Level is accessible
                    const colorName = this.getArcadeColorName(level);
                    this.interactionPrompt.textContent = `E to interact with ${colorName} machine`;
                    this.interactionPrompt.style.opacity = "1";
                    this.currentInteractable = arcade;
                    this.scene.userData.currentInteractable = arcade;
                    this.scene.userData.currentInteractableType = 'arcade';
                    return;
                }
            }
        }
        
        // No interaction
        this.interactionPrompt.style.opacity = "0";
        this.currentInteractable = null;
        this.scene.userData.currentInteractable = null;
        
        // Hide lock reason if visible
        if (this.lockReasonElement) {
            this.lockReasonElement.style.opacity = "0";
        }
    }

    /**
     * Handles interaction when player presses E key while looking at interactable object
     * @param {string} currentLevel - Current level identifier
     * @param {Object} keys - Object tracking which keys are pressed
     */
    handleInteraction(currentLevel, keys) {
        // Only handle interactions in main menu
        if (currentLevel !== 'main') return;
        
        // Check if there's an interactable, E key is pressed, and not locked (anti-spam)
        if (this.currentInteractable && keys["e"] && !this.eKeyLocked) {
            const interactableType = this.scene.userData.currentInteractableType;
            
            // Check story system for lock status
            const storySystem = this.scene.userData.storySystem;
            const allLevelsCompleted = storySystem ? storySystem.areAllLevelsCompleted() : false;
            
            // Handle second chest interaction
            if (interactableType === 'secondChest') {
                // Check if all levels are completed
                if (!allLevelsCompleted) {
                    // Chest is locked - don't allow interaction
                    console.log('Chest is locked - Complete all levels first');
                    return;
                }
                
                // All levels completed - delegate to SecondChestInteractionSystem
                const secondChestSystem = this.scene.userData.secondChestInteractionSystem;
                if (secondChestSystem) {
                    secondChestSystem.handleInteraction();
                } else {
                    console.warn('⚠️ SecondChestInteractionSystem not found');
                }
                // Lock E key to prevent rapid repeated interactions
                this.eKeyLocked = true;
                setTimeout(() => {
                    this.eKeyLocked = false;
                }, 1000);
                return;
            }
            
            // Handle treasure interaction
            if (interactableType === 'treasure') {
                // Check if we're in viewing mode (allow E to exit)
                const isViewingMode = this.scene.userData.treasureInteractionSystem?.isViewingMode?.() || false;
                
                // Lock E key briefly to prevent spam
                this.eKeyLocked = true;
                
                // Call treasure interaction handler (will toggle viewing mode)
                if (this.onTreasureInteractCallback) {
                    this.onTreasureInteractCallback();
                }
                
                // Reset key lock after a delay
                setTimeout(() => {
                    this.eKeyLocked = false;
                }, 500);
                return;
            }
            
            // Handle arcade interaction
            if (interactableType === 'arcade') {
                // Double-check story system access before allowing interaction
                const storySystem = this.scene.userData.storySystem;
                const level = this.currentInteractable.userData.level;
                
                // Check if joysticks have been collected
                const inventorySystem = this.scene.userData.inventorySystem || window.inventorySystem;
                const hasJoysticks = inventorySystem && inventorySystem.hasItem('Joystick');
                
                if (storySystem && !storySystem.canAccessLevel(level)) {
                    // Level is locked - check if joysticks have been collected
                    if (!hasJoysticks) {
                        // Show subtitle about missing joysticks (only once)
                        if (!this.joystickSubtitleShown) {
                            const subtitleSystem = this.scene.userData.subtitleSystem || window.subtitleSystem;
                            if (subtitleSystem) {
                                subtitleSystem.show("These arcade machines don't have joysticks?", 4);
                                this.joystickSubtitleShown = true;
                            }
                        }
                        
                        // Lock E key briefly to prevent spam
                        this.eKeyLocked = true;
                        setTimeout(() => {
                            this.eKeyLocked = false;
                        }, 500);
                        return;
                    } else {
                        // Level is locked and joysticks have been collected - show subtitle about joysticks not working
                        if (!this.lockedMachineSubtitleShown.has(level)) {
                            const subtitleSystem = this.scene.userData.subtitleSystem || window.subtitleSystem;
                            if (subtitleSystem) {
                                subtitleSystem.show("The joysticks don't seem to work here yet", 4);
                                this.lockedMachineSubtitleShown.add(level);
                            }
                        }
                        
                        // Lock E key briefly to prevent spam
                        this.eKeyLocked = true;
                        setTimeout(() => {
                            this.eKeyLocked = false;
                        }, 500);
                        return;
                    }
                }
                
                // Lock E key to prevent rapid repeated interactions
                this.eKeyLocked = true;
                
                // Call the interaction callback if set
                if (this.onInteractCallback) {
                    // IMPORTANT: Defer level loading until AFTER current animation frame completes
                    // This prevents double animation loops (old frame + new frame running simultaneously)
                    setTimeout(() => {
                        this.onInteractCallback(level);
                    }, 0);
                }
                
                // Reset key lock after a delay (1 second)
                setTimeout(() => {
                    this.eKeyLocked = false;
                }, 1000);
            }
        }
    }

    /**
     * Updates the interaction system (called every frame)
     * @param {string} currentLevel - Current level identifier
     * @param {Object} keys - Object tracking which keys are pressed
     */
    update(currentLevel, keys) {
        this.checkInteractions(currentLevel);
        this.handleInteraction(currentLevel, keys);
    }

    /**
     * Cleanup interaction system (removes UI elements)
     */
    cleanup() {
        if (this.interactionPrompt && this.interactionPrompt.parentNode) {
            this.interactionPrompt.parentNode.removeChild(this.interactionPrompt);
            this.interactionPrompt = null;
        }
        if (this.crosshair && this.crosshair.parentNode) {
            this.crosshair.parentNode.removeChild(this.crosshair);
            this.crosshair = null;
        }
        if (this.lockReasonElement && this.lockReasonElement.parentNode) {
            this.lockReasonElement.parentNode.removeChild(this.lockReasonElement);
            this.lockReasonElement = null;
        }
        this.currentInteractable = null;
        this.eKeyLocked = false;
    }
    
    /**
     * Gets the current interactable object
     * @returns {THREE.Object3D|null} Current interactable object
     */
    getCurrentInteractable() {
        return this.currentInteractable;
    }
}

