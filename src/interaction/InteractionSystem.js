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
            color: white; font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; 
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
     * Checks if player is looking at an interactive object and close enough to interact
     * @param {string} currentLevel - Current level identifier
     */
    checkInteractions(currentLevel) {
        // Only check interactions in main menu, not during levels
        if (currentLevel !== 'main') return;
        
        // SAFETY: Ensure arcades array exists
        const arcades = this.scene.userData.arcades;
        if (!arcades || arcades.length === 0) {
            this.interactionPrompt.style.opacity = "0";
            this.currentInteractable = null;
            this.scene.userData.currentInteractable = null;
            return;
        }
        
        // Raycast from center of screen
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // SAFE: Filter out objects without .layers to prevent Three.js crash
        const validArcades = arcades.filter(arcade => arcade.layers !== undefined);
        
        // If no valid arcades, skip raycast
        if (validArcades.length === 0) {
            this.interactionPrompt.style.opacity = "0";
            this.currentInteractable = null;
            this.scene.userData.currentInteractable = null;
            return;
        }

        // Perform raycast (recursive = true)
        const intersects = this.raycaster.intersectObjects(validArcades, true);

        const player = this.scene.getObjectByName('player');
        
        if (intersects.length > 0 && player) {
            const hitObject = intersects[0].object;
            
            // Traverse up to find root arcade (named arcade-1, arcade-2, etc.)
            let arcade = hitObject;
            while (arcade && !arcade.name.startsWith('arcade-')) {
                arcade = arcade.parent;
            }
            
            if (!arcade || !arcade.userData.level) {
                this.interactionPrompt.style.opacity = "0";
                this.currentInteractable = null;
                this.scene.userData.currentInteractable = null;
                return;
            }

            const distance = player.position.distanceTo(arcade.position);
            
            if (distance <= this.interactionDistance) {
                this.interactionPrompt.textContent = `E to interact with ${arcade.userData.colorName} machine`;
                this.interactionPrompt.style.opacity = "1";
                this.currentInteractable = arcade;
                this.scene.userData.currentInteractable = arcade;
                return;
            }
        }
        
        // No interaction
        this.interactionPrompt.style.opacity = "0";
        this.currentInteractable = null;
        this.scene.userData.currentInteractable = null;
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
            // Lock E key to prevent rapid repeated interactions
            this.eKeyLocked = true;
            // Get level number from the arcade machine's userData
            const level = this.currentInteractable.userData.level;
            
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
        this.currentInteractable = null;
        this.eKeyLocked = false;
    }
}

