// Datastructure to access the tilemap
const fs = require("fs");
var _ = require("lodash");

// Grab json
let rawdata = fs.readFileSync("../assets/ClassicMap.json");
let tileMap = JSON.parse(rawdata);

module.exports = {
  tilemap: tileMap.layers.reduce((acc, cur) => {
    acc[cur.name] = cur
    return acc;
  }, {}),

  // Returns whether or not there is a coin on a particular tile
  isCoin(tile: number): boolean {
    return tile === 8;
  },

  // Returns whether or not a character can move to a tile
  canGo(x: number, y: number): boolean {
    return 0 != this.tilemap["bottom"].data[y*tileMap.width + x];
  }
}


for (let y = 0; y < 36; y++) {
  for (let x = 0; x < 28; x++) {
    console.log(`x: ${x} y: ${y}   canGo? ${module.exports.canGo(x, y)}`);
  }
}
