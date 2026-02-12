/**
 * Geometry utility functions for inverse kinematics and angle manipulation
 * Migrated from Processing Util.pde
 * @module utils/geometry
 */

/**
 * Constrains a vector to be at a certain distance from an anchor point
 * @param {p5.Vector} pos - The position to constrain
 * @param {p5.Vector} anchor - The anchor point
 * @param {number} constraint - The desired distance
 * @returns {p5.Vector} The constrained position
 */
export function constrainDistance(pos, anchor, constraint) {
  return p5.Vector.add(anchor, p5.Vector.sub(pos, anchor).setMag(constraint));
}

/**
 * Constrains an angle to be within a certain range of an anchor angle
 * @param {number} angle - The angle to constrain (in radians)
 * @param {number} anchor - The anchor angle (in radians)
 * @param {number} constraint - The maximum allowed difference (in radians)
 * @returns {number} The constrained angle (in radians)
 */
export function constrainAngle(angle, anchor, constraint) {
  if (abs(relativeAngleDiff(angle, anchor)) <= constraint) {
    return simplifyAngle(angle);
  }

  if (relativeAngleDiff(angle, anchor) > constraint) {
    return simplifyAngle(anchor - constraint);
  }

  return simplifyAngle(anchor + constraint);
}

/**
 * Calculates the relative angular difference between two angles
 * i.e. How many radians do you need to turn the angle to match the anchor?
 *
 * This function handles the "seam" between 0 and 2π by rotating the coordinate
 * space such that PI is at the anchor, avoiding wraparound issues.
 *
 * @param {number} angle - The angle to compare (in radians)
 * @param {number} anchor - The reference angle (in radians)
 * @returns {number} The relative difference (in radians)
 */
export function relativeAngleDiff(angle, anchor) {
  // Since angles are represented by values in [0, 2pi), it's helpful to rotate
  // the coordinate space such that PI is at the anchor. That way we don't have
  // to worry about the "seam" between 0 and 2pi.
  angle = simplifyAngle(angle + PI - anchor);
  anchor = PI;

  return anchor - angle;
}

/**
 * Simplifies an angle to be in the range [0, 2π)
 * @param {number} angle - The angle to simplify (in radians)
 * @returns {number} The simplified angle in range [0, 2π)
 */
export function simplifyAngle(angle) {
  while (angle >= TWO_PI) {
    angle -= TWO_PI;
  }

  while (angle < 0) {
    angle += TWO_PI;
  }

  return angle;
}
