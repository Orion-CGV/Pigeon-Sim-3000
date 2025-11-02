// Story System - Manages storyline progression with conditional unlocking
import * as THREE from 'three';

/**
 * StorySystem - Manages story progression, conditions, and objectives
 */
export class StorySystem {
    constructor(scene) {
        this.scene = scene;
        
        // Story state - tracks what has been completed/unlocked
        this.storyState = {
            // Completed levels (true = completed)
            levelsCompleted: {
                1: false,
                2: false,
                3: false
            },
            // Completed objectives (can track custom objectives)
            objectivesCompleted: [],
            // Current story chapter/phase
            currentChapter: 1,
            // Story start time (for progression tracking)
            storyStartTime: Date.now()
        };
        
        // Story configuration - defines requirements for unlocking content
        this.storyConfig = {
            // Level requirements - what must be completed to unlock each level
            levelRequirements: {
                1: ['found_joysticks'], // Level 1 requires finding joysticks first
                2: ['level1', 'found_joysticks'], // Level 2 requires level 1 and joysticks
                3: ['level1', 'level2', 'found_joysticks'] // Level 3 requires levels 1, 2, and joysticks
            },
            // Custom objectives that can be checked
            customObjectives: {
                // Example: 'found_joysticks': { description: 'Find the magical joysticks', required: false }
            }
        };
        
        // Story objectives/quests
        this.objectives = [
            {
                id: 'start',
                description: 'Explore the arcade basement',
                status: 'completed', // completed, active, locked
                requirements: []
            },
            {
                id: 'found_joysticks',
                description: 'Find the magical joysticks',
                status: 'active', // Can start - first objective after cutscene
                requirements: []
            },
            {
                id: 'complete_level1',
                description: 'Complete Pigeon Simulator',
                status: 'locked', // Locked until joysticks found
                requirements: ['found_joysticks']
            },
            {
                id: 'complete_level2',
                description: 'Complete Speed Delivery Game',
                status: 'locked', // Locked until level 1 is done
                requirements: ['complete_level1', 'found_joysticks']
            },
            {
                id: 'complete_level3',
                description: 'Complete Gravity Cube Game',
                status: 'locked',
                requirements: ['complete_level1', 'complete_level2', 'found_joysticks']
            }
        ];
        
        // Load saved progress (disabled for now)
        // this.loadProgress();
    }
    
    /**
     * Initializes the story system
     */
    init() {
        // Update objective statuses based on current progress
        this.updateObjectiveStatuses();
        
        // Store story system in scene for easy access
        this.scene.userData.storySystem = this;
        
        // Update mark visibility when initializing (in case we're reloading)
        this.updateMarkVisibility();
    }
    
    /**
     * Checks if a level can be accessed (all requirements met)
     * @param {number} levelNumber - Level number to check
     * @returns {boolean} True if level can be accessed
     */
    canAccessLevel(levelNumber) {
        const requirements = this.storyConfig.levelRequirements[levelNumber] || [];
        
        // If no requirements, level is always accessible
        if (requirements.length === 0) {
            return true;
        }
        
        // Check all requirements are met
        for (const requirement of requirements) {
            // Check if it's a level requirement (e.g., 'level1')
            if (requirement.startsWith('level')) {
                const reqLevel = parseInt(requirement.replace('level', ''));
                if (!this.storyState.levelsCompleted[reqLevel]) {
                    return false;
                }
            }
            // Check if it's an objective requirement (e.g., 'found_joysticks')
            else if (!this.storyState.objectivesCompleted.includes(requirement)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Gets the reason why a level is locked (if it is)
     * @param {number} levelNumber - Level number to check
     * @returns {string|null} Reason for lock, or null if unlocked
     */
    getLevelLockReason(levelNumber) {
        if (this.canAccessLevel(levelNumber)) {
            return null;
        }
        
        const requirements = this.storyConfig.levelRequirements[levelNumber] || [];
        const unmetRequirements = [];
        
        for (const requirement of requirements) {
            if (requirement.startsWith('level')) {
                const reqLevel = parseInt(requirement.replace('level', ''));
                if (!this.storyState.levelsCompleted[reqLevel]) {
                    unmetRequirements.push(`Complete Level ${reqLevel} first`);
                }
            } else {
                if (!this.storyState.objectivesCompleted.includes(requirement)) {
                    // Get friendly name for objective
                    const objective = this.objectives.find(obj => obj.id === requirement);
                    if (objective) {
                        unmetRequirements.push(objective.description);
                    } else {
                        unmetRequirements.push(requirement.replace(/_/g, ' '));
                    }
                }
            }
        }
        
        return unmetRequirements.join(', ');
    }
    
    /**
     * Marks a level as completed
     * @param {number} levelNumber - Level number that was completed
     */
    completeLevel(levelNumber) {
        if (this.storyState.levelsCompleted[levelNumber]) {
            return; // Already completed
        }
        
        this.storyState.levelsCompleted[levelNumber] = true;
        
        // Mark corresponding objective as completed
        const objectiveId = `complete_level${levelNumber}`;
        this.completeObjective(objectiveId);
        
        // Update objective statuses to unlock new ones
        this.updateObjectiveStatuses();
        
        // Update mark visibility based on completed levels
        this.updateMarkVisibility();
        
        // Save progress
        this.saveProgress();
        
        console.log(`✅ Level ${levelNumber} completed! Story progression updated.`);
    }
    
    /**
     * Updates the visibility of mark objects based on completed levels
     */
    updateMarkVisibility() {
        if (!this.scene || !this.scene.userData) {
            console.log('⚠️ Mark visibility update: Scene or userData not available');
            return;
        }
        
        // Show feather mark if level 1 is completed
        const featherMark = this.scene.userData.featherMark;
        if (featherMark) {
            const level1Completed = this.storyState.levelsCompleted[1] === true;
            featherMark.visible = level1Completed;
            console.log(`📊 Feather Mark: ${featherMark.visible ? 'VISIBLE' : 'HIDDEN'} (Level 1 completed: ${level1Completed})`);
            if (featherMark.visible) {
                console.log('✨ Feather mark is now visible');
            }
        } else {
            console.log('⚠️ Feather Mark: Not found in scene');
        }
        
        // Show car mark if level 2 is completed
        const carMark = this.scene.userData.carMark;
        if (carMark) {
            const level2Completed = this.storyState.levelsCompleted[2] === true;
            carMark.visible = level2Completed;
            console.log(`📊 Car Mark: ${carMark.visible ? 'VISIBLE' : 'HIDDEN'} (Level 2 completed: ${level2Completed})`);
            if (carMark.visible) {
                console.log('✨ Car mark is now visible');
            }
        } else {
            console.log('⚠️ Car Mark: Not found in scene');
        }
        
        // Show block mark if level 3 is completed
        const blockMark = this.scene.userData.blockMark;
        if (blockMark) {
            const level3Completed = this.storyState.levelsCompleted[3] === true;
            blockMark.visible = level3Completed;
            console.log(`📊 Block Mark: ${blockMark.visible ? 'VISIBLE' : 'HIDDEN'} (Level 3 completed: ${level3Completed})`);
            if (blockMark.visible) {
                console.log('✨ Block mark is now visible');
            }
        } else {
            console.log('⚠️ Block Mark: Not found in scene');
        }
    }
    
    /**
     * Checks if an objective is completed
     * @param {string} objectiveId - Objective ID to check
     * @returns {boolean} True if objective is completed
     */
    isObjectiveCompleted(objectiveId) {
        return this.storyState.objectivesCompleted.includes(objectiveId);
    }
    
    /**
     * Marks an objective as completed
     * @param {string} objectiveId - Objective ID to complete
     */
    completeObjective(objectiveId) {
        if (this.isObjectiveCompleted(objectiveId)) {
            return; // Already completed
        }
        
        this.storyState.objectivesCompleted.push(objectiveId);
        
        // Find objective and mark as completed
        const objective = this.objectives.find(obj => obj.id === objectiveId);
        if (objective) {
            objective.status = 'completed';
        }
        
        // Update objective statuses to unlock dependent objectives
        this.updateObjectiveStatuses();
        
        // Save progress
        this.saveProgress();
        
        console.log(`✅ Objective "${objectiveId}" completed!`);
    }
    
    /**
     * Updates objective statuses based on requirements
     */
    updateObjectiveStatuses() {
        for (const objective of this.objectives) {
            // Skip if already completed
            if (objective.status === 'completed') {
                continue;
            }
            
            // Check if all requirements are met
            const allRequirementsMet = objective.requirements.every(req => {
                return this.storyState.objectivesCompleted.includes(req) ||
                       (req.startsWith('complete_level') && 
                        this.storyState.levelsCompleted[parseInt(req.replace('complete_level', ''))]);
            });
            
            // Update status
            if (allRequirementsMet && objective.status === 'locked') {
                objective.status = 'active';
                console.log(`📖 New objective available: ${objective.description}`);
            }
        }
    }
    
    /**
     * Gets all active (available but not completed) objectives
     * @returns {Array} Array of active objectives
     */
    getActiveObjectives() {
        return this.objectives.filter(obj => obj.status === 'active');
    }
    
    /**
     * Gets all completed objectives
     * @returns {Array} Array of completed objectives
     */
    getCompletedObjectives() {
        return this.objectives.filter(obj => obj.status === 'completed');
    }
    
    /**
     * Gets all locked objectives
     * @returns {Array} Array of locked objectives
     */
    getLockedObjectives() {
        return this.objectives.filter(obj => obj.status === 'locked');
    }
    
    /**
     * Gets story progress percentage
     * @returns {number} Progress percentage (0-100)
     */
    getProgressPercentage() {
        const totalLevels = Object.keys(this.storyState.levelsCompleted).length;
        const completedLevels = Object.values(this.storyState.levelsCompleted).filter(c => c).length;
        return Math.round((completedLevels / totalLevels) * 100);
    }
    
    /**
     * Checks if all levels are completed
     * @returns {boolean} True if all levels are completed
     */
    areAllLevelsCompleted() {
        return this.storyState.levelsCompleted[1] === true &&
               this.storyState.levelsCompleted[2] === true &&
               this.storyState.levelsCompleted[3] === true;
    }
    
    /**
     * Saves story progress to localStorage (disabled for now)
     */
    saveProgress() {
        // localStorage saving disabled
        // try {
        //     localStorage.setItem('storyProgress', JSON.stringify(this.storyState));
        //     console.log('💾 Story progress saved');
        // } catch (err) {
        //     console.warn('Failed to save story progress:', err);
        // }
    }
    
    /**
     * Loads story progress from localStorage (disabled for now)
     */
    loadProgress() {
        // localStorage loading disabled
        // try {
        //     const saved = localStorage.getItem('storyProgress');
        //     if (saved) {
        //         const loadedState = JSON.parse(saved);
        //         // Merge with current state (preserve structure)
        //         this.storyState = {
        //             ...this.storyState,
        //             ...loadedState,
        //             // Ensure levelsCompleted has all levels
        //             levelsCompleted: {
        //                 ...this.storyState.levelsCompleted,
        //                 ...loadedState.levelsCompleted
        //             }
        //         };
        //         console.log('📂 Story progress loaded');
        //     }
        // } catch (err) {
        //     console.warn('Failed to load story progress:', err);
        // }
    }
    
    /**
     * Resets story progress (for testing or new game)
     */
    resetProgress() {
        this.storyState = {
            levelsCompleted: {
                1: false,
                2: false,
                3: false
            },
            objectivesCompleted: [],
            currentChapter: 1,
            storyStartTime: Date.now()
        };
        
        // Reset objective statuses
        this.objectives.forEach(obj => {
            if (obj.id === 'start') {
                obj.status = 'completed';
            } else if (obj.id === 'found_joysticks') {
                obj.status = 'active'; // First objective after cutscene
            } else {
                obj.status = 'locked';
            }
        });
        
        // Clear localStorage (disabled for now)
        // localStorage.removeItem('storyProgress');
        
        // Save reset state (disabled for now)
        // this.saveProgress();
        
        console.log('🔄 Story progress reset');
    }
    
    /**
     * Gets story state (for external access)
     * @returns {Object} Current story state
     */
    getStoryState() {
        return { ...this.storyState };
    }
    
    /**
     * Gets story configuration (for external access)
     * @returns {Object} Story configuration
     */
    getStoryConfig() {
        return { ...this.storyConfig };
    }
    
    /**
     * Gets all objectives (for UI display)
     * @returns {Array} All objectives
     */
    getAllObjectives() {
        return [...this.objectives];
    }
    
    /**
     * Cleanup story system
     */
    cleanup() {
        // Save progress before cleanup
        this.saveProgress();
        
        // Clear scene reference
        if (this.scene.userData.storySystem === this) {
            delete this.scene.userData.storySystem;
        }
    }
}

