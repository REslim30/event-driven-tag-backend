// Datastructure to access the tilemap
var fs = require("fs");
var _ = require("lodash");
// Grab json
var rawdata = fs.readFileSync("../assets/ClassicMap.json");
var tileMap = JSON.parse(rawdata);
module.exports = {
    tilemap: tileMap.layers.reduce(function (acc, cur) {
        acc[cur.name] = cur;
        return acc;
    }, {}),
    // Returns whether or not there is a coin on a particular tile
    isCoin: function (tile) {
        return tile === 8;
    },
    // Returns whether or not a character can move to a tile
    canGo: function (x, y) {
        return 0 != this.tilemap["bottom"].data[y * tileMap.width + x];
    }
};
for (var y = 0; y < 36; y++) {
    for (var x = 0; x < 28; x++) {
        console.log("x: " + x + " y: " + y + "   canGo? " + module.exports.canGo(x, y));
    }
}
