import * as THREE from 'three';

/**
 * Very small utility providing a ground collider for flat horizontal ground meshes.
 * This is intentionally simple: it assumes the provided mesh is a horizontal plane
 * (or at least a flat surface) so height is constant and given by mesh.position.y.
 *
 * The returned object exposes getHeightAt(x,z) and isBelow(x,z,y) helpers.
 */
export function createGroundCollider(groundMesh) {
  // Derive ground Y from mesh position. If the mesh is offset vertically this works.
  const groundY = groundMesh.position.y;

  return {
    /**
     * Return the ground height at the provided x,z coordinates.
     * For a flat ground this is constant.
     */
    getHeightAt(x, z) {
      return groundY;
    },

    /**
     * Returns true if the provided y coordinate is at or below the ground surface
     * (with an optional epsilon tolerance).
     */
    isBelow(x, z, y, epsilon = 0.001) {
      return y <= groundY + epsilon;
    },

    // Expose the raw mesh for any advanced queries
    mesh: groundMesh
  };
}