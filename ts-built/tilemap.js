// Datastructure to access the tilemap
var fs = require("fs");
var _ = require("lodash");
// Grab json
var rawdata = fs.readFileSync("../assets/ClassicMap.json");
var tileMap = JSON.parse(rawdata);
var mapOfTileMaps = tileMap.layers.reduce(function (acc, cur) {
    acc[cur.name] = cur;
    return acc;
}, {});
// coinSet contains all the coins available.
// Stored as y*tileMap.width + x;
var coinSet = mapOfTileMaps["coins"].data.reduce(function (acc, cur, idx) {
    if (cur == 8)
        acc.add(idx);
    return acc;
}, new Set());
module.exports = {
    tileMap: mapOfTileMaps,
    // Returns whether or not there is a coin on a particular tile
    tileHasCoin: function (x, y) {
        return coinSet.has(y * tileMap.width + x);
    },
    // Returns whether or not a character can move to a tile
    canGo: function (x, y) {
        return 0 != this.tileMap["bottom"].data[y * tileMap.width + x];
    }
};
for (var x = 0; x < 28; x++) {
    for (var y = 0; y < 36; y++) {
        console.log("x: " + x + "   y: " + y + "    has coin?    " + module.exports.tileHasCoin(x, y));
    }
}
