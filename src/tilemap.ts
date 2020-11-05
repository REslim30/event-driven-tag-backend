// Datastructure to access the tilemap
const fs = require("fs");
var _ = require("lodash");



module.exports = class TileMap {
  private mapOfTileMaps;
  private coinSet: Set<number>;
  private readonly width: number = 28;
  private readonly height: number = 36;
  // Locations of players
  public readonly characterLocations: {
    chasee: { tileX: number, tileY: number },
    chaser0: { tileX: number, tileY: number },
    chaser1: { tileX: number, tileY: number },
    chaser2: { tileX: number, tileY: number },
    chaser3: { tileX: number, tileY: number },
  } = {
    chasee: { tileX: 13, tileY: 23 },
    chaser0: { tileX: 11, tileY: 12 },
    chaser1: { tileX: 13, tileY: 13 },
    chaser2: { tileX: 14, tileY: 13 },
    chaser3: { tileX: 16, tileY: 12 },
  }

  constructor() {
    const tileMap = JSON.parse(fs.readFileSync("assets/ClassicMap.json"));

    this.mapOfTileMaps = tileMap.layers.reduce((acc, cur) => {
      acc[cur.name] = cur
      return acc;
    }, {});

    // coinSet contains all the coins available.
    // Stored as y*tileMap.width + x;
    this.coinSet = this.mapOfTileMaps["coins"].data.reduce((acc: Set<number>, cur: number, idx: number) => {
      if (cur == 8)
        acc.add(idx); 
      return acc;
    }, new Set<number>());
  }

  // Returns whether or not there is a coin on a particular tile
  tileHasCoin(x: number, y: number): boolean {
    return this.coinSet.has(y*this.width + x);
  }

  // Removes a coin
  removeCoin(x: number, y: number): void {
    this.coinSet.delete(y*this.width + x);
  }

  // Returns whether or not a character can move to a tile
  canGo(x: number, y: number): boolean {
    return 0 != this.mapOfTileMaps["bottom"].data[y*this.width + x];
  }

  // checks if coins are all gone
  coinsEmpty(): boolean {
    return this.coinSet.size === 0;
  }

  // Returns a powerup from a tile
  getPowerup(x: number, y:number): "reverse"|"invisible"|null {
    switch (this.mapOfTileMaps["powerups"].data[y*this.width + x]) {
      case 16:
        return "reverse";
      
      case 24:
        return "invisible";
      
      default:
        return null
    }
  }

  removePowerup(x: number, y:number): void {
    this.mapOfTileMaps["powerups"].data[y*this.width + x] = 0;
  }


  executeCallbackIfCanGo(character: { x: number, y: number}, direction: string | undefined, callbackIfTrue = ()=>{}, callbackIfFalse=()=>{}) {
    const { x, y } = character;
    const tileX = Math.trunc(x/8);
    const tileY = Math.trunc(y/8);
    // Only change actual direction if we can move
    switch (direction) {
      case "up":
        if (this.canGo(tileX,tileY-1))
          callbackIfTrue();
        else
          callbackIfFalse();
        return;
      
      case "down":
        if (this.canGo(tileX, tileY+1))
          callbackIfTrue();
        else
          callbackIfFalse();
        return
      
      case "left":
        if (this.canGo(tileX-1,tileY))
          callbackIfTrue();
        else
          callbackIfFalse();
        return;
      
      case "right":
        if (this.canGo(tileX+1,tileY))
          callbackIfTrue();
        else
          callbackIfFalse();
        return;
      
      default:
        return;
    }
  }
}


/* for (let x = 0; x < 28; x++) { */
/*   for (let y = 0; y < 32; y++) { */
/*     console.log(`x: ${x}    y:   ${y}   powerups?    ${module.exports.getPowerup(x, y)}`); */
/*   } */
/* } */
