// Datastructure to access the tilemap
const fs = require("fs");
var _ = require("lodash");

// Grab json
let rawdata = fs.readFileSync("../assets/ClassicMap.json");
let tileMap = JSON.parse(rawdata);

let mapOfTileMaps = tileMap.layers.reduce((acc, cur) => {
  acc[cur.name] = cur
  return acc;
}, {});

// coinSet contains all the coins available.
// Stored as y*tileMap.width + x;
let coinSet: Set<number> = mapOfTileMaps["coins"].data.reduce((acc: Set<number>, cur: number, idx: number) => {
  if (cur == 8)
    acc.add(idx); 
  return acc;
}, new Set<number>());

module.exports = {
  // Returns whether or not there is a coin on a particular tile
  tileHasCoin(x: number, y: number): boolean {
    return coinSet.has(y*tileMap.width + x);
  },

  // Removes a coin
  removeCoin(x: number, y: number): void {
    coinSet.delete(y*tileMap.width + x);
  },

  // Returns whether or not a character can move to a tile
  canGo(x: number, y: number): boolean {
    return 0 != this.tileMap["bottom"].data[y*tileMap.width + x];
  }
}

