// Datastructure to access the tilemap
var fs = require("fs");
var _ = require("lodash");
module.exports = /** @class */ (function () {
    function TileMap() {
        this.width = 28;
        this.height = 36;
        // Locations of players
        this.characterLocations = {
            chasee: { tileX: 13, tileY: 23 },
            chaser0: { tileX: 11, tileY: 12 },
            chaser1: { tileX: 13, tileY: 13 },
            chaser2: { tileX: 14, tileY: 13 },
            chaser3: { tileX: 16, tileY: 12 }
        };
        var tileMap = JSON.parse(fs.readFileSync("assets/ClassicMap.json"));
        this.mapOfTileMaps = tileMap.layers.reduce(function (acc, cur) {
            acc[cur.name] = cur;
            return acc;
        }, {});
        // coinSet contains all the coins available.
        // Stored as y*tileMap.width + x;
        this.coinSet = this.mapOfTileMaps["coins"].data.reduce(function (acc, cur, idx) {
            if (cur == 8)
                acc.add(idx);
            return acc;
        }, new Set());
    }
    // Returns whether or not there is a coin on a particular tile
    TileMap.prototype.tileHasCoin = function (x, y) {
        return this.coinSet.has(y * this.width + x);
    };
    // Removes a coin
    TileMap.prototype.removeCoin = function (x, y) {
        this.coinSet["delete"](y * this.width + x);
    };
    // Returns whether or not a character can move to a tile
    TileMap.prototype.canGo = function (x, y) {
        return 0 != this.mapOfTileMaps["bottom"].data[y * this.width + x];
    };
    // checks if coins are all gone
    TileMap.prototype.coinsEmpty = function () {
        return this.coinSet.size === 0;
    };
    // Returns a powerup from a tile
    TileMap.prototype.getPowerup = function (x, y) {
        switch (this.mapOfTileMaps["powerups"].data[y * this.width + x]) {
            case 16:
                return "reverse";
            case 24:
                return "invisible";
            default:
                return null;
        }
    };
    TileMap.prototype.removePowerup = function (x, y) {
        this.mapOfTileMaps["powerups"].data[y * this.width + x] = 0;
    };
    return TileMap;
}());
/* for (let x = 0; x < 28; x++) { */
/*   for (let y = 0; y < 32; y++) { */
/*     console.log(`x: ${x}    y:   ${y}   powerups?    ${module.exports.getPowerup(x, y)}`); */
/*   } */
/* } */
