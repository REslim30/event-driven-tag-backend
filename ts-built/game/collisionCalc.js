// Module that calculates whether two objects have collided.
function euclideanDistance(a, b) {
    return Math.pow(((Math.pow((a.x - b.x), 2)) + (Math.pow((a.y - b.y), 2))), (1 / 2));
}
module.exports = {
    hasCollided: function (a, b) {
        return euclideanDistance(a, b) < 3;
    }
};
