import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------- Scene / Camera / Renderer ----------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// ---------- CSS2D Renderer for text labels ----------
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Player ----------
const PLAYER_SIZE = { x: 1, y: 1, z: 1 };
const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE.x, PLAYER_SIZE.y, PLAYER_SIZE.z);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = PLAYER_SIZE.y / 2; // sit on ground
scene.add(player);

// ---------- Ground ----------
const groundGeom = new THREE.PlaneGeometry(80, 80);
const groundMat = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide });
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

// ---------- Arcade placeholders ----------
const arcades = [];
const arcadeLabels = [];
const arcadeColors = [0xff0000, 0x0000ff, 0xffff00];
const arcadeNames = ["Level 1", "Level 2", "Level 3"];
const arcadeColorNames = ["Red", "Blue", "Yellow"];

for (let i = 0; i < 3; i++) {
  const g = new THREE.BoxGeometry(1, 2, 1); // taller machine
  const m = new THREE.MeshBasicMaterial({ color: arcadeColors[i] });
  const arcade = new THREE.Mesh(g, m);
  arcade.position.set(i * 3 - 3, 1, -10); // spread in front
  arcade.userData.level = i + 1; // Store level number
  arcade.userData.colorName = arcadeColorNames[i]; // Store color name
  scene.add(arcade);
  arcades.push(arcade);

  // Create text label
  const textDiv = document.createElement('div');
  textDiv.className = 'arcade-label';
  textDiv.textContent = arcadeNames[i];
  textDiv.style.color = 'white';
  textDiv.style.fontFamily = 'Arial, sans-serif';
  textDiv.style.fontSize = '16px';
  textDiv.style.fontWeight = 'bold';
  textDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
  textDiv.style.pointerEvents = 'none';
  textDiv.style.textAlign = 'center';
  textDiv.style.whiteSpace = 'nowrap';
  
  const label = new CSS2DObject(textDiv);
  label.position.set(0, 1.5, 0); // Position above the arcade
  arcade.add(label);
  arcadeLabels.push(label);
}

// Precompute arcade boxes (they're static)
const arcadeBoxes = arcades.map(a => new THREE.Box3().setFromObject(a));

// ---------- Interaction System ----------
const INTERACTION_DISTANCE = 3; // How close player needs to be
let currentInteractable = null;
let interactionCooldown = false;

// Create interaction prompt element
const interactionPrompt = document.createElement("div");
interactionPrompt.style.position = "absolute";
interactionPrompt.style.top = "60%";
interactionPrompt.style.left = "50%";
interactionPrompt.style.transform = "translate(-50%, -50%)";
interactionPrompt.style.color = "white";
interactionPrompt.style.fontFamily = "Arial, sans-serif";
interactionPrompt.style.fontSize = "20px";
interactionPrompt.style.fontWeight = "bold";
interactionPrompt.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
interactionPrompt.style.pointerEvents = "none";
interactionPrompt.style.zIndex = "10";
interactionPrompt.style.textAlign = "center";
interactionPrompt.style.opacity = "0";
interactionPrompt.style.transition = "opacity 0.3s ease";
interactionPrompt.textContent = "E to interact";
document.body.appendChild(interactionPrompt);

// ---------- Crosshair ----------
const crosshair = document.createElement("div");
crosshair.style.position = "absolute";
crosshair.style.top = "50%";
crosshair.style.left = "50%";
crosshair.style.width = "20px";
crosshair.style.height = "20px";
crosshair.style.marginLeft = "-10px";
crosshair.style.marginTop = "-10px";
crosshair.style.pointerEvents = "none";
crosshair.style.zIndex = "10";
crosshair.innerHTML = `
  <div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:white"></div>
  <div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:white"></div>
`;
document.body.appendChild(crosshair);

// ---------- Input ----------
const keys = {}; // letter/arrow keys tracked by name
let spaceHeld = false;
let spaceLocked = false; // prevents auto-repeat while holding space
let eKeyPressed = false;
let eKeyLocked = false; // prevents auto-repeat while holding E

window.addEventListener("keydown", (e) => {
  // prefer e.code for space to be robust
  if (e.code === "Space") {
    spaceHeld = true;
  } else if (e.code === "KeyE") {
    eKeyPressed = true;
  } else {
    keys[e.key.toLowerCase()] = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceHeld = false;
    spaceLocked = false;
  } else if (e.code === "KeyE") {
    eKeyPressed = false;
    eKeyLocked = false;
  } else {
    keys[e.key.toLowerCase()] = false;
  }
});

// ---------- Pointer lock / Mouse look ----------
let yaw = 0;   // horizontal rotation (radians)
let pitch = 0; // vertical rotation (radians)
const PI_2 = Math.PI / 2;
const MOUSE_SENS = 0.0025;

document.body.addEventListener("click", () => {
  // request pointer lock on click so mouse look works
  document.body.requestPointerLock?.();
});

function onPointerLockChange() {
  if (document.pointerLockElement === document.body) {
    document.addEventListener("mousemove", onMouseMove);
  } else {
    document.removeEventListener("mousemove", onMouseMove);
  }
}
document.addEventListener("pointerlockchange", onPointerLockChange);

function onMouseMove(e) {
  yaw -= e.movementX * MOUSE_SENS;
  pitch += e.movementY * MOUSE_SENS;
  // clamp pitch so camera doesn't flip
  const maxPitch = PI_2 - 0.1;
  const minPitch = -maxPitch;
  pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
}

// ---------- Physics / Movement parameters ----------
const speed = 0.15; // horizontal move speed (units per frame)
const gravity = -0.03; // gravity acceleration per frame
const jumpStrength = 0.45; // initial upward velocity when jumping
let velocityY = 0;
const groundY = 0;
const playerHalfHeight = PLAYER_SIZE.y / 2;

// Camera follow parameters
const cameraDistance = 8;
const cameraHeightOffset = 1.8; // camera slightly above player center

// small vector scratch objects to avoid allocations every frame
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _prevPos = new THREE.Vector3();
const playerBox = new THREE.Box3();

// Raycasting for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // center of screen

// ---------- Utility collision test ----------
function intersectsAnyPlayerBox(box) {
  for (let b of arcadeBoxes) {
    if (box.intersectsBox(b)) return true;
  }
  return false;
}

// ---------- Interaction Functions ----------
function checkInteractions() {
  // Set raycaster from camera center (crosshair position)
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(arcades);
  
  if (intersects.length > 0) {
    const closestArcade = intersects[0].object;
    const distance = player.position.distanceTo(closestArcade.position);
    
    if (distance <= INTERACTION_DISTANCE) {
      // Show interaction prompt
      interactionPrompt.textContent = `E to interact with ${closestArcade.userData.colorName} machine`;
      interactionPrompt.style.opacity = "1";
      currentInteractable = closestArcade;
      return;
    }
  }
  
  // No valid interactable found
  interactionPrompt.style.opacity = "0";
  currentInteractable = null;
}

function handleInteraction() {
  if (currentInteractable && eKeyPressed && !eKeyLocked && !interactionCooldown) {
    eKeyLocked = true;
    interactionCooldown = true;
    
    const level = currentInteractable.userData.level;
    const colorName = currentInteractable.userData.colorName;
    
    console.log(`Starting Level ${level} on ${colorName} machine!`);
    
    // Here you would typically load the level
    // For now, we'll just show an alert and reset after a moment
    alert(`Loading Level ${level} - ${colorName} Machine!`);
    
    // Reset cooldown after a short delay
    setTimeout(() => {
      interactionCooldown = false;
    }, 1000);
    
    // You can replace the alert with actual level loading code:
    // loadLevel(level);
  }
}

// Level loading function (placeholder - implement your level loading here)
function loadLevel(levelNumber) {
  switch(levelNumber) {
    case 1:
      // Load level 1 content
      console.log("Loading Level 1...");
      break;
    case 2:
      // Load level 2 content
      console.log("Loading Level 2...");
      break;
    case 3:
      // Load level 3 content
      console.log("Loading Level 3...");
      break;
  }
}

// ---------- Animation loop ----------
function animate() {
  // --- Calculate camera-relative forward/right (movement relative to crosshair) ---
  // Forward based on yaw (horizontal), ignore pitch so movement stays horizontal
  _forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  _right.crossVectors(_forward, new THREE.Vector3(0, 1, 0)).normalize();

  // Build move direction from inputs
  _moveDir.set(0, 0, 0);
  if (keys["w"] || keys["arrowup"]) _moveDir.add(_forward);
  if (keys["s"] || keys["arrowdown"]) _moveDir.sub(_forward);
  if (keys["d"] || keys["arrowright"]) _moveDir.add(_right);
  if (keys["a"] || keys["arrowleft"]) _moveDir.sub(_right);

  if (_moveDir.lengthSq() > 0) _moveDir.normalize();

  // Save previous position for collision reasoning
  _prevPos.copy(player.position);

  // --- Horizontal movement per-axis with collision rollback (solid collision + sliding) ---
  _desired.copy(_moveDir).multiplyScalar(speed);

  // X (world) movement
  player.position.x += _desired.x;
  // recompute player's AABB and test
  playerBox.setFromObject(player);
  if (intersectsAnyPlayerBox(playerBox)) {
    // rollback X movement
    player.position.x = _prevPos.x;
  } else {
    _prevPos.x = player.position.x; // commit X
  }

  // Z (world) movement
  player.position.z += _desired.z;
  playerBox.setFromObject(player);
  if (intersectsAnyPlayerBox(playerBox)) {
    // rollback Z movement
    player.position.z = _prevPos.z;
  } else {
    _prevPos.z = player.position.z; // commit Z
  }

  // --- Vertical (gravity + jumping) ---
  // Determine grounded status by checking if player's bottom is at ground or on top of an arcade
  // Apply gravity
  velocityY += gravity;
  player.position.y += velocityY;

  // Recompute player box and resolve vertical collisions
  playerBox.setFromObject(player);
  let grounded = false;

  // Ground collision
  if (player.position.y < groundY + playerHalfHeight) {
    player.position.y = groundY + playerHalfHeight;
    velocityY = 0;
    grounded = true;
  }

  // Arcade vertical collisions
  for (let i = 0; i < arcadeBoxes.length; i++) {
    const box = arcadeBoxes[i];
    if (playerBox.intersectsBox(box)) {
      // If player came from above onto the arcade top
      if (_prevPos.y >= box.max.y + playerHalfHeight - 0.01) {
        player.position.y = box.max.y + playerHalfHeight;
        velocityY = 0;
        grounded = true;
        playerBox.setFromObject(player);
      }
      // If player hit bottom side of arcade while moving up (head hit)
      else if (_prevPos.y + playerHalfHeight <= box.min.y + 0.01 && velocityY > 0) {
        player.position.y = box.min.y - playerHalfHeight;
        velocityY = 0;
        playerBox.setFromObject(player);
      }
      // Otherwise we overlapped horizontally (player moved into the arcade from side),
      // rollback horizontal movement so the player can't enter the arcade.
      else {
        player.position.x = _prevPos.x;
        player.position.z = _prevPos.z;
        playerBox.setFromObject(player);
      }
    }
  }

  // --- Jump: only if grounded. Use a "lock" so holding space doesn't spam jumps ---
  if (spaceHeld && grounded && !spaceLocked) {
    velocityY = jumpStrength;
    spaceLocked = true; // must release space to jump again
    grounded = false;
  }
  

  // Camera follow using yaw/pitch (mouse look)
  const cosPitch = Math.cos(pitch);

  // Position camera behind player
  camera.position.x = player.position.x - Math.sin(yaw) * cameraDistance * cosPitch;
  camera.position.z = player.position.z - Math.cos(yaw) * cameraDistance * cosPitch;
  camera.position.y = player.position.y + Math.sin(pitch) * cameraDistance + cameraHeightOffset;

  // Instead of looking exactly at player center, look slightly above
  const aimHeightOffset = 1.5; // 👈 increase this for higher crosshair aim
  camera.lookAt(
    player.position.x,
    player.position.y + aimHeightOffset,
    player.position.z
  );

  // --- Check for interactions ---
  checkInteractions();
  handleInteraction();

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}