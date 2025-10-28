/**
 * ========================================
 * LIGHTING SYSTEM
 * ========================================
 * 
 * Manages all lighting in the game:
 * - Day/night cycle
 * - Directional and ambient lighting
 * - Sky dome with shader gradients
 * - Car headlights and backlights
 * - Scene background and fog
 * 
 * This module handles all visual lighting effects.
 * ========================================
 */

export class LightingSystem {
    constructor(scene, uiSystem) {
        this.scene = scene;
        this.uiSystem = uiSystem;
        
        // Lights
        this.mainDirectionalLight = null;
        this.ambientLight = null;
        this.directionalLight2 = null;
        this.pointLight = null;
        
        // Sky
        this.skyDome = null;
        
        // Car headlights
        this.leftHeadlight = null;
        this.rightHeadlight = null;
        this.leftBacklight = null;
        this.rightBacklight = null;
        this.headlightsOn = false;
        this.headlightMesh = null;
        this.backlightMesh = null;
        
        // State
        this.isNightMode = false;
    }
    
    /**
     * Initialize scene lighting
     */
    init() {
        this.setupLighting();
        this.setupSky();
    }
    
    /**
     * Setup main scene lighting
     */
    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);
        
        this.mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.mainDirectionalLight.position.set(20, 30, 20);
        this.mainDirectionalLight.castShadow = true;
        // Shadow camera bounds - balance between range and quality
        this.mainDirectionalLight.shadow.camera.left = -40;
        this.mainDirectionalLight.shadow.camera.right = 40;
        this.mainDirectionalLight.shadow.camera.top = 40;
        this.mainDirectionalLight.shadow.camera.bottom = -40;
        this.mainDirectionalLight.shadow.camera.near = 1;
        this.mainDirectionalLight.shadow.camera.far = 80;
        this.mainDirectionalLight.shadow.mapSize.width = 2048;
        this.mainDirectionalLight.shadow.mapSize.height = 2048;
        this.mainDirectionalLight.shadow.radius = 1;
        this.mainDirectionalLight.shadow.bias = 0.0001;
        this.mainDirectionalLight.shadow.normalBias = 0.02;
        this.scene.add(this.mainDirectionalLight);
        this.scene.add(this.mainDirectionalLight.target);
        
        this.directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        this.directionalLight2.position.set(-20, 20, -20);
        this.scene.add(this.directionalLight2);
        
        this.pointLight = new THREE.PointLight(0x64b5f6, 1.5, 100);
        this.pointLight.position.set(0, 15, 0);
        this.scene.add(this.pointLight);
    }
    
    /**
     * Setup sky dome with gradient shader
     */
    setupSky() {
        const skyGeometry = new THREE.SphereGeometry(500, 32, 15);
        
        const skyMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vWorldPosition;
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            side: THREE.BackSide
        });
        
        this.skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.skyDome);
    }
    
    /**
     * Create car headlights and backlights
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     */
    createHeadlights(carWrapper) {
        if (!carWrapper) {
            console.error('Car wrapper not loaded yet!');
            return;
        }
        
        // Search for headlight and backlight objects in the model
        carWrapper.traverse((node) => {
            if (node.name === 'Headlight') {
                this.headlightMesh = node;
            }
            if (node.name === 'Backlight') {
                this.backlightMesh = node;
            }
        });
        
        if (!this.headlightMesh) {
            console.warn('Headlight mesh not found in model!');
        }
        if (!this.backlightMesh) {
            console.warn('Backlight mesh not found in model!');
        }
        
        // Get headlight world position from mesh
        let headlightPos = new THREE.Vector3();
        let backlightPos = new THREE.Vector3();
        
        if (this.headlightMesh) {
            this.headlightMesh.getWorldPosition(headlightPos);
            carWrapper.worldToLocal(headlightPos);
        } else {
            headlightPos.set(0, 0.5, -2);
        }
        
        if (this.backlightMesh) {
            this.backlightMesh.getWorldPosition(backlightPos);
            carWrapper.worldToLocal(backlightPos);
        } else {
            backlightPos.set(0, 0.5, 2);
        }

        
        // Create left headlight (white/warm)
        this.leftHeadlight = new THREE.SpotLight(0xffffee, 5, 100, Math.PI / 6, 0.5, 1.5);
        this.leftHeadlight.castShadow = false;
        const leftHeadSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffee })
        );
        this.leftHeadlight.add(leftHeadSphere);
        
        // Create right headlight (white/warm)
        this.rightHeadlight = new THREE.SpotLight(0xffffee, 5, 100, Math.PI / 6, 0.5, 1.5);
        this.rightHeadlight.castShadow = false;
        const rightHeadSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffee })
        );
        this.rightHeadlight.add(rightHeadSphere);
        
        // Create left backlight (red, dim)
        this.leftBacklight = new THREE.SpotLight(0xff0000, 0.5, 15, Math.PI / 4, 0.8, 2);
        const leftBackSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        this.leftBacklight.add(leftBackSphere);
        
        // Create right backlight (red, dim)
        this.rightBacklight = new THREE.SpotLight(0xff0000, 0.5, 15, Math.PI / 4, 0.8, 2);
        const rightBackSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        this.rightBacklight.add(rightBackSphere);
        
        // Add lights to the car wrapper
        carWrapper.add(this.leftHeadlight);
        carWrapper.add(this.rightHeadlight);
        carWrapper.add(this.leftBacklight);
        carWrapper.add(this.rightBacklight);
        
        // Start with lights off (day mode)
        this.leftHeadlight.visible = false;
        this.rightHeadlight.visible = false;
        this.leftBacklight.visible = false;
        this.rightBacklight.visible = false;
        
        // Add targets for the spotlights
        this.leftHeadlight.target = new THREE.Object3D();
        this.rightHeadlight.target = new THREE.Object3D();
        this.leftBacklight.target = new THREE.Object3D();
        this.rightBacklight.target = new THREE.Object3D();
        carWrapper.add(this.leftHeadlight.target);
        carWrapper.add(this.rightHeadlight.target);
        carWrapper.add(this.leftBacklight.target);
        carWrapper.add(this.rightBacklight.target);
        
        // Position lights based on mesh positions
        const sideOffset = 0.8;
        
        // Front headlights - point forward, parallel beams
        this.leftHeadlight.position.set(headlightPos.x, headlightPos.y, headlightPos.z - sideOffset);
        this.rightHeadlight.position.set(headlightPos.x, headlightPos.y, headlightPos.z + sideOffset);
        this.leftHeadlight.target.position.set(headlightPos.x + 10, headlightPos.y - 0.3, headlightPos.z - sideOffset);
        this.rightHeadlight.target.position.set(headlightPos.x + 10, headlightPos.y - 0.3, headlightPos.z + sideOffset);
        
        // Back lights - point backward, parallel beams
        this.leftBacklight.position.set(backlightPos.x, backlightPos.y, backlightPos.z - sideOffset);
        this.rightBacklight.position.set(backlightPos.x, backlightPos.y, backlightPos.z + sideOffset);
        this.leftBacklight.target.position.set(backlightPos.x - 5, backlightPos.y - 0.2, backlightPos.z - sideOffset);
        this.rightBacklight.target.position.set(backlightPos.x - 5, backlightPos.y - 0.2, backlightPos.z + sideOffset);

    }
    
    /**
     * Toggle headlights on/off
     */
    toggleHeadlights() {
        this.headlightsOn = !this.headlightsOn;
        
        // Toggle headlights
        if (this.leftHeadlight) {
            this.leftHeadlight.visible = this.headlightsOn;
            if (this.headlightsOn) {
                this.leftHeadlight.intensity = this.isNightMode ? 5 : 3;
            }
        }
        if (this.rightHeadlight) {
            this.rightHeadlight.visible = this.headlightsOn;
            if (this.headlightsOn) {
                this.rightHeadlight.intensity = this.isNightMode ? 5 : 3;
            }
        }
        
        // Toggle backlights
        if (this.leftBacklight) {
            this.leftBacklight.visible = this.headlightsOn;
        }
        if (this.rightBacklight) {
            this.rightBacklight.visible = this.headlightsOn;
        }
        
        // Update UI
        if (this.uiSystem) {
            this.uiSystem.updateHeadlightsDisplay(this.headlightsOn);
        }

    }
    
    /**
     * Toggle between day and night mode
     */
    toggleDayNight() {
        this.isNightMode = !this.isNightMode;
        
        if (this.isNightMode) {
            // Night mode: PITCH BLACK
            this.mainDirectionalLight.intensity = 0;
            this.mainDirectionalLight.castShadow = false;
            this.ambientLight.intensity = 0.15;
            
            // Show headlights UI
            if (this.uiSystem) {
                this.uiSystem.setHeadlightsUIVisibility(true);
            }
            
            // Adjust headlight intensity
            if (this.headlightsOn && this.leftHeadlight && this.rightHeadlight) {
                this.leftHeadlight.intensity = 5;
                this.rightHeadlight.intensity = 5;
            }
            
            // Turn on headlights automatically
            if (!this.headlightsOn) {
                this.toggleHeadlights();
            }
            
            // Update sky colors - very dark
            if (this.skyDome && this.skyDome.material.uniforms) {
                this.skyDome.material.uniforms.topColor.value.setHex(0x000000);
                this.skyDome.material.uniforms.bottomColor.value.setHex(0x000005);
            }
            
            // Update scene background and fog
            this.scene.background.setHex(0x000000);
            this.scene.fog.color.setHex(0x000000);
            this.scene.fog.near = 10;
            this.scene.fog.far = 50;
            
        } else {
            // Day mode: bright, warm colors
            this.mainDirectionalLight.color.setHex(0xffffff);
            this.mainDirectionalLight.intensity = 0.8;
            this.mainDirectionalLight.castShadow = true;
            this.ambientLight.intensity = 0.5;
            
            // Hide headlights UI
            if (this.uiSystem) {
                this.uiSystem.setHeadlightsUIVisibility(false);
            }
            
            // Turn off headlights
            if (this.headlightsOn) {
                this.toggleHeadlights();
            }
            
            // Update sky colors
            if (this.skyDome && this.skyDome.material.uniforms) {
                this.skyDome.material.uniforms.topColor.value.setHex(0x0077ff);
                this.skyDome.material.uniforms.bottomColor.value.setHex(0xffffff);
            }
            
            // Update scene background and fog
            this.scene.background.setHex(0x87CEEB);
            this.scene.fog.color.setHex(0x87CEEB);
            this.scene.fog.near = 50;
            this.scene.fog.far = 300;
        }
        
        const btn = document.getElementById('toggle-daynight');
        if (btn) {
            btn.textContent = this.isNightMode ? 'Day Mode' : 'Night Mode';
        }
    }
    
    /**
     * Update shadow camera to follow car
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     */
    updateShadowCamera(carWrapper) {
        if (this.mainDirectionalLight && carWrapper) {
            this.mainDirectionalLight.position.set(
                carWrapper.position.x + 20,
                30,
                carWrapper.position.z + 20
            );
            this.mainDirectionalLight.target.position.copy(carWrapper.position);
            this.mainDirectionalLight.target.updateMatrixWorld();
        }
    }
    
    /**
     * Get current night mode state
     * @returns {boolean} True if night mode
     */
    isNight() {
        return this.isNightMode;
    }
    
    /**
     * Get headlights on state
     * @returns {boolean} True if headlights are on
     */
    areHeadlightsOn() {
        return this.headlightsOn;
    }
    
    /**
     * Cleanup lighting system
     */
    cleanup() {
        if (this.mainDirectionalLight) {
            this.scene.remove(this.mainDirectionalLight);
        }
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
        }
        if (this.directionalLight2) {
            this.scene.remove(this.directionalLight2);
        }
        if (this.pointLight) {
            this.scene.remove(this.pointLight);
        }
        if (this.skyDome) {
            this.scene.remove(this.skyDome);
            this.skyDome.geometry.dispose();
            this.skyDome.material.dispose();
        }
    }
}

