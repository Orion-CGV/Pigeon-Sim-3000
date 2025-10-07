// physics.js

export class PhysicsWorld {
  constructor(gravity = new THREE.Vector3(0, -9.81, 0)) {
    this.gravity = gravity;
    this.bodies = [];
  }

  addBody(body) {
    this.bodies.push(body);
  }

  step(deltaTime) {
    for (const body of this.bodies) {
      if (body.isStatic) continue;

      // Apply gravity
      body.velocity.addScaledVector(this.gravity, deltaTime);

      // Update position
      body.position.addScaledVector(body.velocity, deltaTime);

      // Simple ground collision at y = 0
      if (body.position.y - body.radius < 0) {
        body.position.y = body.radius;
        body.velocity.y *= -body.restitution; // bounce
      }
    }
  }
}

// -------------------------------------------------------

export class PhysicsBody {
  constructor({ position = new THREE.Vector3(), velocity = new THREE.Vector3(), mass = 1, radius = 1, restitution = 0.5, isStatic = false } = {}) {
    this.position = position.clone();
    this.velocity = velocity.clone();
    this.mass = mass;
    this.radius = radius;
    this.restitution = restitution; // bounciness
    this.isStatic = isStatic;
  }
}
