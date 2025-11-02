// Warp Effect System - Handles warp animations when entering arcades
import * as THREE from 'three';

/**
 * WarpEffectSystem - Manages warp animation effects when player enters arcades
 */
export class WarpEffectSystem {
    constructor(scene, camera, playerSystem) {
        this.scene = scene;
        this.camera = camera;
        this.playerSystem = playerSystem;
        
        // Warp state
        this.isWarping = false;
        this.scaleDuration = 6.0; // 6 seconds for scale animation
        this.rotationDuration = 3.0; // 3 seconds for rotation animation
        this.totalAnimationDuration = 9.0; // Total 9 seconds (separate from music)
        this.onWarpComplete = null;
        
        // Original player state (to restore if needed)
        this.originalPlayerScale = new THREE.Vector3(1, 1, 1);
        this.originalPlayerRotation = new THREE.Euler(0, 0, 0);
        this.originalPlayerPosition = new THREE.Vector3();
        
        // Original camera state
        this.originalCameraPosition = new THREE.Vector3();
        this.originalCameraTarget = new THREE.Vector3();
        
        // Warp sound reference
        this.warpSoundAudio = null;
        this.warpSoundTimeCheck = null;
        
        // Visual effect elements
        this.warpOverlay = null;
        this.sparkleContainer = null;
        this.rendererCanvas = null;
        this.animationFrame = null;
    }
    
    /**
     * Initializes the warp effect system
     */
    init() {
        console.log('✅ WarpEffectSystem initialized');
        
        // Find renderer canvas for effects
        const canvas = document.querySelector('canvas');
        if (canvas) {
            this.rendererCanvas = canvas;
        }
    }
    
    /**
     * Creates visual warp overlay effects on screen
     * Try different effect styles by changing the effectType parameter
     */
    createWarpVisualEffect(effectType = 'sparkly') {
        // Remove existing overlay if any
        this.removeWarpVisualEffect();
        
        // Create overlay container
        this.warpOverlay = document.createElement('div');
        this.warpOverlay.id = 'warp-visual-effect';
        this.warpOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10000;
            mix-blend-mode: screen;
        `;
        
        // Create sparkle container
        this.sparkleContainer = document.createElement('div');
        this.sparkleContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        `;
        
        // Apply different effect styles
        switch(effectType) {
            case 'sparkly':
            default:
                this.createSparklyEffect();
                break;
            case 'warpy':
                this.createWarpyEffect();
                break;
            case 'dizzy':
                this.createDizzyEffect();
                break;
            case 'combined':
                this.createCombinedEffect();
                break;
        }
        
        this.warpOverlay.appendChild(this.sparkleContainer);
        document.body.appendChild(this.warpOverlay);
        
        // Apply canvas effects if renderer canvas found
        if (this.rendererCanvas) {
            this.applyCanvasEffects(effectType);
        }
    }
    
    /**
     * Creates sparkly/sparkle effect
     */
    createSparklyEffect() {
        // Create animated gradient background
        const gradientBg = document.createElement('div');
        gradientBg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at 50% 50%, 
                rgba(138, 43, 226, 0.3) 0%, 
                rgba(75, 0, 130, 0.2) 30%,
                rgba(0, 0, 0, 0.5) 70%);
            animation: warpPulse 2s ease-in-out infinite;
            mix-blend-mode: screen;
        `;
        
        // Add CSS animation
        if (!document.getElementById('warp-style-inject')) {
            const style = document.createElement('style');
            style.id = 'warp-style-inject';
            style.textContent = `
                @keyframes warpPulse {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                }
                @keyframes sparkle {
                    0% { opacity: 0; transform: translateY(0) scale(0); }
                    50% { opacity: 1; transform: translateY(-50px) scale(1); }
                    100% { opacity: 0; transform: translateY(-100px) scale(0); }
                }
                @keyframes warpDistort {
                    0%, 100% { filter: blur(0px) hue-rotate(0deg); }
                    50% { filter: blur(3px) hue-rotate(180deg); }
                }
                @keyframes dizzySpin {
                    0% { transform: rotate(0deg) scale(1); }
                    25% { transform: rotate(90deg) scale(1.05); }
                    50% { transform: rotate(180deg) scale(1.1); }
                    75% { transform: rotate(270deg) scale(1.05); }
                    100% { transform: rotate(360deg) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        this.sparkleContainer.appendChild(gradientBg);
        
        // Create sparkle particles
        this.createSparkleParticles();
    }
    
    /**
     * Creates sparkle particles
     */
    createSparkleParticles() {
        const particleCount = 50;
        for (let i = 0; i < particleCount; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: white;
                border-radius: 50%;
                box-shadow: 0 0 6px rgba(255, 255, 255, 0.8),
                           0 0 12px rgba(138, 43, 226, 0.6),
                           0 0 18px rgba(255, 20, 147, 0.4);
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation: sparkle ${2 + Math.random() * 3}s ease-in-out infinite;
                animation-delay: ${Math.random() * 2}s;
            `;
            this.sparkleContainer.appendChild(sparkle);
        }
    }
    
    /**
     * Creates warpy/distortion effect
     */
    createWarpyEffect() {
        const warpBg = document.createElement('div');
        warpBg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                45deg,
                rgba(138, 43, 226, 0.1) 0px,
                rgba(75, 0, 130, 0.1) 10px,
                rgba(138, 43, 226, 0.1) 20px
            );
            animation: warpDistort 1s ease-in-out infinite;
            mix-blend-mode: overlay;
        `;
        this.sparkleContainer.appendChild(warpBg);
        
        // Add radial warp lines
        for (let i = 0; i < 12; i++) {
            const line = document.createElement('div');
            const angle = (i * 30);
            line.style.cssText = `
                position: absolute;
                left: 50%;
                top: 50%;
                width: 2px;
                height: 100vh;
                background: linear-gradient(to bottom,
                    rgba(138, 43, 226, 0.6),
                    rgba(138, 43, 226, 0));
                transform: translate(-50%, -50%) rotate(${angle}deg);
                transform-origin: center top;
                animation: warpPulse 1.5s ease-in-out infinite;
                animation-delay: ${i * 0.1}s;
            `;
            this.sparkleContainer.appendChild(line);
        }
        
        this.createSparkleParticles();
    }
    
    /**
     * Creates dizzy/spinning effect
     */
    createDizzyEffect() {
        const dizzyBg = document.createElement('div');
        dizzyBg.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(
                from 0deg,
                rgba(138, 43, 226, 0.3),
                rgba(255, 20, 147, 0.3),
                rgba(138, 43, 226, 0.3)
            );
            transform: translate(-50%, -50%);
            animation: dizzySpin 3s linear infinite;
            mix-blend-mode: screen;
        `;
        this.sparkleContainer.appendChild(dizzyBg);
        
        // Add blur overlay
        const blurOverlay = document.createElement('div');
        blurOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backdrop-filter: blur(2px);
            animation: warpPulse 1s ease-in-out infinite;
        `;
        this.sparkleContainer.appendChild(blurOverlay);
        
        this.createSparkleParticles();
    }
    
    /**
     * Creates combined effect (sparkly + warpy + dizzy)
     */
    createCombinedEffect() {
        // Add warpy gradient
        const warpBg = document.createElement('div');
        warpBg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(ellipse at center,
                rgba(138, 43, 226, 0.4) 0%,
                rgba(75, 0, 130, 0.3) 40%,
                transparent 70%);
            animation: warpPulse 1.5s ease-in-out infinite;
            mix-blend-mode: screen;
        `;
        this.sparkleContainer.appendChild(warpBg);
        
        // Add spinning overlay
        const spinOverlay = document.createElement('div');
        spinOverlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 150%;
            height: 150%;
            background: conic-gradient(
                from 0deg,
                transparent,
                rgba(255, 20, 147, 0.2),
                transparent,
                rgba(138, 43, 226, 0.2),
                transparent
            );
            transform: translate(-50%, -50%);
            animation: dizzySpin 4s linear infinite;
            mix-blend-mode: overlay;
        `;
        this.sparkleContainer.appendChild(spinOverlay);
        
        // Add blur
        const blurOverlay = document.createElement('div');
        blurOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backdrop-filter: blur(1px);
        `;
        this.sparkleContainer.appendChild(blurOverlay);
        
        this.createSparkleParticles();
    }
    
    /**
     * Applies effects to the canvas element
     */
    applyCanvasEffects(effectType) {
        if (!this.rendererCanvas) return;
        
        // Store original filter
        this.originalCanvasFilter = this.rendererCanvas.style.filter || '';
        
        // Apply canvas distortion based on effect type
        const filterEffects = {
            'sparkly': 'blur(1px) brightness(1.1) contrast(1.1)',
            'warpy': 'blur(2px) hue-rotate(180deg) saturate(1.2)',
            'dizzy': 'blur(3px) brightness(1.2)',
            'combined': 'blur(2px) brightness(1.15) contrast(1.15) saturate(1.1)'
        };
        
        const filter = filterEffects[effectType] || filterEffects['sparkly'];
        this.rendererCanvas.style.filter = filter;
        this.rendererCanvas.style.transition = 'filter 0.3s ease';
    }
    
    /**
     * Removes visual warp effects
     */
    removeWarpVisualEffect() {
        if (this.warpOverlay && this.warpOverlay.parentNode) {
            this.warpOverlay.parentNode.removeChild(this.warpOverlay);
            this.warpOverlay = null;
            this.sparkleContainer = null;
        }
        
        // Restore original canvas filter
        if (this.rendererCanvas && this.originalCanvasFilter !== undefined) {
            this.rendererCanvas.style.filter = this.originalCanvasFilter;
            this.originalCanvasFilter = undefined;
        }
        
        // Cancel animation frame if running
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    /**
     * Starts the warp animation
     * @param {Function} onComplete - Callback when warp animation completes
     * @param {THREE.Object3D} arcadeObject - Optional: arcade object to warp towards
     */
    startWarp(onComplete, arcadeObject = null) {
        if (this.isWarping) {
            console.warn('Warp already in progress');
            return;
        }
        
        const player = this.scene.getObjectByName('player');
        if (!player) {
            console.error('Player not found - cannot start warp');
            if (onComplete) onComplete();
            return;
        }
        
        this.isWarping = true;
        this.onWarpComplete = onComplete;
        
        // Store original player state
        this.originalPlayerScale.copy(player.scale);
        this.originalPlayerRotation.copy(player.rotation);
        this.originalPlayerPosition = player.position.clone();
        
        // Store original camera state
        this.originalCameraPosition.copy(this.camera.position);
        
        // Calculate arcade world position (target for player movement)
        let arcadeWorldPos = new THREE.Vector3();
        if (arcadeObject) {
            arcadeObject.getWorldPosition(arcadeWorldPos);
        } else {
            // Default: use player position + forward direction
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            arcadeWorldPos.copy(player.position).add(forward.multiplyScalar(2.0));
        }
        
        // Player will move to the arcade center over the full animation
        const targetPlayerPosition = arcadeWorldPos.clone();
        
        // Lock player movement during warp
        this.scene.userData.playerLocked = true;
        if (player.position) {
            this.scene.userData.lockedPlayerPosition = player.position.clone();
        }
        
        // Animate camera to center on arcade (over the full 9 seconds)
        if (typeof gsap !== 'undefined') {
            // Calculate camera position to look at arcade
            // Position camera at an angle that shows both player and arcade
            const cameraDistance = 4;
            const cameraHeight = 4;
            
            // Calculate direction from arcade to player for camera positioning
            const directionToPlayer = new THREE.Vector3()
                .subVectors(player.position, arcadeWorldPos)
                .normalize();
            
            // Position camera between player and arcade, offset to the side for better view
            // Use a perpendicular vector to position camera at an angle
            const sideOffset = new THREE.Vector3(-directionToPlayer.z, 0, 0).normalize();
            const targetCameraPos = new THREE.Vector3()
                .copy(arcadeWorldPos)
                .add(directionToPlayer.multiplyScalar(cameraDistance * 0.6))
                .add(sideOffset.multiplyScalar(cameraDistance * 0.5))
                .add(new THREE.Vector3(0, cameraHeight, 0));
            
            // Animate camera to look at arcade over the full animation duration
            gsap.to(this.camera.position, {
                x: targetCameraPos.x,
                y: targetCameraPos.y,
                z: targetCameraPos.z,
                duration: this.totalAnimationDuration,
                ease: "power2.out", // Fast start, slow end
                onUpdate: () => {
                    // Continuously look at arcade during animation
                    this.camera.lookAt(arcadeWorldPos);
                }
            });
        }
        
        // Play warp sound from 8s to 17s (9 seconds)
        if (window.audioManager) {
            const warpSound = window.audioManager.soundEffects['warp'];
            if (warpSound && warpSound.audio) {
                // Store reference for cleanup
                this.warpSoundAudio = warpSound.audio;
                
                // Set start time to 8 seconds
                warpSound.audio.currentTime = 8.0;
                
                // Set up listener to stop at 17 seconds
                const stopAtTime = 17.0;
                this.warpSoundTimeCheck = () => {
                    if (warpSound.audio && warpSound.audio.currentTime >= stopAtTime) {
                        warpSound.audio.pause();
                        warpSound.audio.removeEventListener('timeupdate', this.warpSoundTimeCheck);
                        this.warpSoundTimeCheck = null;
                    }
                };
                warpSound.audio.addEventListener('timeupdate', this.warpSoundTimeCheck);
                
                warpSound.audio.play().catch(err => {
                    console.warn('Could not play warp sound:', err);
                });
            }
        }
        
        // Animate scale down and rotation
        // Use GSAP (already loaded globally via script tag)
        if (typeof gsap !== 'undefined') {
            // Phase 1: Scale animation - 6 seconds
            // Player starts at 1.5, so we scale from 1.5 to 0.1
            const startScale = this.originalPlayerScale.x; // Should be 1.5
            const endScale = 0.1;
            
        console.log(`🌀 Starting warp animation: ${this.totalAnimationDuration}s total (scale and rotation simultaneous)`);
        
        // Create visual warp effects on screen
        // Try different effects: 'sparkly', 'warpy', 'dizzy', 'combined'
        this.createWarpVisualEffect('combined'); // Start with combined - you can change this!
        
        // Animate player position to arcade center over the full animation duration
            gsap.to(player.position, {
                x: targetPlayerPosition.x,
                y: targetPlayerPosition.y + 2,
                z: targetPlayerPosition.z,
                duration: this.totalAnimationDuration, // 9 seconds total
                ease: "power2.out", // Fast start, slow end
                onUpdate: () => {
                    // Position animation continues throughout animation
                }
            });
            
            // Scale down animation - runs for full 9 seconds
            gsap.to(player.scale, {
                x: endScale,
                y: endScale,
                z: endScale,
                duration: this.totalAnimationDuration, // 9 seconds
                ease: "power2.out" // Fast start, slow end
            });
            
            // Rotation animation - runs simultaneously for full 9 seconds
            const finalRotation = this.originalPlayerRotation.clone();
            finalRotation.x += Math.PI * 2; // Full rotation (360 degrees)
            
            gsap.to(player.rotation, {
                x: finalRotation.x,
                duration: this.totalAnimationDuration, // 9 seconds
                ease: "power2.out", // Fast start, slow end
                onComplete: () => {
                    // Animation complete - trigger callback
                    this.completeWarp();
                }
            });
        } else {
            console.error('GSAP not available - warp animation cannot play');
            // Fallback: just complete after total duration
            setTimeout(() => {
                this.completeWarp();
            }, this.totalAnimationDuration * 1000);
        }
        
        console.log('🌀 Warp animation started');
    }
    
    /**
     * Completes the warp animation
     */
    completeWarp() {
        const player = this.scene.getObjectByName('player');
        
        // Stop warp sound and remove listener
        if (this.warpSoundAudio) {
            if (this.warpSoundTimeCheck) {
                this.warpSoundAudio.removeEventListener('timeupdate', this.warpSoundTimeCheck);
                this.warpSoundTimeCheck = null;
            }
            this.warpSoundAudio.pause();
            this.warpSoundAudio.currentTime = 0;
            this.warpSoundAudio = null;
        }
        
        // Also stop via audio manager
        if (window.audioManager) {
            window.audioManager.stopSoundEffect('warp');
        }
        
        // Remove visual warp effects
        this.removeWarpVisualEffect();
        
        // Reset player state (will be hidden by level load anyway, but good practice)
        if (player) {
            player.scale.copy(this.originalPlayerScale);
            player.rotation.copy(this.originalPlayerRotation);
        }
        
        this.isWarping = false;
        
        // Call completion callback
        if (this.onWarpComplete) {
            const callback = this.onWarpComplete;
            this.onWarpComplete = null;
            callback();
        }
        
        console.log('✅ Warp animation completed');
    }
    
    /**
     * Cancels the warp animation (if needed)
     */
    cancelWarp() {
        if (!this.isWarping) return;
        
        const player = this.scene.getObjectByName('player');
        
        // Kill GSAP animations
        if (typeof gsap !== 'undefined') {
            if (player) {
                gsap.killTweensOf(player.scale);
                gsap.killTweensOf(player.rotation);
                gsap.killTweensOf(player.position);
            }
            // Kill camera animations
            gsap.killTweensOf(this.camera.position);
        }
        
        // Stop warp sound and remove listener
        if (this.warpSoundAudio) {
            if (this.warpSoundTimeCheck) {
                this.warpSoundAudio.removeEventListener('timeupdate', this.warpSoundTimeCheck);
                this.warpSoundTimeCheck = null;
            }
            this.warpSoundAudio.pause();
            this.warpSoundAudio.currentTime = 0;
            this.warpSoundAudio = null;
        }
        
        // Also stop via audio manager
        if (window.audioManager) {
            window.audioManager.stopSoundEffect('warp');
        }
        
        // Remove visual warp effects
        this.removeWarpVisualEffect();
        
        // Reset player state
        if (player) {
            player.scale.copy(this.originalPlayerScale);
            player.rotation.copy(this.originalPlayerRotation);
        }
        
        this.scene.userData.playerLocked = false;
        this.isWarping = false;
        this.onWarpComplete = null;
        
        console.log('⚠️ Warp animation cancelled');
    }
    
    /**
     * Checks if warp is currently in progress
     * @returns {boolean} True if warping
     */
    isWarpActive() {
        return this.isWarping;
    }
    
    /**
     * Cleans up the warp effect system
     */
    cleanup() {
        this.cancelWarp();
    }
}

