// Module that calculates whether two objects have collided.

function euclideanDistance(a: { x:number, y:number }, b: { x: number, y:number }): number {
  return (((a.x-b.x)**2) + ((a.y-b.y)**2))**(1/2);
}

module.exports = {
  hasCollided(a: { x:number, y:number }, b: { x: number, y:number }): boolean {
    return euclideanDistance(a, b) < 4
  }
}
