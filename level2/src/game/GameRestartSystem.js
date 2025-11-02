/**
 * ========================================
 * GAME RESTART SYSTEM
 * ========================================
 * 
 * Manages restarting Level 2:
 * - Resets car position and physics
 * - Resets delivery system state
 * - Resets camera position
 * - Resets boost and effects
 * - Clears completion UI
 * 
 * This module provides a comprehensive restart system for Level 2.
 * ========================================
 */

export class GameRestartSystem {
    constructor(scene, carWrapper, carBody, carPhysicsSystem, deliverySystem, cameraSystem, uiSystem, lightingSystem = null) {
        this.scene = scene;
        this.carWrapper = carWrapper;
        this.carBody = carBody;
        this.carPhysicsSystem = carPhysicsSystem;
        this.deliverySystem = deliverySystem;
        this.cameraSystem = cameraSystem;
        this.uiSystem = uiSystem;
        this.lightingSystem = lightingSystem;
        
        // Initial car position (stored when car is loaded)
        this.initialCarPosition = null;
        this.initialCarRotation = null;
    }
    
    /**
     * Store initial car position and rotation for restart
     * @param {THREE.Vector3} position - Initial car position
     * @param {THREE.Quaternion} rotation - Initial car rotation
     */
    setInitialCarState(position, rotation) {
        this.initialCarPosition = position ? position.clone() : null;
        this.initialCarRotation = rotation ? rotation.clone() : null;
        if (this.initialCarPosition) {
            console.log('📍 Stored initial car position:', this.initialCarPosition);
        }
    }
    
    /**
     * Update references to game systems (call when systems are reinitialized)
     */
    updateReferences(carWrapper, carBody, carPhysicsSystem, deliverySystem, cameraSystem, uiSystem, lightingSystem = null) {
        this.carWrapper = carWrapper;
        this.carBody = carBody;
        this.carPhysicsSystem = carPhysicsSystem;
        this.deliverySystem = deliverySystem;
        this.cameraSystem = cameraSystem;
        this.uiSystem = uiSystem;
        this.lightingSystem = lightingSystem;
    }
    
    /**
     * Restart Level 2 - Resets all game state to initial conditions
     * NOTE: This should be called deferred (via setTimeout) to avoid animation loop conflicts
     */
    restart() {
        console.log('🔄 Restarting Level 2...');
        
        // 0. Reset failure system if it exists
        if (window.failureSystem) {
            window.failureSystem.reset();
        }
        
        // 1. Close pause menu if open (but don't resume game loop yet)
        // Important: Do NOT call pauseMenu.resume() here as it would resume the game loop immediately
        // We'll resume the loop at the end after all reset operations are complete
        if (window.pauseMenu && window.pauseMenu.isPaused()) {
            // Only hide the pause menu, don't resume the loop yet
            const pauseMenu = document.getElementById('pause-menu');
            if (pauseMenu) {
                pauseMenu.classList.add('hidden');
            }
            // Update pause state but don't call resume() which would resume the loop
            window.pauseMenu.isGamePaused = false;
            window.pauseMenu.currentPausedLevel = null;
        }
        
        // 2. Reset car position and physics
        if (this.carBody && this.initialCarPosition && this.carWrapper) {
            // Reset physics body position and velocity
            this.carBody.position.set(
                this.initialCarPosition.x,
                this.initialCarPosition.y,
                this.initialCarPosition.z
            );
            this.carBody.velocity.set(0, 0, 0);
            this.carBody.angularVelocity.set(0, 0, 0);
            
            // Reset physics body rotation
            if (this.initialCarRotation) {
                this.carBody.quaternion.set(
                    this.initialCarRotation.x || 0,
                    this.initialCarRotation.y || 0,
                    this.initialCarRotation.z || 0,
                    this.initialCarRotation.w || 1
                );
            } else {
                this.carBody.quaternion.set(0, 0, 0, 1);
            }
            
            // Sync visual model with physics
            this.carWrapper.position.copy(this.initialCarPosition);
            if (this.initialCarRotation) {
                this.carWrapper.quaternion.copy(this.initialCarRotation);
            } else {
                this.carWrapper.quaternion.set(0, 0, 0, 1);
            }
            
            console.log('✅ Car reset to initial position:', this.initialCarPosition);
        }
        
        // 3. Reset car physics system state
        if (this.carPhysicsSystem) {
            this.carPhysicsSystem.carSpeed = 0;
            this.carPhysicsSystem.carDirection = 0;
            this.carPhysicsSystem.currentAcceleration = 0;
            this.carPhysicsSystem.isBoosting = false;
            this.carPhysicsSystem.boostAmount = this.carPhysicsSystem.maxBoost || 4.0;
            console.log('✅ Car physics state reset');
        }
        
        // 4. Reset delivery system
        if (this.deliverySystem) {
            // Reset game state to beginning
            this.deliverySystem.gameState = 'first_pickup';
            this.deliverySystem.deliveryState = 'idle';
            this.deliverySystem.pickupTimer = 0;
            this.deliverySystem.refuelTimer = 0;
            this.deliverySystem.gameStartTime = null;
            this.deliverySystem.gameEndTime = null;
            this.deliverySystem.completionTime = 0;
            this.deliverySystem.collisionCount = 0;
            this.deliverySystem.totalScore = 100;
            
            // Reset zones visibility
            if (this.deliverySystem.pickupZone1) {
                this.deliverySystem.pickupZone1.visible = true;
                if (this.deliverySystem.usingImportedZones) {
                    this.deliverySystem.updateZoneOpacity(this.deliverySystem.pickupZone1, 0.5);
                } else if (this.deliverySystem.pickupZone1.material) {
                    this.deliverySystem.pickupZone1.material.opacity = 0.5;
                }
            }
            if (this.deliverySystem.pickupZone2) {
                this.deliverySystem.pickupZone2.visible = false;
            }
            if (this.deliverySystem.deliveryZone1) {
                this.deliverySystem.deliveryZone1.visible = false;
                if (this.deliverySystem.usingImportedZones) {
                    this.deliverySystem.updateZoneColor(this.deliverySystem.deliveryZone1, 0x0088ff);
                } else if (this.deliverySystem.deliveryZone1.material) {
                    this.deliverySystem.deliveryZone1.material.color.setHex(0x0088ff);
                }
            }
            if (this.deliverySystem.deliveryZone2) {
                this.deliverySystem.deliveryZone2.visible = false;
            }
            
            this.deliverySystem.activePickupZone = this.deliverySystem.pickupZone1;
            this.deliverySystem.activeDeliveryZone = null;
            
            // Reset zone helper highlights (visual outlines)
            if (this.deliverySystem.pickupZone1Helper && this.deliverySystem.pickupZone1Helper.material) {
                this.deliverySystem.pickupZone1Helper.material.color.setHex(0x00ff00); // Green
                this.deliverySystem.pickupZone1Helper.material.opacity = 0.6;
                this.deliverySystem.pickupZone1Helper.visible = true;
            }
            if (this.deliverySystem.pickupZone2Helper && this.deliverySystem.pickupZone2Helper.material) {
                this.deliverySystem.pickupZone2Helper.material.color.setHex(0x00ff00); // Green
                this.deliverySystem.pickupZone2Helper.material.opacity = 0.6;
                this.deliverySystem.pickupZone2Helper.visible = false;
            }
            if (this.deliverySystem.deliveryZone1Helper && this.deliverySystem.deliveryZone1Helper.material) {
                this.deliverySystem.deliveryZone1Helper.material.color.setHex(0x0088ff); // Blue
                this.deliverySystem.deliveryZone1Helper.material.opacity = 0.6;
                this.deliverySystem.deliveryZone1Helper.visible = false;
            }
            if (this.deliverySystem.deliveryZone2Helper && this.deliverySystem.deliveryZone2Helper.material) {
                this.deliverySystem.deliveryZone2Helper.material.color.setHex(0x0088ff); // Blue
                this.deliverySystem.deliveryZone2Helper.material.opacity = 0.6;
                this.deliverySystem.deliveryZone2Helper.visible = false;
            }
            if (this.deliverySystem.gasStationHelper && this.deliverySystem.gasStationHelper.material) {
                this.deliverySystem.gasStationHelper.material.color.setHex(0xffaa00); // Orange
                this.deliverySystem.gasStationHelper.material.opacity = 0.6;
                this.deliverySystem.gasStationHelper.visible = false;
            }
            
            // Update UI
            if (this.uiSystem) {
                this.uiSystem.updateDeliveryStatus('Find Yellow Zone', '#64b5f6');
            }
            
            console.log('✅ Delivery system reset');
        }
        
        // 5. Reset lighting to day mode
        if (this.lightingSystem) {
            // If in night mode, toggle to day mode
            if (this.lightingSystem.isNightMode) {
                this.lightingSystem.isNightMode = false;
                // Apply day mode settings
                if (this.lightingSystem.mainDirectionalLight) {
                    this.lightingSystem.mainDirectionalLight.color.setHex(0xffffff);
                    this.lightingSystem.mainDirectionalLight.intensity = 0.8;
                    this.lightingSystem.mainDirectionalLight.castShadow = true;
                }
                if (this.lightingSystem.ambientLight) {
                    this.lightingSystem.ambientLight.intensity = 0.5;
                }
                
                // Hide headlights UI
                if (this.uiSystem) {
                    this.uiSystem.setHeadlightsUIVisibility(false);
                }
                
                // Turn off headlights if on
                if (this.lightingSystem.headlightsOn) {
                    this.lightingSystem.toggleHeadlights();
                }
                
                // Update sky colors to day
                if (this.lightingSystem.skyDome && this.lightingSystem.skyDome.material.uniforms) {
                    this.lightingSystem.skyDome.material.uniforms.topColor.value.setHex(0x0077ff);
                    this.lightingSystem.skyDome.material.uniforms.bottomColor.value.setHex(0xffffff);
                }
                
                // Update scene background and fog to day
                if (this.scene) {
                    this.scene.background.setHex(0x87CEEB);
                    if (this.scene.fog) {
                        this.scene.fog.color.setHex(0x87CEEB);
                        this.scene.fog.near = 50;
                        this.scene.fog.far = 300;
                    }
                }
                
                // Decrease gas station light intensity during day
                this.lightingSystem.updateGasStationLightIntensity(false);
                
                console.log('✅ Lighting reset to day mode');
            }
        }
        
        // 6. Reset camera to initial position
        if (this.cameraSystem && this.carWrapper) {
            // Reset camera state - camera will reset automatically in update loop
            if (this.cameraSystem.cameraResetTimer !== undefined) {
                this.cameraSystem.cameraResetTimer = 0;
            }
            if (this.cameraSystem.cameraResetInProgress !== undefined) {
                this.cameraSystem.cameraResetInProgress = false;
            }
            if (this.cameraSystem.isUserControllingCamera !== undefined) {
                this.cameraSystem.isUserControllingCamera = false;
            }
            // Reset camera angle to default (behind car view)
            if (this.cameraSystem.cameraAngle !== undefined) {
                this.cameraSystem.cameraAngle = 0;
            }
            console.log('✅ Camera reset state initialized');
        }
        
        // 6. Clear any completion popups
        const completionPopup = document.querySelector('.completion-popup');
        if (completionPopup) {
            completionPopup.remove();
        }
        
        // 7. Resume game loop ONLY if it was paused (deferred to avoid animation loop conflicts)
        // This prevents the FPS doubling issue when restarting during an animation frame
        // Important: Only resume if the loop is actually stopped, otherwise we'd create a duplicate loop
        if (window.resumeGameLoop && window.gameLoopActive === false) {
            setTimeout(() => {
                // Double-check the loop is still stopped before resuming
                if (window.gameLoopActive === false) {
                    window.resumeGameLoop();
                    console.log('✅ Game loop resumed after restart');
                } else {
                    console.log('⚠️ Game loop already active, skipping resume');
                }
            }, 0);
        } else if (window.gameLoopActive === true) {
            console.log('⚠️ Game loop already active - restart completed without resuming');
        }
        
        console.log('✅ Level 2 restarted successfully!');
    }
}

