/**
 * ========================================
 * UI SYSTEM
 * ========================================
 * 
 * Manages all HUD/UI elements in the game:
 * - FPS counter
 * - Direction/Speed/Heading display
 * - Boost bar and status
 * - Camera mode display
 * - Headlights status
 * - Delivery status
 * - Minimap rendering
 * 
 * This module handles all visual feedback to the player
 * via DOM elements and canvas overlays.
 * ========================================
 */

export class UISystem {
    constructor(scene) {
        this.scene = scene;
        
        // DOM Elements
        this.elements = {
            fps: null,
            wheelDirection: null,
            carHeading: null,
            carSpeed: null,
            headlightsStatus: null,
            headlightsUI: null,
            boostStatus: null,
            boostBarFill: null,
            boostPercentage: null,
            deliveryStatus: null,
            cameraMode: null,
            minimapCanvas: null,
            minimapOverlayCanvas: null
        };
        
        // FPS Counter state
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 60;
        this.fpsUpdateInterval = 0.5; // Update FPS display every 0.5 seconds
        this.fpsTimer = 0;
        
        // Minimap state
        this.minimapRenderer = null;
        this.minimapCamera = null;
        this.minimapOverlayCtx = null;
        this.mapScale = 100; // World units to show on map
        this.mapSize = 200; // Canvas size
    }
    
    /**
     * Initialize UI system and cache DOM elements
     */
    init() {
        // Cache all DOM elements
        this.elements.fps = document.getElementById('fps');
        this.elements.wheelDirection = document.getElementById('wheel-direction');
        this.elements.carHeading = document.getElementById('car-heading');
        this.elements.carSpeed = document.getElementById('car-speed');
        this.elements.headlightsStatus = document.getElementById('headlights-status');
        this.elements.headlightsUI = document.getElementById('headlights-ui');
        this.elements.boostStatus = document.getElementById('boost-status');
        this.elements.boostBarFill = document.getElementById('boost-bar-fill');
        this.elements.boostPercentage = document.getElementById('boost-percentage');
        this.elements.deliveryStatus = document.getElementById('delivery-status');
        this.elements.cameraMode = document.getElementById('camera-mode');
        this.elements.minimapCanvas = document.getElementById('minimap');
        this.elements.minimapOverlayCanvas = document.getElementById('minimap-overlay');
        
        // Initialize minimap
        this.initMinimap();
        
        // Set initial UI values
        this.setInitialValues();
    }
    
    /**
     * Initialize the minimap renderer and camera
     */
    initMinimap() {
        if (!this.elements.minimapCanvas || !this.elements.minimapOverlayCanvas) {
            console.warn('Minimap canvases not found');
            return;
        }
        
        // Create a separate renderer for the minimap
        this.minimapRenderer = new THREE.WebGLRenderer({ 
            canvas: this.elements.minimapCanvas, 
            antialias: false, // Disabled for performance - minimap doesn't need AA
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.minimapRenderer.setSize(this.mapSize, this.mapSize);
        this.minimapRenderer.shadowMap.enabled = false; // Minimap doesn't need shadows
        
        // Get 2D context for the overlay canvas
        this.minimapOverlayCtx = this.elements.minimapOverlayCanvas.getContext('2d');
        
        // Create orthographic camera for top-down view
        const aspect = 1; // Square minimap
        const viewSize = 50; // How much of the world to show
        this.minimapCamera = new THREE.OrthographicCamera(
            -viewSize * aspect, // left
            viewSize * aspect,  // right
            viewSize,           // top
            -viewSize,          // bottom
            1,                  // near
            200                 // far
        );
        this.minimapCamera.up.set(0, 0, -1); // Set "up" direction for proper orientation
    }
    
    /**
     * Set initial values for all UI elements
     */
    setInitialValues() {
        // Initial headlight status (off in day mode) and hide UI
        if (this.elements.headlightsStatus) {
            this.elements.headlightsStatus.textContent = 'OFF';
            this.elements.headlightsStatus.style.color = '#ff4444';
        }
        
        // Hide headlights UI in day mode (default)
        if (this.elements.headlightsUI) {
            this.elements.headlightsUI.style.display = 'none';
        }
        
        // Set initial boost status (off by default)
        if (this.elements.boostStatus) {
            this.elements.boostStatus.textContent = 'OFF';
            this.elements.boostStatus.style.color = '#64b5f6';
        }
        
        // Set initial boost bar to 100%
        if (this.elements.boostBarFill) {
            this.elements.boostBarFill.style.width = '100%';
        }
        if (this.elements.boostPercentage) {
            this.elements.boostPercentage.textContent = '100%';
        }
        
        // Set initial camera mode (behind car)
        if (this.elements.cameraMode) {
            this.elements.cameraMode.textContent = 'Behind Car';
            this.elements.cameraMode.style.color = '#00ff00';
        }
    }
    
    /**
     * Update FPS counter
     * @param {number} deltaTime - Time since last frame (seconds)
     */
    updateFPS(deltaTime) {
        this.frameCount++;
        this.fpsTimer += deltaTime;
        
        if (this.fpsTimer >= this.fpsUpdateInterval) {
            this.fps = Math.round(this.frameCount / this.fpsTimer);
            if (this.elements.fps) {
                this.elements.fps.textContent = this.fps;
            }
            this.frameCount = 0;
            this.fpsTimer = 0;
        }
    }
    
    /**
     * Update direction and speed display
     * @param {number} carDirection - Current car steering direction (-1 to 1)
     * @param {Object} carWrapper - Car wrapper object with rotation
     * @param {Object} carBody - Physics body with velocity
     */
    updateDirectionDisplay(carDirection, carWrapper, carBody) {
        // Update wheel direction
        if (this.elements.wheelDirection) {
            if (carDirection < -0.1) {
                this.elements.wheelDirection.textContent = 'Left';
                this.elements.wheelDirection.style.color = '#ff6b6b';
            } else if (carDirection > 0.1) {
                this.elements.wheelDirection.textContent = 'Right';
                this.elements.wheelDirection.style.color = '#4ecdc4';
            } else {
                this.elements.wheelDirection.textContent = 'Straight';
                this.elements.wheelDirection.style.color = '#64b5f6';
            }
        }
        
        // Update car heading (convert from radians to degrees, normalize to 0-360)
        if (carWrapper && this.elements.carHeading) {
            let heading = (carWrapper.rotation.y * (180 / Math.PI)) % 360;
            if (heading < 0) heading += 360;
            this.elements.carHeading.textContent = Math.round(heading) + '°';
        }
        
        // Update speed - show actual velocity magnitude
        if (this.elements.carSpeed) {
            if (carBody) {
                const actualSpeed = Math.sqrt(
                    carBody.velocity.x ** 2 + carBody.velocity.z ** 2
                );
                this.elements.carSpeed.textContent = actualSpeed.toFixed(1);
            } else {
                this.elements.carSpeed.textContent = '0.0';
            }
        }
    }
    
    /**
     * Update boost bar and status
     * @param {number} boostAmount - Current boost amount (0-maxBoost)
     * @param {number} maxBoost - Maximum boost amount
     * @param {boolean} isBoosting - Whether currently boosting
     */
    updateBoostDisplay(boostAmount, maxBoost, isBoosting) {
        const boostPercentage = (boostAmount / maxBoost) * 100;
        
        // Update boost bar fill
        if (this.elements.boostBarFill) {
            this.elements.boostBarFill.style.width = boostPercentage + '%';
            // Add low class when below 25%
            if (boostPercentage < 25) {
                this.elements.boostBarFill.classList.add('low');
            } else {
                this.elements.boostBarFill.classList.remove('low');
            }
        }
        
        // Update percentage text
        if (this.elements.boostPercentage) {
            this.elements.boostPercentage.textContent = Math.round(boostPercentage) + '%';
        }
        
        // Update boost status (only if status changed to avoid constant DOM updates)
        if (this.elements.boostStatus) {
            if (boostAmount <= 0) {
                this.elements.boostStatus.textContent = 'EMPTY';
                this.elements.boostStatus.style.color = '#ff4444';
            } else if (isBoosting) {
                this.elements.boostStatus.textContent = 'ON';
                this.elements.boostStatus.style.color = '#ffff00';
            } else {
                this.elements.boostStatus.textContent = 'OFF';
                this.elements.boostStatus.style.color = '#64b5f6';
            }
        }
    }
    
    /**
     * Update camera mode display
     * @param {number} cameraAngle - Current camera angle (0 = behind car, 1 = top-down)
     * @param {boolean} isUserControlling - Whether user is manually controlling camera
     * @param {boolean} isResetting - Whether camera is auto-resetting
     */
    updateCameraModeDisplay(cameraAngle, isUserControlling = false, isResetting = false) {
        if (!this.elements.cameraMode) return;
        
        if (cameraAngle === 0) {
            if (isUserControlling) {
                this.elements.cameraMode.textContent = 'Behind Car (User Control)';
                this.elements.cameraMode.style.color = '#ffff00'; // Yellow when user is controlling
            } else if (isResetting) {
                this.elements.cameraMode.textContent = 'Behind Car (Resetting...)';
                this.elements.cameraMode.style.color = '#ff8800'; // Orange when resetting
            } else {
                this.elements.cameraMode.textContent = 'Behind Car';
                this.elements.cameraMode.style.color = '#00ff00'; // Green when locked
            }
        } else {
            this.elements.cameraMode.textContent = 'Top-Down';
            this.elements.cameraMode.style.color = '#ffff00';
        }
    }
    
    /**
     * Update headlights status display
     * @param {boolean} headlightsOn - Whether headlights are on
     */
    updateHeadlightsDisplay(headlightsOn) {
        if (this.elements.headlightsStatus) {
            this.elements.headlightsStatus.textContent = headlightsOn ? 'ON' : 'OFF';
            this.elements.headlightsStatus.style.color = headlightsOn ? '#00ff00' : '#ff4444';
        }
    }
    
    /**
     * Show/hide headlights UI (for day/night mode)
     * @param {boolean} show - Whether to show the headlights UI
     */
    setHeadlightsUIVisibility(show) {
        if (this.elements.headlightsUI) {
            this.elements.headlightsUI.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Update delivery status display
     * @param {string} status - Status text to display
     * @param {string} color - Color for the status text
     */
    updateDeliveryStatus(status, color = '#64b5f6') {
        if (this.elements.deliveryStatus) {
            this.elements.deliveryStatus.textContent = status;
            this.elements.deliveryStatus.style.color = color;
        }
    }
    
    /**
     * Draw the minimap
     * @param {Object} carWrapper - Car wrapper object with position
     * @param {string} deliveryState - Current delivery state
     * @param {Object} pickupLocation - Pickup location {x, z}
     * @param {Object} deliveryLocation - Delivery location {x, z}
     */
    drawMinimap(carWrapper, deliveryState, pickupLocation, deliveryLocation) {
        if (!this.minimapRenderer || !this.minimapCamera || !carWrapper || !this.minimapOverlayCtx) return;
        
        // Position camera directly above the car
        const height = 80; // Height above the car
        this.minimapCamera.position.set(
            carWrapper.position.x,
            carWrapper.position.y + height,
            carWrapper.position.z
        );
        
        // Look straight down at the car
        this.minimapCamera.lookAt(carWrapper.position);
        
        // Render the scene from the top-down camera
        this.minimapRenderer.render(this.scene, this.minimapCamera);
        
        // Draw 2D overlay for off-screen indicators on the separate overlay canvas
        const ctx = this.minimapOverlayCtx;
        ctx.clearRect(0, 0, this.mapSize, this.mapSize); // Clear the overlay
        const center = this.mapSize / 2;
        const viewSize = 50; // Match the camera's view size
        const edgeMargin = 15; // Distance from edge to draw indicators
        
        // Helper function to draw edge indicator
        const drawEdgeIndicator = (worldX, worldZ, color, label) => {
            // Calculate relative position to car
            const relX = worldX - carWrapper.position.x;
            const relZ = worldZ - carWrapper.position.z;
            const distance = Math.sqrt(relX * relX + relZ * relZ);
            
            // Check if outside view
            if (Math.abs(relX) < viewSize * 0.8 && Math.abs(relZ) < viewSize * 0.8) {
                return; // It's visible, don't draw indicator
            }
            
            // Calculate angle to objective
            const angle = Math.atan2(relZ, relX);
            
            // Calculate where the indicator should be on the edge
            const maxDist = Math.max(Math.abs(relX), Math.abs(relZ));
            const scale = (center - edgeMargin) / (viewSize * 0.6);
            
            // Clamp to edge
            const clampFactor = Math.min(1, (viewSize * 0.8) / maxDist);
            const edgeX = center + relX * scale;
            const edgeY = center + relZ * scale;
            
            // Clamp to square bounds
            const clampedX = Math.max(edgeMargin, Math.min(this.mapSize - edgeMargin, edgeX));
            const clampedY = Math.max(edgeMargin, Math.min(this.mapSize - edgeMargin, edgeY));
            
            // Draw arrow pointing to objective
            ctx.save();
            ctx.translate(clampedX, clampedY);
            ctx.rotate(angle);
            
            // Draw arrow
            ctx.fillStyle = color;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-5, -6);
            ctx.lineTo(-5, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            ctx.restore();
            
            // Draw distance text
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            const distText = Math.floor(distance) + 'm';
            ctx.strokeText(distText, clampedX, clampedY - 12);
            ctx.fillText(distText, clampedX, clampedY - 12);
        };
        
        // Draw indicator for pickup zone (if not picked up yet)
        if (deliveryState === 'idle' || deliveryState === 'picking_up') {
            drawEdgeIndicator(pickupLocation.x, pickupLocation.z, '#00ff00', 'Pickup');
        }
        
        // Draw indicator for delivery zone (if has package)
        if (deliveryState === 'has_package') {
            drawEdgeIndicator(deliveryLocation.x, deliveryLocation.z, '#0088ff', 'Delivery');
        }
    }
    
    /**
     * Main update function - call this every frame
     * @param {number} deltaTime - Time since last frame (seconds)
     * @param {Object} gameState - Game state object with all necessary data
     */
    update(deltaTime, gameState) {
        // Update FPS
        this.updateFPS(deltaTime);
        
        // Update direction/speed display
        if (gameState.carDirection !== undefined && gameState.carWrapper && gameState.carBody) {
            this.updateDirectionDisplay(gameState.carDirection, gameState.carWrapper, gameState.carBody);
        }
        
        // Update boost display
        if (gameState.boostAmount !== undefined && gameState.maxBoost !== undefined) {
            this.updateBoostDisplay(gameState.boostAmount, gameState.maxBoost, gameState.isBoosting);
        }
        
        // Update camera mode display
        if (gameState.cameraAngle !== undefined) {
            this.updateCameraModeDisplay(
                gameState.cameraAngle,
                gameState.isUserControllingCamera,
                gameState.cameraResetInProgress
            );
        }
        
        // Draw minimap
        if (gameState.carWrapper && gameState.deliveryState && gameState.pickupLocation && gameState.deliveryLocation) {
            this.drawMinimap(
                gameState.carWrapper,
                gameState.deliveryState,
                gameState.pickupLocation,
                gameState.deliveryLocation
            );
        }
    }
    
    /**
     * Get current FPS
     * @returns {number} Current FPS
     */
    getFPS() {
        return this.fps;
    }
    
    /**
     * Cleanup UI system
     */
    cleanup() {
        // Dispose of minimap renderer
        if (this.minimapRenderer) {
            this.minimapRenderer.dispose();
            this.minimapRenderer = null;
        }
    }
}

