import * as THREE from 'three';
import { createLevel, createRoads, playerStartPosition } from "../environment/level1.js";
import { createPlayer, updatePlayer } from "../models/player.js";
import { setupInput, input } from "../input/inputHandler.js";
import { updateWalking } from "../physics/movement.js";
import { updateFlying } from "../physics/flight.js";
import { getSpeedBoostState } from "../physics/flight.js";
import { getWalkSpeedBoostState as getWalkBoostState } from "../physics/movement.js";
import { enableCollisionDebug } from "../physics/movement.js";
import { AudioListener, Audio } from 'three';   



export class Game {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
        setupInput();

        // Game state
        this.score = 0;
        this.collectedItems = {};
        this.totalCollectibles = 0;
        this.isFlying = false;
        this.prevFlyToggle = false;
        this.flyState = { isAscendingToFly: false, targetFlyHeight: 0 };
        this.gameLoaded = false;
        this.isPaused = false;  
        this.pauseStartTime = 0;

        // Timer & Medals
        this.gameTime = 5 * 60;
        this.timerRunning = false;
        this.gameStartTime = 0;
        this.medal = null;

        // UI Elements
        this.welcomeScreen = null;
        this.timerElement = null;
        this.medalElement = null;
        this.controlsElement = null;
        this.loadProgressBar = null;
        this.tokenUIContainer = null;

        this.listener   = new THREE.AudioListener();
        this.camera.add(this.listener);               // camera is the listener
        this.sounds     = {};                         // named sound buffers
        this.music      = null;                       // background track
        this.isMuted    = false;


        this._lastBoostActive = false;
        this._wasPaused       = false;
        // Loading state
        this.loadingProgress = 0;

        // Camera
        this.yaw = 0;
        this.pitch = 0;
        this.MOUSE_SENS = 0.0025;

        // Scenes
        this.uiScene = new THREE.Scene();
        this.uiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);

        // Bind methods
        this._onPointerLockChange = this._onPointerLockChange.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._requestLock = this._requestLock.bind(this);
        this._startGame = this._startGame.bind(this);
        this._updateLoadProgress = this._updateLoadProgress.bind(this);
        this._togglePause = this._togglePause.bind(this);  // ← NEW: Pause toggle

        // Event listeners
        this.renderer.domElement.addEventListener('click', this._requestLock);
        document.addEventListener('pointerlockchange', this._onPointerLockChange);
        document.addEventListener('keydown', this._togglePause);  // ← NEW: ESC listener
        
        // Show welcome + start loading
        this._showWelcomeScreen();
        this._loadLevel();
    }

  async _loadLevel() {
    try {
        console.log('Loading level...');
        const start = performance.now();

        // Animate loading progress
        const animateProgress = () => {
            this.loadingProgress = Math.min(this.loadingProgress + 0.02, 0.95);
        };
        const progressTimer = setInterval(animateProgress, 50);

        // TEST MODE = TRUE!
        const { scene: levelScene, camera: levelCamera } = await createLevel(true);

        clearInterval(progressTimer);

        await this._loadAudio();

        this.scene = levelScene;
        this.camera = levelCamera;

        this.player = createPlayer();
        this.scene.add(this.player);
        this.player.position.set(
            playerStartPosition.x,
            playerStartPosition.y,
            playerStartPosition.z
        );

        this.totalCollectibles = this.scene.userData.collectibles?.length || 0;
        enableCollisionDebug(this.scene, false);

        this.gameLoaded = true;
        console.log(`Level ready in ${(performance.now() - start)/1000}s`);
        console.log(`🎯 TEST MODE: ${this.totalCollectibles} tokens loaded!`);
    } catch (e) {
        console.error('Level load failed:', e);
        this.gameLoaded = false;
    }
}

async _loadAudio() {
    const audioLoader = new THREE.AudioLoader();

    const soundList = {
        collect   : 'assets/sounds/collect.wav',
        fly       : 'assets/sounds/fly.wav',
        boost     : 'assets/sounds/boost.wav',
        pause     : 'assets/sounds/pause.wav',
        victory   : 'assets/sounds/victory.wav',
        background: 'assets/music/nyc_ambient.mp3'   // looping music
    };

    // Load every file in parallel
    const loadPromises = Object.entries(soundList).map(([name, url]) => {
        return audioLoader.loadAsync(url).then(buffer => ({ name, buffer }));
    });

    const results = await Promise.all(loadPromises);
    results.forEach(({ name, buffer }) => {
        const sound = new THREE.Audio(this.listener);
        sound.setBuffer(buffer);
        sound.setVolume(name === 'background' ? 0.35 : 0.6);
        this.sounds[name] = sound;
    });

    // Background music – loop + auto-start
    this.music = this.sounds.background;
    this.music.setLoop(true);
    this.music.play();
}

_playSound(name, volume = 1) {
    if (this.isMuted) return;
    const s = this.sounds[name];
    if (!s) return console.warn(`Sound "${name}" missing`);
    s.stop();
    s.setVolume(volume);
    s.play();
}


    _updateLoadProgress() {
        if (!this.loadProgressBar) return;

        const fake = Math.min(this.loadingProgress, 0.95);
        this.loadProgressBar.style.width = `${fake * 100}%`;

        const btn = document.getElementById('start-game-btn');
        if (!btn) return;

        if (this.gameLoaded) {
            this.loadProgressBar.style.width = '100%';
            this.loadProgressBar.style.background = '#00ff88';
            btn.textContent = 'START GAME';
            btn.disabled = false;
            btn.style.cursor = 'pointer';
        } else {
            btn.textContent = 'Loading...';
            btn.disabled = true;
        }
    }

_showWelcomeScreen() {
    if (this.welcomeScreen) this.welcomeScreen.remove();

    this.welcomeScreen = document.createElement('div');
    this.welcomeScreen.id = 'welcome-screen';
    this.welcomeScreen.style.cssText = `
        position:fixed; inset:0;
        background:linear-gradient(to bottom, #1b1f3b 0%, #0a0a1a 70%, #000 100%);
        color:#fff; font-family:'Segoe UI','Poppins','Arial',sans-serif;
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:9999; text-align:center; overflow:hidden;
        padding:40px; box-sizing:border-box;
        animation:fadeIn 1.5s ease forwards;
    `;

    // -----------------------------------------------------------------
    // 1. Background skyline with glowing lights
    // -----------------------------------------------------------------
    const skylineHTML = `
        <div style="
            position:absolute; bottom:0; left:0; width:100%; height:220px;
            background:linear-gradient(to top, rgba(0,0,0,0.9) 10%, transparent 100%);
            mask-image:url('data:image/svg+xml;utf8,
                <svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 1000 200\\">
                    <path d=\\"M0,200 L0,130 L50,120 L80,90 L120,110 L160,60 L200,80 L240,100 
                    L280,70 L320,130 L360,110 L400,150 L440,100 L480,130 L520,80 L560,120 
                    L600,90 L640,100 L680,70 L720,140 L760,90 L800,120 L840,80 L880,110 
                    L920,90 L960,130 L1000,100 L1000,200 Z\\" fill='white'/>
                </svg>
        </div>
        <div style="
            position:absolute; bottom:0; left:0; width:100%; height:100%;
            background:radial-gradient(circle at 50% 70%, rgba(255,180,100,0.25) 0%, transparent 60%),
                        radial-gradient(circle at 30% 80%, rgba(255,255,150,0.15) 0%, transparent 60%);
            z-index:-1;
        "></div>
    `;

    // -----------------------------------------------------------------
    // 2. Title
    // -----------------------------------------------------------------
    const titleHTML = `
        <div style="margin-bottom:30px; animation:fadeInUp 1.5s .3s forwards; opacity:0;">
            <h1 style="
                font-size:clamp(48px,8vw,90px);
                margin:0;
                background:linear-gradient(45deg,#b0e0ff,#ffffff,#d0f0ff);
                background-size:300%; -webkit-background-clip:text;
                background-clip:text; -webkit-text-fill-color:transparent;
                text-shadow:0 0 20px rgba(255,255,255,.3);
                animation:gradientShift 8s linear infinite;
            ">Pigeon Sim 3000</h1>
        </div>`;

    // -----------------------------------------------------------------
    // 3. Tagline
    // -----------------------------------------------------------------
    const taglineHTML = `
        <p style="
            font-size:clamp(18px,3vw,26px);
            color:#cde9ff; text-shadow:0 0 10px rgba(100,180,255,0.3);
            margin:20px 0 40px; max-width:700px;
            opacity:0; animation:fadeInUp 1.5s .6s forwards;
        ">
            Glide through New York’s twilight skyline — every rooftop, every gust, every feather counts.
            <br><strong>Take flight. Own the city.</strong>
        </p>`;

    // -----------------------------------------------------------------
    // 4. Controls
    // -----------------------------------------------------------------
    const controlsHTML = `
        <div style="
            background:rgba(255,255,255,.05); backdrop-filter:blur(10px);
            border:1px solid rgba(255,255,255,.15); border-radius:18px;
            padding:22px; margin:20px 0; max-width:540px; width:90%;
            box-shadow:0 8px 30px rgba(0,0,0,.4);
            opacity:0; animation:fadeInUp 1.5s .9s forwards;
        ">
            <h3 style="color:#ffd700; margin:0 0 14px; font-size:22px;">Quick Controls</h3>
            <div style="
                display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
                gap:10px; font-size:16px; color:#e0f7ff;
            ">
                <div><kbd>WASD</kbd> Move</div>
                <div><kbd>Mouse</kbd> Look</div>
                <div><kbd>F</kbd> Fly</div>
                <div><kbd>SPACE</kbd> Jump</div>
            </div>
        </div>`;

    // -----------------------------------------------------------------
    // 5. Progress bar
    // -----------------------------------------------------------------
    const progressHTML = `
        <div id="progress-container" style="
            margin:40px 0; width:min(420px,80%); height:24px;
            background:rgba(0,0,0,.4); border-radius:12px;
            border:1px solid rgba(255,255,255,.2); overflow:hidden;
            opacity:0; animation:fadeInUp 1.5s 1.2s forwards;
        ">
            <div id="load-progress-bar" style="
                height:100%; width:0%;
                background:linear-gradient(90deg,#00ccff,#00ffaa);
                transition:width .3s ease;
            "></div>
        </div>`;

    // -----------------------------------------------------------------
    // 6. Start button (responsive)
    // -----------------------------------------------------------------
    const buttonHTML = `
        <button id="start-game-btn" style="
            padding:clamp(12px,2vw,20px) clamp(36px,6vw,60px);
            font-size:clamp(18px,2.5vw,26px); font-weight:600;
            background:linear-gradient(45deg,#00ffaa,#00cc88);
            color:#001; border:none; border-radius:50px;
            cursor:pointer; box-shadow:0 10px 30px rgba(0,255,136,.5);
            transition:transform .2s, box-shadow .2s;
            text-transform:uppercase; letter-spacing:1.5px;
            opacity:0; animation:fadeInUp 1.5s 1.5s forwards;
            width:auto; max-width:90%;
        " disabled>
            Loading...
        </button>`;

    // -----------------------------------------------------------------
    // 7. Global CSS
    // -----------------------------------------------------------------
    const styleHTML = `
        <style>
            @keyframes fadeIn {from{opacity:0;} to{opacity:1;}}
            @keyframes fadeInUp {from{opacity:0; transform:translateY(30px);} to{opacity:1; transform:translateY(0);}}
            @keyframes gradientShift {0%{background-position:0% 50%;} 100%{background-position:100% 50%;}}
            @keyframes buttonPulse {
                0%,100% { box-shadow:0 10px 30px rgba(0,255,136,.5); }
                50% { box-shadow:0 15px 40px rgba(0,255,136,.8); }
            }
            #start-game-btn:not([disabled]) {
                animation:buttonPulse 2.5s infinite;
            }
            #start-game-btn:not([disabled]):hover {
                transform:translateY(-3px) scale(1.05);
                box-shadow:0 15px 45px rgba(0,255,136,.7);
            }
            #start-game-btn:not([disabled]):active {
                transform:translateY(-1px) scale(1.02);
            }
            kbd {
                background:#111; color:#00ffff;
                padding:2px 6px; border-radius:4px;
                font-family:monospace; font-size:14px;
            }
        </style>`;

    // -----------------------------------------------------------------
    // Assemble all parts
    // -----------------------------------------------------------------
    this.welcomeScreen.innerHTML =
        skylineHTML + titleHTML + taglineHTML + controlsHTML + progressHTML + buttonHTML + styleHTML;

    document.body.appendChild(this.welcomeScreen);

    // Cache references
    this.loadProgressBar = document.getElementById('load-progress-bar');
    const startBtn = document.getElementById('start-game-btn');
    startBtn.addEventListener('click', this._startGame);

    // Fake loading animation
    this.progressInterval = setInterval(this._updateLoadProgress, 50);
}



    _startGame() {
        if (!this.gameLoaded) return;

        clearInterval(this.progressInterval);
        if (this.welcomeScreen) {
            this.welcomeScreen.style.transition = 'opacity 0.8s';
            this.welcomeScreen.style.opacity = '0';
            setTimeout(() => this.welcomeScreen.remove(), 800);
        }

        // Create persistent controls
        this._createPersistentControls();

        // Start timer & game
        this.timerRunning = true;
        this.gameStartTime = performance.now();
        this._createTimerUI();
        this._createMedalUI();

        // Initialize game systems
        this._createCrosshair();
        this._createCrosshair3D();
        this._createScoreUI();
        this._createSpeedBoostUI();
        this._createScreenEffect();
        this._setupDebugKeys();
        this._initMinimap();

        this.lastTime = performance.now();
        this.loop();
    }

    _createPersistentControls() {
        if (this.controlsElement) return;

        this.controlsElement = document.createElement('div');
        this.controlsElement.id = 'persistent-controls';
        this.controlsElement.style.cssText = `
            position: absolute; bottom: 20px; right: 20px;
            background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
            border-radius: 15px; padding: 15px; z-index: 1002;
            border: 1px solid rgba(0,255,255,0.5); min-width: 160px;
            font-family: Arial; font-size: 12px; color: #a0d8ff;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        `;
        this.controlsElement.innerHTML = `
            <div style="font-weight: bold; color: #00ffff; margin-bottom: 8px;">CONTROLS</div>
            <div>WASD: Move</div>
            <div>Mouse: Look</div>
            <div>F: Fly</div>
            <div>SPACE: Jump </div>

        `;
        document.body.appendChild(this.controlsElement);
    }

    _createTimerUI() {
        if (this.timerElement) this.timerElement.remove();

        this.timerElement = document.createElement('div');
        this.timerElement.id = 'game-timer';
        this.timerElement.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: #ffffff; font-family: 'Arial Black', Arial;
            font-size: 40px; font-weight: bold; z-index: 1001;
            background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(20,20,50,0.8));
            padding: 12px 24px; border-radius: 20px;
            border: 3px solid #00ff88; box-shadow: 0 0 20px rgba(0,255,136,0.5);
            text-shadow: 2px 2px 8px black;
        `;
        this.timerElement.textContent = '5:00';
        document.body.appendChild(this.timerElement);
    }


    _createMedalUI() {
        this.medalElement = document.createElement('div');
        this.medalElement.id = 'medal-display';
        this.medalElement.style.cssText = `
            position: absolute;
            top: 80px;
            right: 20px;
            width: 80px;
            height: 80px;
            background: rgba(0,0,0,0.7);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 1s;
            border: 4px solid #333;
        `;
        document.body.appendChild(this.medalElement);
    }

    _updateTimer() {
        if (!this.timerRunning) return;

        const elapsed = (performance.now() - this.gameStartTime) / 1000;
        const remaining = Math.max(0, this.gameTime - elapsed);

        const mins = Math.floor(remaining / 60);
        const secs = Math.floor(remaining % 60);
        this.timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        // Flash red when low
        if (remaining < 60) {
            this.timerElement.style.borderColor = '#ff0000';
            this.timerElement.style.color = remaining < 10 ? '#ff0000' : '#ffff00';
        }

        if (remaining <= 0) {
            this.timerRunning = false;
            this._endGame();
        }
    }

    _awardMedal() {
        const percent = this.score / this.totalCollectibles;
        let medal = '';
        let color = '';
        let emoji = '';

        if (percent >= 1.0) {
            medal = 'GOLD'; emoji = '🥇'; color = '#ffd700';
        } else if (percent >= 0.8) {
            medal = 'SILVER'; emoji = '🥈'; color = '#c0c0c0';
        } else if (percent >= 0.5) {
            medal = 'BRONZE'; emoji = '🥉'; color = '#cd7f32';
        } else {
            medal = 'NONE'; emoji = '💔'; color = '#666';
        }

        this.medal = medal;
        this.medalElement.innerHTML = emoji;
        this.medalElement.style.background = color;
        this.medalElement.style.opacity = '1';
        this.medalElement.style.borderColor = color;
    }

    _togglePause(e) {
        if (e.key !== 'Escape' || !this.gameLoaded || !this.timerRunning) return;
        
        e.preventDefault();
        this.isPaused = !this.isPaused;
        
        if (this.isPaused) {
            this._showPauseMenu();
            // Pause timer
            this.pauseStartTime = performance.now();
            // Exit pointer lock
            document.exitPointerLock();
        } else {
            this._hidePauseMenu();
            // Resume timer (adjust gameStartTime)
            const pauseDuration = (performance.now() - this.pauseStartTime) / 1000;
            this.gameStartTime += pauseDuration * 1000;
            // Re-lock pointer
            this._requestLock();
        }
    }

    // ← NEW: Show pause menu
    _showPauseMenu() {
        if (this.pauseMenuElement) return;

        this.pauseMenuElement = document.createElement('div');
        this.pauseMenuElement.id = 'pause-menu';
        this.pauseMenuElement.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 30, 0.85); backdrop-filter: blur(5px);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 10000; color: white; font-family: 'Arial Black', Arial;
            text-align: center; cursor: pointer;
        `;

        this.pauseMenuElement.innerHTML = `
            <div style="margin-bottom: 40px;">
                <h1 style="
                    font-size: 64px; margin: 0; color: #00ffff;
                    text-shadow: 0 0 20px #00ffff; letter-spacing: 4px;
                ">PAUSED</h1>
                <p style="font-size: 20px; color: #a0d8ff; margin: 10px 0;">
                    Items: ${this.score}/${this.totalCollectibles} | Time: ${this.timerElement?.textContent || '5:00'}
                </p>
            </div>
            <div style="
                background: rgba(255,255,255,0.1); backdrop-filter: blur(10px);
                border-radius: 20px; padding: 30px; max-width: 400px;
                border: 1px solid rgba(0,255,255,0.3);
            ">
                <button id="resume-btn" style="
                    display: block; width: 200px; margin: 10px auto; padding: 15px;
                    background: linear-gradient(45deg, #00ff88, #00cc66); color: black;
                    border: none; border-radius: 10px; font-size: 18px; font-weight: bold;
                    cursor: pointer; transition: all 0.3s;
                ">Resume (ESC)</button>
                <button id="restart-btn" style="
                    display: block; width: 200px; margin: 10px auto; padding: 15px;
                    background: linear-gradient(45deg, #ff6b6b, #ee5a52); color: white;
                    border: none; border-radius: 10px; font-size: 18px; font-weight: bold;
                    cursor: pointer; transition: all 0.3s;
                ">Restart Level</button>
                <button id="quit-btn" style="
                    display: block; width: 200px; margin: 10px auto; padding: 15px;
                    background: linear-gradient(45deg, #667eea, #764ba2); color: white;
                    border: none; border-radius: 10px; font-size: 18px; font-weight: bold;
                    cursor: pointer; transition: all 0.3s;
                ">Quit to Menu</button>
            </div>
            <style>
                #pause-menu button:hover {
                    transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                #pause-menu h1 { animation: glow 2s ease-in-out infinite alternate; }
                @keyframes glow { 0% { text-shadow: 0 0 20px #00ffff; } 100% { text-shadow: 0 0 30px #00ffff; } }
            </style>
        `;

        document.body.appendChild(this.pauseMenuElement);

        // Add event listeners
        document.getElementById('resume-btn').addEventListener('click', this._togglePause);
        document.getElementById('restart-btn').addEventListener('click', () => location.reload());
        document.getElementById('quit-btn').addEventListener('click', () => {
            this._showWelcomeScreen();
            this._endGame();  // Clean up current game
        });

        // Block all input during pause
        document.addEventListener('keydown', this._blockInput);
        document.addEventListener('mousemove', this._blockMouse);
    }

    // ← NEW: Hide pause menu
    _hidePauseMenu() {
        if (!this.pauseMenuElement) return;

        this.pauseMenuElement.remove();
        this.pauseMenuElement = null;

        // Re-enable input
        document.removeEventListener('keydown', this._blockInput);
        document.removeEventListener('mousemove', this._blockMouse);
    }

    // ← NEW: Block input during pause
    _blockInput(e) {
        e.preventDefault();
        return false;
    }

    // ← NEW: Block mouse during pause
    _blockMouse(e) {
        e.preventDefault();
        return false;
    }

    _endGame() {

        this.timerRunning = false;
        this.timerRunning = false;
        this._awardMedal();

        // stop background music
        if (this.music) this.music.stop();

        // play victory fanfare
        this._playSound('victory');

        // Victory or Game Over
        const message = this.score >= this.totalCollectibles ?
            `<h1 style="color: gold;">VICTORY! ${this.medal} MEDAL</h1>` :
            `<h1 style="color: #ff3366;">TIME'S UP!</h1><p>You collected ${this.score}/${this.totalCollectibles}</p><h2>${this.medal} MEDAL</h2>`;

        const endScreen = document.createElement('div');
        endScreen.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); color: white; z-index: 9999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: Arial; text-align: center;
        `;
        endScreen.innerHTML = `
            ${message}
            <button onclick="location.reload()" style="
                margin-top: 30px; padding: 15px 40px; font-size: 24px;
                background: #00ff88; color: black; border: none; border-radius: 10px;
                cursor: pointer;
            ">PLAY AGAIN</button>
        `;
        document.body.appendChild(endScreen);
    }

 

    // ADDED: Create speed boost UI elements
    _createSpeedBoostUI() {
        // Remove existing speed boost UI if any
        const existingBoost = document.getElementById('speed-boost-ui');
        if (existingBoost) {
            existingBoost.remove();
        }

        // Create speed boost container
        this.speedBoostContainer = document.createElement('div');
        this.speedBoostContainer.id = 'speed-boost-ui';
        this.speedBoostContainer.style.position = 'absolute';
        this.speedBoostContainer.style.bottom = '20px';
        this.speedBoostContainer.style.left = '20px';
        this.speedBoostContainer.style.zIndex = '1000';
        this.speedBoostContainer.style.pointerEvents = 'none';

        // Create progress bar background
        const boostBarBg = document.createElement('div');
        boostBarBg.style.width = '200px';
        boostBarBg.style.height = '20px';
        boostBarBg.style.background = '#333';
        boostBarBg.style.border = '2px solid #fff';
        boostBarBg.style.borderRadius = '10px';
        boostBarBg.style.overflow = 'hidden';

        // Create progress bar fill
        this.boostBarFill = document.createElement('div');
        this.boostBarFill.style.width = '0%';
        this.boostBarFill.style.height = '100%';
        this.boostBarFill.style.background = '#666';
        this.boostBarFill.style.transition = 'width 0.1s, background-color 0.3s';

        // Create boost text
        this.boostText = document.createElement('div');
        this.boostText.style.color = 'white';
        this.boostText.style.fontFamily = 'Arial, sans-serif';
        this.boostText.style.fontSize = '14px';
        this.boostText.style.marginTop = '5px';
        this.boostText.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';
        this.boostText.textContent = 'Speed Boost: Ready';

        // Assemble UI
        boostBarBg.appendChild(this.boostBarFill);
        this.speedBoostContainer.appendChild(boostBarBg);
        this.speedBoostContainer.appendChild(this.boostText);
        
        document.body.appendChild(this.speedBoostContainer);
    }

    // ADDED: Update speed boost UI
    _updateSpeedBoostUI() {
        if (!this.boostBarFill || !this.boostText) return;

        // Get the appropriate speed boost state based on current mode
        const boostState = this.isFlying ? getSpeedBoostState() : getWalkBoostState();
        
        // Update progress bar
        this.boostBarFill.style.width = `${boostState.progress * 100}%`;
        
        // Update colors based on state
        if (boostState.isCharging) {
            this.boostBarFill.style.background = '#ffa500'; // Orange for charging
            this.boostText.textContent = `Speed Boost: ${(boostState.progress * 100).toFixed(0)}%`;
        } else if (boostState.active) {
            this.boostBarFill.style.background = '#00ff00'; // Green for active
            this.boostText.textContent = `SPEED BOOST! ${boostState.timeRemaining.toFixed(1)}s`;
        } else {
            this.boostBarFill.style.background = '#666'; // Gray for inactive
            this.boostText.textContent = 'Speed Boost: Ready';
        }
    }

    // ADDED: Create screen effect overlay for boost
    _createScreenEffect() {
        // Remove existing screen effect if any
        const existingEffect = document.getElementById('screen-effect');
        if (existingEffect) {
            existingEffect.remove();
        }

        this.screenEffect = document.createElement('div');
        this.screenEffect.id = 'screen-effect';
        this.screenEffect.style.position = 'fixed';
        this.screenEffect.style.top = '0';
        this.screenEffect.style.left = '0';
        this.screenEffect.style.width = '100%';
        this.screenEffect.style.height = '100%';
        this.screenEffect.style.pointerEvents = 'none';
        this.screenEffect.style.zIndex = '999';
        this.screenEffect.style.opacity = '0';
        this.screenEffect.style.transition = 'opacity 0.3s';
        this.screenEffect.style.background = 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, transparent 70%)';
        
        document.body.appendChild(this.screenEffect);
    }

    // ADDED: Update screen effects for boost
    _updateScreenEffects() {
        if (!this.screenEffect) {
            this._createScreenEffect();
        }

        const boostState = this.isFlying ? getSpeedBoostState() : getWalkBoostState();
        
        if (boostState.isCharging) {
            this.screenEffect.style.opacity = (boostState.progress * 0.3).toString();
            this.screenEffect.style.background = 'radial-gradient(circle, rgba(255,165,0,0.3) 0%, transparent 70%)';
        } else if (boostState.active) {
            this.screenEffect.style.opacity = '0.5';
            this.screenEffect.style.background = 'radial-gradient(circle, rgba(0,255,0,0.2) 0%, transparent 70%)';
        } else {
            this.screenEffect.style.opacity = '0';
        }
    }

    
    // ... REST OF YOUR EXISTING METHODS REMAIN UNCHANGED ...
   _checkWorldBounds() {
    const worldHalfSize = (25 * 50) / 2; // Based on your level size
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, -worldHalfSize, worldHalfSize);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -worldHalfSize, worldHalfSize);
    }
/*
// Optional: Add cleanup method
destroy() {
    // Clean up event listeners
    if (this.renderer && this.renderer.domElement) {
        this.renderer.domElement.removeEventListener('click', this._requestLock);
    }
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    
    // Clean up UI elements
    const elements = ['game-crosshair', 'game-score', 'speed-boost-ui', 'screen-effect', 'minimap-canvas'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.remove();
    });
}
    */
   
    _requestLock() {
        if (this.renderer && this.renderer.domElement && document.pointerLockElement !== this.renderer.domElement) {
            this.renderer.domElement.requestPointerLock();
        }
    }

    _onPointerLockChange() {
        if (document.pointerLockElement === (this.renderer && this.renderer.domElement)) {
            document.addEventListener('mousemove', this._onMouseMove);
        } else {
            document.removeEventListener('mousemove', this._onMouseMove);
        }
    }

    _setupDebugKeys() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'v' || e.key === 'V') {
                if (this.scene.userData.toggleCollectionRadius) {
                    this.scene.userData.toggleCollectionRadius();
                }
            }
            // keep your existing V-toggle for token debug if you want
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'T' || e.key === 't') {
                location.reload();  
            }
        });

        document.addEventListener('keydown', e => {
        if (e.key.toLowerCase() === 'm') {
            this.isMuted = !this.isMuted;
            if (this.isMuted && this.music) this.music.pause();
            else if (!this.isMuted && this.music) this.music.play();
            console.log('Audio', this.isMuted ? 'MUTED' : 'UNMUTED');
        }
    });
    }

    _onMouseMove(e) {
        this.yaw -= e.movementX * this.MOUSE_SENS;
        this.pitch += e.movementY * this.MOUSE_SENS;
        const PI_2 = Math.PI / 2;
        const maxPitch = PI_2 - 0.1;
        const minPitch = -maxPitch;
        this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    }

    _createCrosshair() {
        if (document.getElementById('game-crosshair')) return;
        const container = document.createElement('div');
        container.id = 'game-crosshair';
        container.style.position = 'absolute';
        container.style.left = '50%';
        container.style.top = '50%';
        container.style.transform = 'translate(-50%,-50%)';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';

        const vert = document.createElement('div');
        vert.style.width = '2px';
        vert.style.height = '20px';
        vert.style.background = 'white';
        vert.style.margin = '0 auto';

        const hor = document.createElement('div');
        hor.style.width = '20px';
        hor.style.height = '2px';
        hor.style.background = 'white';
        hor.style.position = 'relative';
        hor.style.top = '-11px';

        container.appendChild(vert);
        container.appendChild(hor);
        document.body.appendChild(container);
    }

    _createCrosshair3D() {
        const material = new THREE.SpriteMaterial({ color: 0xffffff });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.4, 0.4, 0.4);
        sprite.material.depthTest = false;
        this.crosshair3D = sprite;
        this.scene.add(this.crosshair3D);
    }

    _createScoreUI() {
        // Remove existing score UI if any
        const existingScore = document.getElementById('game-score');
        if (existingScore) {
            existingScore.remove();
        }

        // Create score display
        this.scoreElement = document.createElement('div');
        this.scoreElement.id = 'game-score';
        this.scoreElement.style.position = 'absolute';
        this.scoreElement.style.top = '20px';
        this.scoreElement.style.left = '20px';
        this.scoreElement.style.color = 'white';
        this.scoreElement.style.fontFamily = 'Arial, sans-serif';
        this.scoreElement.style.fontSize = '24px';
        this.scoreElement.style.fontWeight = 'bold';
        this.scoreElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        this.scoreElement.style.zIndex = '1000';
        this.scoreElement.innerHTML = `Items: ${this.score}/${this.totalCollectibles}`;
        
        document.body.appendChild(this.scoreElement);
    }

    _updateScoreUI() {
        if (this.scoreElement) {
            this.scoreElement.innerHTML = `Items: ${this.score}/${this.totalCollectibles}`;
        }
    }

_checkCollectibleCollisions() {
    if (!this.scene.userData.collectibles || !this.scene.userData.tokenPositions) return;

    const playerPos = this.player.position;
    const tokenPositions = this.scene.userData.tokenPositions;

    this.scene.userData.collectibles.forEach((token, idx) => {
        if (token.userData.collected) return;

        const dist = playerPos.distanceTo(token.position);
        if (dist < token.userData.collectionRadius) {
            token.userData.collected = true;
            this._playSound('collect');
            token.visible = false;                 // hide in 3-D view

            // Hide debug sphere immediately
            if (token.userData.debugSphere) {
                token.userData.debugSphere.visible = false;
                // Optional: remove from group to save memory
                if (this.scene.userData.collectionDebugGroup) {
                   this.scene.userData.collectionDebugGroup.remove(token.userData.debugSphere);
                }
                // Clean up reference
                delete token.userData.debugSphere;
            }
            // ---- UPDATE MINIMAP ----
            if (tokenPositions[idx]) {
                tokenPositions[idx].collected = true;
            }
            

            // ---- SCORE ----
            this.score++;
            const type = token.userData.type;
            this.collectedItems[type] = (this.collectedItems[type] || 0) + 1;

            // ---- UI ----
            this._updateScoreUI();

            console.log(`Collected ${type} (radius ${token.userData.collectionRadius}) – ${this.score}/${this.totalCollectibles}`);

            // ---- VICTORY CHECK ----
            if (this.score >= this.totalCollectibles) {
                this.timerRunning = false;
                this._endGame();
            }
        }
    });
}

    _showVictoryMessage() {
        const victoryElement = document.createElement('div');
        victoryElement.id = 'victory-message';
        victoryElement.style.position = 'absolute';
        victoryElement.style.top = '50%';
        victoryElement.style.left = '50%';
        victoryElement.style.transform = 'translate(-50%, -50%)';
        victoryElement.style.color = 'gold';
        victoryElement.style.fontFamily = 'Arial, sans-serif';
        victoryElement.style.fontSize = '48px';
        victoryElement.style.fontWeight = 'bold';
        victoryElement.style.textShadow = '3px 3px 6px rgba(0,0,0,0.8)';
        victoryElement.style.zIndex = '1001';
        victoryElement.style.textAlign = 'center';
        victoryElement.innerHTML = 'VICTORY!<br><span style="font-size: 24px">All items collected!</span>';
        
        document.body.appendChild(victoryElement);
        
        // Remove message after 5 seconds
        setTimeout(() => {
            if (victoryElement.parentNode) {
                victoryElement.parentNode.removeChild(victoryElement);
            }
        }, 5000);
    }



    // MINIMAP METHODS (make sure these exist too)

_initMinimap() {
    const worldSize = 25 * 50;
    const minimapSize = worldSize * 0.3;
    
    this.minimapCamera = new THREE.OrthographicCamera(
        -minimapSize / 2,
        minimapSize / 2,
        minimapSize / 2,
        -minimapSize / 2,
        1,
        500
    );
    
    this.minimapCamera.position.set(0, 100, 0);
    this.minimapCamera.lookAt(0, 0, 0);

    this.minimapRenderTarget = new THREE.WebGLRenderTarget(256, 256);
    
    const minimapSizeUI = 0.4;
    const minimapGeometry = new THREE.PlaneGeometry(minimapSizeUI, minimapSizeUI);
    const minimapMaterial = new THREE.MeshBasicMaterial({
        map: this.minimapRenderTarget.texture,
        transparent: true,
        opacity: 0.9
    });
    
    this.minimapMesh = new THREE.Mesh(minimapGeometry, minimapMaterial);
    this.minimapMesh.position.set(0.8, 0.8, -1);
    this.uiScene.add(this.minimapMesh);
    
    // Create a canvas overlay for tokens
    this._createMinimapTokenOverlay();
    
}

_createMinimapTokenOverlay() {
    // Remove existing canvas if any
    const existingCanvas = document.getElementById('minimap-canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    // Create a canvas element for drawing the minimap
    this.minimapTokenCanvas = document.createElement('canvas');
    this.minimapTokenCanvas.id = 'minimap-canvas';
    this.minimapTokenCanvas.width = 150;
    this.minimapTokenCanvas.height = 150;
    this.minimapTokenCanvas.style.position = 'absolute';
    this.minimapTokenCanvas.style.top = '20px';
    this.minimapTokenCanvas.style.right = '20px';
    this.minimapTokenCanvas.style.pointerEvents = 'none';
    this.minimapTokenCanvas.style.zIndex = '1001';
    this.minimapTokenCanvas.style.borderRadius = '50%'; // Make it circular
    this.minimapTokenCanvas.style.border = '3px solid #2a2a2a';
    this.minimapTokenCanvas.style.boxShadow = '0 0 15px rgba(0,0,0,0.7)';
    this.minimapTokenCanvas.style.backgroundColor = 'rgba(40, 40, 60, 0.9)'; // Dark blue-gray background
    
    this.minimapTokenCtx = this.minimapTokenCanvas.getContext('2d');
    
    document.body.appendChild(this.minimapTokenCanvas);
}

_drawTokensOnMinimap() {
    if (!this.scene.userData.tokenPositions || !this.minimapTokenCtx) return;
    
    const ctx = this.minimapTokenCtx;
    const canvas = this.minimapTokenCanvas;
    
    // Clear canvas with background color
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(40, 40, 60, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    
    // Create circular clipping area
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 4, 0, Math.PI * 2);
    ctx.clip();
    
    // Draw a subtle radial gradient for better visibility
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(60, 60, 80, 0.8)');
    gradient.addColorStop(1, 'rgba(30, 30, 50, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const viewRadius = 300; // Radius around player to show (in world units)
    const scale = (canvas.width / 2 - 10) / viewRadius; // Leave some margin
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Draw distance rings (subtle guides)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    
    // Draw rings at 33% and 66% of view radius
    for (let i = 1; i <= 2; i++) {
        const ringRadius = (canvas.width / 2 - 10) * (i * 0.33);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Draw each token
    this.scene.userData.tokenPositions.forEach(token => {
        if (!token.collected) {
            // Convert world coordinates to minimap canvas coordinates
            const tokenX = centerX + (token.x - this.player.position.x) * scale;
            const tokenZ = centerY + (token.z - this.player.position.z) * scale;
            
            // Check if token is within circular view
            const distanceFromCenter = Math.sqrt(
                Math.pow(tokenX - centerX, 2) + Math.pow(tokenZ - centerY, 2)
            );
            
            if (distanceFromCenter <= canvas.width / 2 - 8) {
                // Draw token as colored dot with glow
                ctx.fillStyle = '#' + token.color.toString(16).padStart(6, '0');
                ctx.beginPath();
                ctx.arc(tokenX, tokenZ, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Add a white border for visibility
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                
                // Add subtle glow effect
                ctx.shadowColor = '#' + token.color.toString(16).padStart(6, '0');
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    });
    
    // Draw player position (red dot in center)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Add white border to player dot
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw player direction (red arrow)
    const playerDirection = new THREE.Vector3();
    this.camera.getWorldDirection(playerDirection);
    const arrowLength = 20;
    const arrowX = centerX + playerDirection.x * arrowLength;
    const arrowZ = centerY + playerDirection.z * arrowLength;
    
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(arrowX, arrowZ);
    ctx.stroke();
    
    // Draw arrow head
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowZ);
    ctx.lineTo(arrowX - playerDirection.x * 4 + playerDirection.z * 3, arrowZ - playerDirection.z * 4 - playerDirection.x * 3);
    ctx.lineTo(arrowX - playerDirection.x * 4 - playerDirection.z * 3, arrowZ - playerDirection.z * 4 + playerDirection.x * 3);
    ctx.closePath();
    ctx.fill();
    
    // Remove clipping and draw circular border
    ctx.restore();
    
    // Draw outer border
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(centerX, centerY, canvas.width / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw inner border
    ctx.strokeStyle = '#555577';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, canvas.width / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw cardinal direction indicators (N, E, S, W)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // North
    ctx.fillText('N', centerX, 15);
    // East
    ctx.fillText('E', canvas.width - 15, centerY);
    // South
    ctx.fillText('S', centerX, canvas.height - 15);
    // West
    ctx.fillText('W', 15, centerY);
}

   

_updateMinimap() {

    // Draw tokens on minimap overlay
    this._drawTokensOnMinimap();
}

    // Add this new method to create and update token indicators
    

_updateCamera() {
    const distance = 6;  // Distance behind player
    const height = 2.5;  // Height above player

    // Calculate camera position behind the player
    const camOffset = new THREE.Vector3(0, 0, -distance)
        .applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    this.camera.position.copy(this.player.position).add(camOffset);
    this.camera.position.y += height;
    
    // Make camera look at a point slightly ahead of the player
    const lookAtPoint = this.player.position.clone();
    const lookOffset = new THREE.Vector3(0, 0, 3) 
        .applyEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ'));
    lookAtPoint.add(lookOffset);
    lookAtPoint.y += 1; // Look at player's head level
    
    this.camera.lookAt(lookAtPoint);
}


    loop = () =>{
        this._updateTimer();
        requestAnimationFrame(this.loop);

        const now = performance.now();
        const delta = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Check for collectible collisions
        this._checkCollectibleCollisions();

        // Animate collectibles (gentle floating rotation)
        if (this.scene.userData.collectibles) {
            this.scene.userData.collectibles.forEach(collectible => {
                if (!collectible.userData.collected) {
                    collectible.rotation.y += delta * 0.5;
                    collectible.position.y = 0.5 + Math.sin(now * 0.001) * 0.1;
                }
            });
        }

        // Toggle flying on key-down edge only
        if (input.flyToggle && !this.prevFlyToggle) {
            this.isFlying = !this.isFlying;
            if (this.isFlying) {
                this.flyState.isAscendingToFly = true;
                this.flyState.targetFlyHeight = this.player.position.y + 10;
            }
        }
        this.prevFlyToggle = input.flyToggle;

        if (this.isFlying) {
            const landed = updateFlying(this.player, this.camera, this.scene, delta, this.flyState);
            if (landed) {
                this.isFlying = false;
                this.flyState.isAscendingToFly = false;
            }
        } else {
            updateWalking(this.player, this.camera, this.scene, delta);
        }

        if (!this.isFlying) {
            // Make arrow face movement direction when walking
            if (input.forward !== 0 || input.right !== 0) {
                // Get camera forward and right vectors
                const cameraForward = new THREE.Vector3();
                this.camera.getWorldDirection(cameraForward);
                cameraForward.normalize();
                
                const cameraRight = new THREE.Vector3();
                cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraForward).normalize();
                
                // Calculate movement direction relative to camera (include vertical component)
                const moveDirection = new THREE.Vector3();
                moveDirection.addScaledVector(cameraForward, input.forward);
                moveDirection.addScaledVector(cameraRight, -input.right);
                moveDirection.normalize();
                
                // Calculate rotation angles for both yaw and pitch
                const yaw = Math.atan2(moveDirection.x, moveDirection.z);
                const pitch = -Math.asin(moveDirection.y); // Negative because Three.js pitch is inverted
                
                
                // Apply both rotations to the arrow
                this.player.rotation.y = yaw;
                this.player.rotation.x = pitch;
            }
        } else {
            // Make arrow face camera direction when flying (include pitch)
            const camDirection = new THREE.Vector3();
            this.camera.getWorldDirection(camDirection);
            camDirection.normalize();
            
            const yaw = Math.atan2(camDirection.x, camDirection.z);
            const pitch = -Math.asin(camDirection.y); // Negative because Three.js pitch is inverted
            
            this.player.rotation.y = yaw;
            this.player.rotation.x = pitch;
        }

        // Update main camera
        this._updateCamera();

        // Update minimap
        this._updateMinimap();

        // ADDED: Update speed boost UI
        this._updateSpeedBoostUI();
        this._updateScreenEffects();

        // Position 3D crosshair
        if (this.crosshair3D) {
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            dir.normalize();
            const distance = 5.0;
            const targetPos = this.player.position.clone().add(dir.multiplyScalar(distance));
            targetPos.y = this.player.position.y + 0.6;
            this.crosshair3D.position.copy(targetPos);
            this.crosshair3D.lookAt(this.camera.position);
        }

        // Update procedural player animation (if provided)
        try {
            if (typeof updatePlayer === 'function') {
                updatePlayer(this.player, now * 0.001, { isFlying: this.isFlying });
            }
        } catch (e) {
            // don't break the game loop if update fails
            console.warn('updatePlayer failed:', e);
        }

            if (input.flyToggle && !this.prevFlyToggle) {
            this._playSound('fly', 0.8);
        }
    
    
        // Speed-boost activation sound
            const boostState = this.isFlying ? getSpeedBoostState() : getWalkBoostState();
            if (boostState.active && !this._lastBoostActive) {
                this._playSound('boost');
            }
            this._lastBoostActive = boostState.active;

            // Pause toggle sound
            if (this.isPaused && !this._wasPaused) {
                this._playSound('pause');
            }
            this._wasPaused = this.isPaused;
            
        // Render main scene
        this.renderer.render(this.scene, this.camera);
        
        // Render UI scene on top (with autoClear disabled to preserve main scene)
        this.renderer.autoClear = false;
        this.renderer.render(this.uiScene, this.uiCamera);
        this.renderer.autoClear = true;
    }
}