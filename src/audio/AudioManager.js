// Audio Manager System - Centralized audio management for the game
/**
 * AudioManager - Manages all audio playback (music and sound effects)
 * Provides a unified interface for playing sounds with volume and settings integration
 */
export class AudioManager {
    constructor() {
        // Music tracks storage
        this.musicTracks = {};
        
        // Sound effects storage
        this.soundEffects = {};
        
        // Current playing music track
        this.currentMusicTrack = null;
        this.currentMusicId = null;
        
        // Settings integration
        this.settingsMenu = null;
        
        // Volume defaults
        this.defaultMusicVolume = 0.5;
        this.defaultSoundEffectVolume = 0.5;
        
        // User interaction handler (for autoplay policy)
        this.userInteractionHandlerAdded = false;
    }
    
    /**
     * Initializes the audio manager
     * @param {SettingsMenu} settingsMenu - Settings menu instance for volume control
     */
    init(settingsMenu = null) {
        this.settingsMenu = settingsMenu || window.settingsMenu;
        
        // Register callbacks for volume changes if settings menu exists
        if (this.settingsMenu) {
            // Music volume callback
            const originalMusicCallback = this.settingsMenu.onMusicVolumeChange;
            this.settingsMenu.setOnMusicVolumeChange((volume) => {
                // Update all music tracks
                this.setMusicVolume(volume / 100);
                // Call original callback if exists
                if (originalMusicCallback) {
                    originalMusicCallback(volume);
                }
            });
            
            // Master volume callback
            this.settingsMenu.setOnVolumeChange((volume) => {
                // Master volume affects both music and sound effects
                this.updateAllVolumes();
            });
        }
    }
    
    /**
     * Registers a music track
     * @param {string} id - Unique identifier for the music track
     * @param {string} filePath - Path to the audio file
     * @param {boolean} loop - Whether to loop the music (default: true)
     * @param {boolean} mono - Whether to play in mono (same in both ears, default: false)
     */
    registerMusic(id, filePath, loop = true, mono = false) {
        if (this.musicTracks[id]) {
            console.warn(`Music track ${id} already registered`);
            return;
        }
        
        const audio = new Audio(filePath);
        audio.loop = loop;
        audio.volume = this.defaultMusicVolume;
        
        // Add error handler
        audio.addEventListener('error', (e) => {
            console.warn(`Music track ${id} error:`, e);
        });
        
        // Set up Web Audio API for mono playback if requested
        let audioContext = null;
        let source = null;
        let isConnected = false;
        
        if (mono) {
            try {
                // Create audio context if not exists (or resume if suspended)
                if (!window.audioContext) {
                    window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                audioContext = window.audioContext;
                
                // Resume audio context if suspended (required by some browsers)
                if (audioContext.state === 'suspended') {
                    audioContext.resume().catch(err => {
                        console.warn(`Could not resume audio context for ${id}:`, err);
                    });
                }
                
                // Set up mono mixing when audio starts playing
                audio.addEventListener('play', () => {
                    if (!isConnected && audioContext) {
                        try {
                            // Create media element source (disconnects from default output)
                            source = audioContext.createMediaElementSource(audio);
                            
                            // Create a channel splitter to separate left and right channels
                            const splitter = audioContext.createChannelSplitter(2);
                            source.connect(splitter);
                            
                            // Create gain nodes to mix channels (with equal weight)
                            const leftGain = audioContext.createGain();
                            const rightGain = audioContext.createGain();
                            leftGain.gain.value = 0.5; // Mix at 50% volume each
                            rightGain.gain.value = 0.5;
                            
                            // Create merger to combine into mono (1 output channel)
                            const merger = audioContext.createChannelMerger(1);
                            
                            // Connect: left channel -> left gain -> merger, right channel -> right gain -> merger
                            splitter.connect(leftGain, 0); // Left channel (index 0)
                            splitter.connect(rightGain, 1); // Right channel (index 1)
                            leftGain.connect(merger, 0, 0);
                            rightGain.connect(merger, 0, 0); // Both connect to output channel 0
                            
                            // Connect to destination
                            merger.connect(audioContext.destination);
                            
                            isConnected = true;
                        } catch (err) {
                            console.warn(`Could not set up mono playback for ${id}:`, err);
                            // Fallback: audio will play in stereo
                        }
                    }
                }, { once: true });
            } catch (err) {
                console.warn(`Could not set up mono playback for ${id}:`, err);
                // Fallback: audio will play in stereo
            }
        }
        
        this.musicTracks[id] = {
            audio: audio,
            id: id,
            filePath: filePath,
            loop: loop,
            mono: mono,
            audioContext: audioContext,
            source: source
        };
        
        console.log(`✅ Registered music track: ${id}${mono ? ' (mono)' : ''}`);
    }
    
    /**
     * Registers a sound effect
     * @param {string} id - Unique identifier for the sound effect
     * @param {string} filePath - Path to the audio file
     * @param {number} volume - Volume level (0.0 to 1.0, default: 0.5)
     */
    registerSoundEffect(id, filePath, volume = 0.5) {
        if (this.soundEffects[id]) {
            console.warn(`Sound effect ${id} already registered`);
            return;
        }
        
        const audio = new Audio(filePath);
        audio.volume = volume;
        
        // Add error handler
        audio.addEventListener('error', (e) => {
            console.warn(`Sound effect ${id} error:`, e);
        });
        
        this.soundEffects[id] = {
            audio: audio,
            id: id,
            filePath: filePath,
            defaultVolume: volume
        };
        
        console.log(`✅ Registered sound effect: ${id}`);
    }
    
    /**
     * Plays a music track (stops current music if playing)
     * @param {string} id - Music track identifier
     * @param {boolean} forceRestart - Force restart even if already playing
     */
    playMusic(id, forceRestart = false) {
        const track = this.musicTracks[id];
        if (!track) {
            console.warn(`Music track ${id} not registered`);
            return;
        }
        
        // Stop current music if different track
        if (this.currentMusicId !== id || forceRestart) {
            this.stopMusic();
        }
        
        // If already playing the same track, don't restart
        if (this.currentMusicId === id && !track.audio.paused) {
            return;
        }
        
        this.currentMusicId = id;
        this.currentMusicTrack = track;
        
        // Update volume from settings
        this.updateMusicVolume(id);
        
        // Play the music
        const playPromise = track.audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn(`Could not play music ${id} automatically:`, err);
                this.handleAutoplayBlocked(track.audio, id);
            });
        }
    }
    
    /**
     * Stops the currently playing music
     * @param {string} id - Optional: specific track to stop (stops all if not specified)
     */
    stopMusic(id = null) {
        if (id) {
            // Stop specific track
            const track = this.musicTracks[id];
            if (track && track.audio) {
                track.audio.pause();
                track.audio.currentTime = 0;
            }
            if (this.currentMusicId === id) {
                this.currentMusicId = null;
                this.currentMusicTrack = null;
            }
        } else {
            // Stop all music
            Object.values(this.musicTracks).forEach(track => {
                if (track.audio) {
                    track.audio.pause();
                    track.audio.currentTime = 0;
                }
            });
            this.currentMusicId = null;
            this.currentMusicTrack = null;
        }
    }
    
    /**
     * Plays a sound effect
     * @param {string} id - Sound effect identifier
     * @param {object} options - Optional: { volume: number, resetTime: boolean, loop: boolean }
     */
    playSoundEffect(id, options = {}) {
        const sound = this.soundEffects[id];
        if (!sound) {
            console.warn(`Sound effect ${id} not registered`);
            return;
        }
        
        // Check if sound effects are enabled
        if (this.settingsMenu) {
            const settings = this.settingsMenu.getSettings();
            if (settings.soundEffects === false) {
                return; // Sound effects disabled
            }
        }
        
        // Update volume from settings or use provided volume
        if (options.volume !== undefined) {
            sound.audio.volume = options.volume;
        } else {
            this.updateSoundEffectVolume(id);
        }
        
        // Set loop if specified
        if (options.loop !== undefined) {
            sound.audio.loop = options.loop;
        }
        
        // Reset and play
        if (options.resetTime !== false) {
            sound.audio.currentTime = 0;
        }
        
        sound.audio.play().catch(err => {
            console.warn(`Could not play sound effect ${id}:`, err);
        });
    }
    
    /**
     * Stops a sound effect
     * @param {string} id - Sound effect identifier
     */
    stopSoundEffect(id) {
        const sound = this.soundEffects[id];
        if (sound && sound.audio) {
            sound.audio.pause();
            sound.audio.currentTime = 0;
            sound.audio.loop = false;
        }
    }
    
    /**
     * Sets music volume (0.0 to 1.0) - affects all music tracks
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setMusicVolume(volume) {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        Object.values(this.musicTracks).forEach(track => {
            if (track.audio) {
                track.audio.volume = clampedVolume;
            }
        });
    }
    
    /**
     * Updates music volume from settings for a specific track
     * @param {string} id - Music track identifier
     */
    updateMusicVolume(id) {
        const track = this.musicTracks[id];
        if (!track || !this.settingsMenu) return;
        
        const settings = this.settingsMenu.getSettings();
        if (settings.musicVolume !== undefined) {
            track.audio.volume = settings.musicVolume / 100;
        } else if (settings.masterVolume !== undefined) {
            track.audio.volume = settings.masterVolume / 100;
        } else {
            track.audio.volume = this.defaultMusicVolume;
        }
    }
    
    /**
     * Updates sound effect volume from settings for a specific sound
     * @param {string} id - Sound effect identifier
     */
    updateSoundEffectVolume(id) {
        const sound = this.soundEffects[id];
        if (!sound || !this.settingsMenu) {
            return;
        }
        
        const settings = this.settingsMenu.getSettings();
        let baseVolume = sound.defaultVolume;
        
        // Apply master volume scaling if available
        if (settings.masterVolume !== undefined) {
            baseVolume = (settings.masterVolume / 100) * sound.defaultVolume;
        }
        
        sound.audio.volume = baseVolume;
    }
    
    /**
     * Updates all volumes from settings
     */
    updateAllVolumes() {
        // Update all music volumes
        Object.keys(this.musicTracks).forEach(id => {
            this.updateMusicVolume(id);
        });
        
        // Update all sound effect volumes
        Object.keys(this.soundEffects).forEach(id => {
            this.updateSoundEffectVolume(id);
        });
    }
    
    /**
     * Handles autoplay policy blocked audio
     * @param {HTMLAudioElement} audio - Audio element to play
     * @param {string} id - Identifier for logging
     */
    handleAutoplayBlocked(audio, id) {
        if (!this.userInteractionHandlerAdded) {
            const startOnInteraction = () => {
                audio.play().catch(() => {
                    // Ignore errors on retry
                });
                this.userInteractionHandlerAdded = false;
            };
            
            // Use { once: true } so listeners automatically remove themselves
            document.addEventListener('click', startOnInteraction, { once: true });
            document.addEventListener('keydown', startOnInteraction, { once: true });
            document.addEventListener('mousemove', startOnInteraction, { once: true });
            this.userInteractionHandlerAdded = true;
        }
    }
    
    /**
     * Gets the currently playing music track ID
     * @returns {string|null} Current music track ID
     */
    getCurrentMusic() {
        return this.currentMusicId;
    }
    
    /**
     * Checks if a music track is currently playing
     * @param {string} id - Music track identifier
     * @returns {boolean} True if playing
     */
    isMusicPlaying(id) {
        const track = this.musicTracks[id];
        return track && !track.audio.paused && this.currentMusicId === id;
    }
    
    /**
     * Cleans up the audio manager
     */
    cleanup() {
        // Stop all music
        this.stopMusic();
        
        // Clear all tracks
        this.musicTracks = {};
        this.soundEffects = {};
        this.currentMusicTrack = null;
        this.currentMusicId = null;
        this.userInteractionHandlerAdded = false;
    }
}

