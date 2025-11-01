// Mirror System - Implements real-time mirror using Three.js Reflector
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/**
 * MirrorSystem - Creates a real-time mirror effect using render-to-texture
 */
export class MirrorSystem {
    constructor(scene, mainCamera, renderer) {
        this.scene = scene;
        this.mainCamera = mainCamera;
        this.renderer = renderer;
        
        this.mirrorObject = null;
        this.mirrorCamera = null;
        this.renderTarget = null;
        this.mirrorMaterial = null;
        
        // Mirror properties
        this.resolution = 512; // Resolution of the mirror texture (can be adjusted for performance)
        this.clipDistance = 100; // How far the mirror camera can see
    }
    
    /**
     * Initializes the mirror system
     */
    init() {
        // Find the Mirror_Face object in the scene
        this.findMirror();
        
        if (!this.mirrorObject) {
            console.warn('⚠️ Mirror_Face object not found - mirror system disabled');
            console.warn('   Try calling init() again after the basement model has loaded');
            return;
        }
        
        // Setup reflector on the mirror object
        this.setupReflector();
        
        console.log('✅ Mirror system initialized');
    }
    
    /**
     * Finds the Mirror_Face object in the scene
     */
    findMirror() {
        this.scene.traverse((child) => {
            if (!child.name) return;
            
            const name = child.name.toLowerCase();
            const normalizedName = name.replace(/[_\s]/g, ''); // Remove underscores and spaces for comparison
            
            // Check for various name formats: "Mirror Face", "Mirror_Face", "mirrorface", etc.
            if (name === 'mirror_face' || 
                name === 'mirror face' ||
                name === 'mirrorface' ||
                name.includes('mirror_face') ||
                name.includes('mirror face') ||
                name.includes('mirrorface') ||
                normalizedName === 'mirrorface') {
                this.mirrorObject = child;
                console.log(`✅ Found mirror object: ${child.name}`);
                
                // Store original material if needed
                if (child.material) {
                    child.userData.originalMaterial = child.material;
                }
                
                // Also store original material for any child meshes
                child.traverse((mesh) => {
                    if (mesh.isMesh && mesh.material) {
                        mesh.userData.originalMaterial = mesh.material;
                    }
                });
                
                return; // Found it, stop searching
            }
        });
        
        if (!this.mirrorObject) {
            // Log all object names for debugging
            console.log('🔍 Searching for mirror object. Available objects:');
            this.scene.traverse((child) => {
                if (child.name && child.name.toLowerCase().includes('mirror')) {
                    console.log(`   - ${child.name}`);
                }
            });
        }
    }
    
    /**
     * Sets up the reflector on the mirror object
     * Only changes the visual material - doesn't affect physics, collision, or gameplay
     */
    setupReflector() {
        if (!this.mirrorObject) return;
        
        // Apply reflector to the mirror object
        if (this.mirrorObject.isMesh) {
            // Get geometry from the mirror object
            const geometry = this.mirrorObject.geometry;
            
            if (!geometry) {
                console.error('⚠️ Mirror object has no geometry!');
                return;
            }
            
            console.log(`📊 Mirror geometry type: ${geometry.type}, vertices: ${geometry.attributes?.position?.count || 'unknown'}`);
            
            // Update world matrix to get correct position/rotation
            this.mirrorObject.updateMatrixWorld();
            
            // Create reflector with the same geometry
            // Note: Reflector automatically handles reflection rendering via onBeforeRender
            this.reflector = new Reflector(geometry, {
                textureWidth: this.resolution,
                textureHeight: this.resolution,
                color: 0x889999,
                clipBias: 0.0039
            });
            
            // Ensure reflector can receive shadows (may help with visibility)
            this.reflector.receiveShadow = true;
            
            // Ensure the reflector material is properly set up
            if (this.reflector.material) {
                // Make sure material is visible
                this.reflector.material.visible = true;
                // Ensure it renders properly
                this.reflector.material.needsUpdate = true;
            }
            
            // Copy transform from original object (use world matrix for accurate positioning)
            const worldMatrix = new THREE.Matrix4();
            worldMatrix.copy(this.mirrorObject.matrixWorld);
            this.reflector.matrix.copy(worldMatrix);
            this.reflector.matrix.decompose(
                this.reflector.position,
                this.reflector.quaternion,
                this.reflector.scale
            );
            
            // Replace the original object with reflector in the scene
            const originalParent = this.mirrorObject.parent;
            const originalVisible = this.mirrorObject.visible;
            
            if (originalParent) {
                originalParent.remove(this.mirrorObject);
                originalParent.add(this.reflector);
            } else {
                this.scene.remove(this.mirrorObject);
                this.scene.add(this.reflector);
            }
            
            // Update reflector world matrix
            this.reflector.updateMatrixWorld();
            
            // Ensure reflector is visible
            this.reflector.visible = originalVisible !== false;
            
            // Store reference to reflector
            const oldMirrorObject = this.mirrorObject;
            this.mirrorObject = this.reflector;
            
            console.log('✅ Reflector replaced mirror object in scene');
            console.log(`   Old object visible: ${oldMirrorObject.visible}`);
            console.log(`   Reflector visible: ${this.reflector.visible}`);
            console.log(`   Position: ${this.reflector.position.x.toFixed(2)}, ${this.reflector.position.y.toFixed(2)}, ${this.reflector.position.z.toFixed(2)}`);
            console.log(`   In scene: ${this.scene.children.includes(this.reflector)}`);
            console.log(`   Has material: ${!!this.reflector.material}`);
            console.log(`   Material type: ${this.reflector.material?.type || 'none'}`);
        } else {
            // If it's a group, try to apply reflector to child meshes
            this.mirrorObject.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    // Update world matrix
                    child.updateMatrixWorld();
                    
                    const reflector = new Reflector(child.geometry, {
                        textureWidth: this.resolution,
                        textureHeight: this.resolution,
                        color: 0x889999,
                        clipBias: 0.0039
                    });
                    
                    // Copy transform using world matrix
                    const worldMatrix = new THREE.Matrix4();
                    worldMatrix.copy(child.matrixWorld);
                    reflector.matrix.copy(worldMatrix);
                    reflector.matrix.decompose(
                        reflector.position,
                        reflector.quaternion,
                        reflector.scale
                    );
                    
                    if (child.parent) {
                        child.parent.add(reflector);
                        child.parent.remove(child);
                    }
                    
                    reflector.updateMatrixWorld();
                    
                    this.reflector = reflector;
                    console.log('✅ Reflector applied to mirror mesh');
                    console.log(`   Position: ${reflector.position.x}, ${reflector.position.y}, ${reflector.position.z}`);
                }
            });
        }
        
        console.log('✅ Reflector setup complete (visual only - no gameplay impact)');
    }
    
    /**
     * Updates the reflector (if needed)
     * Reflector handles rendering automatically via onBeforeRender
     */
    update() {
        // Try to find mirror if not found yet (in case model loaded after init)
        if (!this.mirrorObject) {
            this.findMirror();
            if (this.mirrorObject && !this.reflector) {
                // Mirror found, but system not fully initialized - complete initialization
                this.setupReflector();
                console.log('✅ Mirror system initialized (delayed)');
            }
        }
        
        // Ensure reflector world matrix is up to date
        if (this.reflector) {
            this.reflector.updateMatrixWorld();
        }
    }
    
    /**
     * Sets the mirror resolution (affects quality vs performance)
     * @param {number} resolution - Resolution in pixels (e.g., 256, 512, 1024)
     */
    setResolution(resolution) {
        if (this.reflector) {
            this.resolution = resolution;
            // Update reflector texture size
            this.reflector.getRenderTarget().setSize(resolution, resolution);
            console.log(`📊 Mirror resolution set to ${resolution}x${resolution}`);
        }
    }
    
    /**
     * Cleanup mirror system
     */
    cleanup() {
        if (this.reflector) {
            // Dispose reflector render target
            if (this.reflector.getRenderTarget) {
                const renderTarget = this.reflector.getRenderTarget();
                if (renderTarget) {
                    renderTarget.dispose();
                }
            }
            
            // Remove reflector from scene
            if (this.reflector.parent) {
                this.reflector.parent.remove(this.reflector);
            } else {
                this.scene.remove(this.reflector);
            }
            
            // Dispose geometry if we created it
            if (this.reflector.geometry) {
                this.reflector.geometry.dispose();
            }
            
            // Dispose material if it exists
            if (this.reflector.material) {
                if (this.reflector.material.map) {
                    this.reflector.material.map.dispose();
                }
                this.reflector.material.dispose();
            }
            
            this.reflector = null;
        }
        
        this.mirrorObject = null;
        
        console.log('🧹 Mirror system cleaned up');
    }
}

