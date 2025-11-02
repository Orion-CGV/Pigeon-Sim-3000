// Story UI - Displays story objectives and progress
/**
 * StoryUI - Manages UI display for story objectives and progress
 */
export class StoryUI {
    constructor() {
        this.uiElement = null;
        this.objectivesList = null;
        this.progressBar = null;
        this.storySystem = null;
        this.visible = false;
    }
    
    /**
     * Initializes the story UI
     */
    init() {
        // Prevent double initialization
        if (this.uiElement && this.uiElement.parentNode) {
            return;
        }
        
        // Create main story UI container
        this.uiElement = document.createElement("div");
        this.uiElement.className = "game-ui story-ui";
        this.uiElement.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 300px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 15px;
            color: white;
            font-family: 'Jersey 10', sans-serif;
            font-size: 18px;
            font-weight: normal;
            z-index: 100;
            max-height: 400px;
            overflow-y: auto;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
        `;
        
        // Create title
        const title = document.createElement("div");
        title.innerHTML = '<i data-lucide="book-open" style="display: inline-block; width: 20px; height: 20px; vertical-align: middle; color: #ffb74d; filter: drop-shadow(0 0 6px rgba(255, 183, 77, 0.6));"></i> STORY OBJECTIVES';
        title.style.cssText = `
            font-size: 20px;
            font-weight: normal;
            margin-bottom: 10px;
            color: #00ff00;
            text-align: center;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 8px;
        `;
        this.uiElement.appendChild(title);
        
        // Create progress bar container
        const progressContainer = document.createElement("div");
        progressContainer.style.cssText = `
            margin-bottom: 15px;
        `;
        
        const progressLabel = document.createElement("div");
        progressLabel.textContent = "Progress:";
        progressLabel.style.cssText = `
            font-size: 16px;
            margin-bottom: 5px;
            color: #aaa;
        `;
        progressContainer.appendChild(progressLabel);
        
        // Progress bar background
        const progressBarBg = document.createElement("div");
        progressBarBg.style.cssText = `
            width: 100%;
            height: 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            overflow: hidden;
        `;
        
        this.progressBar = document.createElement("div");
        this.progressBar.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #00ff00, #87CEEB);
            width: 0%;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: normal;
            color: #000;
        `;
        progressBarBg.appendChild(this.progressBar);
        progressContainer.appendChild(progressBarBg);
        
        this.uiElement.appendChild(progressContainer);
        
        // Create objectives list container
        this.objectivesList = document.createElement("div");
        this.objectivesList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        this.uiElement.appendChild(this.objectivesList);
        
        // Add toggle button
        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = '<i data-lucide="clipboard-list" style="color: #00ff00;"></i>';
        toggleButton.style.cssText = `
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(0, 255, 0, 0.3);
            border: 1px solid #00ff00;
            color: #00ff00;
            width: 30px;
            height: 30px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        toggleButton.onclick = () => this.toggle();
        toggleButton.title = "Toggle Story Objectives";
        this.uiElement.appendChild(toggleButton);
        
        // Add to document
        document.body.appendChild(this.uiElement);
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    /**
     * Sets the story system reference
     * @param {StorySystem} storySystem - Story system instance
     */
    setStorySystem(storySystem) {
        this.storySystem = storySystem;
        this.update();
    }
    
    /**
     * Updates the UI with current story state
     */
    update() {
        if (!this.storySystem || !this.uiElement) return;
        
        // Update progress bar
        const progress = this.storySystem.getProgressPercentage();
        this.progressBar.style.width = `${progress}%`;
        this.progressBar.textContent = `${progress}%`;
        
        // Clear objectives list
        this.objectivesList.innerHTML = '';
        
        // Get objectives
        const allObjectives = this.storySystem.getAllObjectives();
        
        // Display active objectives first
        const activeObjectives = allObjectives.filter(obj => obj.status === 'active');
        if (activeObjectives.length > 0) {
            const activeHeader = document.createElement("div");
            activeHeader.textContent = "ACTIVE:";
            activeHeader.style.cssText = `
                font-size: 16px;
                font-weight: normal;
                color: #00ff00;
                margin-top: 5px;
                margin-bottom: 5px;
            `;
            this.objectivesList.appendChild(activeHeader);
            
            activeObjectives.forEach(obj => {
                this.createObjectiveElement(obj);
            });
        }
        
        // Display completed objectives
        const completedObjectives = allObjectives.filter(obj => obj.status === 'completed');
        if (completedObjectives.length > 0) {
            const completedHeader = document.createElement("div");
            completedHeader.textContent = "COMPLETED:";
            completedHeader.style.cssText = `
                font-size: 16px;
                font-weight: normal;
                color: #aaa;
                margin-top: 10px;
                margin-bottom: 5px;
            `;
            this.objectivesList.appendChild(completedHeader);
            
            completedObjectives.forEach(obj => {
                this.createObjectiveElement(obj);
            });
        }
        
        // Display locked objectives (collapsed by default)
        const lockedObjectives = allObjectives.filter(obj => obj.status === 'locked');
        if (lockedObjectives.length > 0) {
            const lockedHeader = document.createElement("div");
            lockedHeader.textContent = "LOCKED:";
            lockedHeader.style.cssText = `
                font-size: 16px;
                font-weight: normal;
                color: #666;
                margin-top: 10px;
                margin-bottom: 5px;
            `;
            this.objectivesList.appendChild(lockedHeader);
            
            lockedObjectives.forEach(obj => {
                this.createObjectiveElement(obj);
            });
        }
    }
    
    /**
     * Creates an objective element for display
     * @param {Object} objective - Objective data
     */
    createObjectiveElement(objective) {
        const objElement = document.createElement("div");
        objElement.style.cssText = `
            padding: 8px;
            border-radius: 5px;
            background: ${objective.status === 'completed' ? 'rgba(0, 255, 0, 0.1)' : 
                        objective.status === 'active' ? 'rgba(255, 255, 0, 0.1)' : 
                        'rgba(128, 128, 128, 0.1)'};
            border-left: 3px solid ${objective.status === 'completed' ? '#00ff00' : 
                           objective.status === 'active' ? '#ffff00' : '#666'};
            opacity: ${objective.status === 'locked' ? '0.6' : '1'};
        `;
        
        const statusIcon = objective.status === 'completed' ? '<i data-lucide="check-circle" style="display: inline-block; width: 16px; height: 16px; vertical-align: middle; color: #00ff00; filter: drop-shadow(0 0 4px rgba(0, 255, 0, 0.6));"></i>' : 
                          objective.status === 'active' ? '<i data-lucide="target" style="display: inline-block; width: 16px; height: 16px; vertical-align: middle; color: #ffb74d; filter: drop-shadow(0 0 4px rgba(255, 183, 77, 0.6));"></i>' : 
                          '<i data-lucide="lock" style="display: inline-block; width: 16px; height: 16px; vertical-align: middle; color: #9e9e9e; filter: drop-shadow(0 0 4px rgba(158, 158, 158, 0.4));"></i>';
        
        objElement.innerHTML = `
            <div style="font-weight: normal; margin-bottom: 3px;">
                ${statusIcon} ${objective.description}
            </div>
            ${objective.status === 'locked' && objective.requirements.length > 0 ? 
                `<div style="font-size: 14px; color: #aaa; margin-top: 3px;">
                    Requires: ${objective.requirements.map(req => {
                        const reqObj = this.storySystem.getAllObjectives().find(o => o.id === req);
                        return reqObj ? reqObj.description : req;
                    }).join(', ')}
                </div>` : ''}
        `;
        
        this.objectivesList.appendChild(objElement);
        
        // Initialize Lucide icons for the new element
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    /**
     * Shows the story UI
     */
    show() {
        if (this.uiElement) {
            this.uiElement.style.display = 'block';
            this.visible = true;
            this.update();
        }
    }
    
    /**
     * Hides the story UI
     */
    hide() {
        if (this.uiElement) {
            this.uiElement.style.display = 'none';
            this.visible = false;
        }
    }
    
    /**
     * Toggles visibility of story UI
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    /**
     * Cleanup story UI
     */
    cleanup() {
        if (this.uiElement && this.uiElement.parentNode) {
            this.uiElement.parentNode.removeChild(this.uiElement);
            this.uiElement = null;
            this.objectivesList = null;
            this.progressBar = null;
        }
    }
}

