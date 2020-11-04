// Datastructure to access the tilemap
const fs = require("fs");
var _ = require("lodash");

// Grab json
let rawdata = fs.readFileSync("assets/ClassicMap.json");
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
    return 0 != mapOfTileMaps["bottom"].data[y*tileMap.width + x];
  },

  // checks if coins are all gone
  coinsEmpty(): boolean {
    return coinSet.size === 0;
  },

  // Returns a powerup from a tile
  getPowerup(x: number, y:number): "reverse"|"invisible"|null {
    switch (mapOfTileMaps["powerups"].data[y*tileMap.width + x]) {
      case 16:
        return "reverse";
      
      case 24:
        return "invisible";
      
      default:
        return null
    }
  },

  removePowerup(x: number, y:number): void {
    mapOfTileMaps["powerups"].data[y*tileMap.width + x] = 0;
  }
}


/* for (let x = 0; x < 28; x++) { */
/*   for (let y = 0; y < 32; y++) { */
/*     console.log(`x: ${x}    y:   ${y}   powerups?    ${module.exports.getPowerup(x, y)}`); */
/*   } */
/* } */
