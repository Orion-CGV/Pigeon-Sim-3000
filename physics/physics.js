// physics.js
import * as THREE from 'three';

export class PhysicsWorld {
  constructor(gravity = new THREE.Vector3(0, -9.81, 0)) {
    this.gravity = gravity; // Gravity vector (m/s^2)
    this.bodies = [];
  }

  addBody(body) {
    this.bodies.push(body);
  }

  step(deltaTime) {
    for (const body of this.bodies) {
      if (body.isStatic) continue;

      // Apply gravity as a force (F = m * g)
      const gravityForce = this.gravity.clone().multiplyScalar(body.mass);
      body.applyForce(gravityForce);

      // Integrate acceleration -> velocity
      body.velocity.addScaledVector(body.acceleration, deltaTime);

      // Integrate velocity -> position
      body.position.addScaledVector(body.velocity, deltaTime);

      // Simple ground collision at y = 0
      if (body.position.y - body.radius < 0) {
        body.position.y = body.radius;
        body.velocity.y *= -body.restitution; // bounce
      }

      // Reset acceleration after each step
      body.acceleration.set(0, 0, 0);
    }
  }
}

// -------------------------------------------------------

export class PhysicsBody {
  constructor({
    position = new THREE.Vector3(),
    velocity = new THREE.Vector3(),
    acceleration = new THREE.Vector3(),
    mass = 1,
    radius = 1,
    restitution = 0.5,
    isStatic = false,
  } = {}) {
    this.position = position.clone();
    this.velocity = velocity.clone();
    this.acceleration = acceleration.clone();
    this.mass = mass;
    this.radius = radius;
    this.restitution = restitution; // bounciness
    this.isStatic = isStatic;
  }

  // Apply a force to this body (F = m * a → a = F / m)
  applyForce(force) {
    const addedAcceleration = force.clone().divideScalar(this.mass);
    this.acceleration.add(addedAcceleration);
  }
}
