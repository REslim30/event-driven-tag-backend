// Module that start and end an instance of a  game
const { interval, fromEvent, from } = require("rxjs");
const { map, filter, zip, take, scan, tap, takeWhile } = require("rxjs/operators");
var { shuffle } = require("lodash");
const TileMap = require("./tilemap");
const { hasCollided } = require("./collisionCalc");

// Hyper parameters
const TILE_SIZE = 8; // in pixes
const gameTime = 150; // in sec
const reversalTime = 15000; // in msec
const invisibleTime = 15000; // in msec

let server: SocketIO.Server;

// Map of socket-id to data about their player
let connectionsToRole: Map<string, string>;

interface Character {
  x: number,
  y: number,
  gamepadDirection?: "up" | "down" | "left" | "right",
  actualDirection?: "up" | "down" | "left" | "right"
}

// Data about specific characters
let characterData: {
  chasee: Character,
  chaser0: Character,
  chaser1: Character,
  chaser2: Character,
  chaser3: Character,
};

// List of observables to unsubscribe
let observables: Array<any>;

// States
let reversed: boolean;
let gameEnd: boolean;

// Map
let tilemap: typeof TileMap;

module.exports = {
  start(io: SocketIO.Server) {
    // Reset variables
    initialize(io);
    getDirectionData();
    sendTimerData();
    updateMovementData();
  },

  end() {
  }
}

function initialize(io: SocketIO.Server) {
  server = io;
  connectionsToRole = new Map<string,string>();
  reversed = false;
  gameEnd = false;
  tilemap = new TileMap();
  characterData = {
    chasee: { x: -1, y: -1 },
    chaser0: { x: -1, y: -1 },
    chaser1: { x: -1, y: -1 },
    chaser2: { x: -1, y: -1 },
    chaser3: { x: -1, y: -1 },
  } 
  assignCharacterLocations();
  assignRoles(server);
}

function assignCharacterLocations() {
  Object.entries(tilemap.characterLocations)
    .forEach(([key, value]) => {
      characterData[key]['x'] = (<any>value).tileX*TILE_SIZE + (TILE_SIZE/2);
      characterData[key]['y'] = (<any>value).tileY*TILE_SIZE + (TILE_SIZE/2);
    });
}

// Assign roles to connected players. 
// Ensure that at least one is chasee
function assignRoles(server: SocketIO.Server) {
  // Get array of sockets and array of roles
  const connected = Object.values(server.sockets.connected);
  const roles = Object.keys(tilemap.characterLocations)
    .filter((value: any, index: number) => {
      return index < connected.length;
    });

  // For each socket send a role
  from(connected).pipe(
    zip(from(shuffle(roles))),
    map((arr: any[]) => {
      return { socket: arr[0], role: arr[1] }
    })
  ).subscribe((assignment: any) => {
    const { socket, role } = assignment;

    connectionsToRole[socket.id] = role;

    socket.on("ready", () => {
      socket.emit("role", role);
    });
  });
}

// Stream direction data into connectionsToRole
function getDirectionData() {
  Object.values(server.sockets.connected)
    .forEach((socket: SocketIO.Socket) => {
      fromEvent(socket, "directionChange").pipe(
        map((direction: string) => {
          return { player: connectionsToRole[socket.id], direction: direction };
        }),
        takeWhile(() => !gameEnd)
      ).subscribe(({player, direction}) => {
        characterData[player]["gamepadDirection"] = direction;
      });
    });
}

function sendTimerData() {
  interval(1000).pipe(
    take(gameTime),
    scan((acc: number, cur: number): number => acc - 1, gameTime),
    map((timeLeft: number): string => {
      const sec = `${timeLeft%60}`;
      return `${Math.trunc(timeLeft/60)}:${sec.padStart(2, "0")}`;
    }),
    takeWhile(() => !gameEnd)
  ).subscribe({
        next: (timeLeft: string) => {
          server.emit("timerUpdate", timeLeft);
        },
        error: (err: any) => console.log("Timer error" + err),
        complete: () => {
          server.emit("gameEnd", "Time ran out. chasers win!");
          gameEnd = true;
        }
      });
}

function updateMovementData() {
  const observable = interval(40);
  observable.pipe(
    takeWhile(() => !gameEnd)
  ).subscribe((value) => {
      // Recalculate directions
      if (value % 8 == 0) {
        handleCoin();
        setDirectionFromGamepad();
        handlePowerup();
        console.log(characterData);
      }

      moveCharactersSinglePixel();

      collidedCharacters();
      handleCollision();
      // Emit a position update
      server.emit("positionUpdate", characterData);
    })

    return observable;
}

function handleCoin() {
  const { x, y } = characterData.chasee;
  let tileX = Math.trunc(x/8);
  let tileY = Math.trunc(y/8);
  if (tilemap.tileHasCoin(tileX, tileY)) {
    server.emit("coinRemoval", {tileX: tileX, tileY: tileY});
    tilemap.removeCoin(tileX, tileY);
    handleEndState();
  }
}

function handleEndState() {
  if (tilemap.coinsEmpty()) {
    gameEnd = true;
    server.emit("gameEnd", "All coins are collected! Chasee wins!")
  }
}

function handlePowerup() {
  const { x, y } = characterData["chasee"];
  const tileX: number = Math.trunc(x/8);
  const tileY: number = Math.trunc(y/8);
  handleReversePowerup(tileX, tileY);
  handleInvisiblePowerup(tileX, tileY);
}

let invisibleTimerId: any;
function handleInvisiblePowerup(tileX: number, tileY: number) {
  if (tilemap.getPowerup(tileX, tileY) === "invisible") {
    // Start invisible
    server.emit("startInvisible", { tileX: tileX, tileY: tileY});
    tilemap.removePowerup(tileX, tileY);
    console.log("Invisible powerup");

    // Clear old timeout if exists
    clearTimeout(invisibleTimerId);

    // End invisible
    invisibleTimerId = setTimeout(() => {
      console.log("Invisible powerup end")
      server.emit("endInvisible");
    }, invisibleTime);
  }
}

let reverseTimerId: any;
function handleReversePowerup(tileX: number, tileY: number) {
  if (tilemap.getPowerup(tileX, tileY) === "reverse") {
    // Start reversal
    server.emit("startReversal", { tileX: tileX, tileY: tileY });
    reversed = true;
    tilemap.removePowerup(tileX, tileY);
    console.log("Reversal powerup");

    // Clear old timeout if exists
    clearTimeout(reverseTimerId);

    // End a reversal sometime later
    reverseTimerId = setTimeout(() => {
      console.log("Reversal powerup end");
      server.emit("endReversal");
      reversed = false;
    }, reversalTime);
  }
}

function setDirectionFromGamepad() {
  Object.keys(characterData)
    .forEach((character) => {
      // Do nothing if the character is dead
      if (characterData[character] === undefined)
        return;
      setActualDirection(character);
      removeActualDirectionIfCantGo(character);
    });
}

function moveCharactersSinglePixel() {
  // Move one pixel
  Object.keys(characterData)
    .forEach((character) => {
      switch (characterData[character].actualDirection) {
        case "up":
          characterData[character].y--;
          return;

        case "down":
          characterData[character].y++;
          return;

        case "left":
          characterData[character].x--;
          return;

        case "right":
          characterData[character].x++;
          return;
        
        default:
          return;
      }
    })
}

function setActualDirection(character: string) {
  const { gamepadDirection } = characterData[character];
  executeCallbackIfCanGo(character, gamepadDirection, () => {
    characterData[character]["actualDirection"] = gamepadDirection;
  });
}

// Stop moving if we can't go
function removeActualDirectionIfCantGo(character: string) {
  const { actualDirection } = characterData[character];
  executeCallbackIfCanGo(character, actualDirection, () => {}, () => {
    characterData[character]["actualDirection"] = undefined;
  });
}

function executeCallbackIfCanGo(character: string, direction: string | undefined, callbackIfTrue = ()=>{}, callbackIfFalse=()=>{}) {
  const { x, y } = characterData[character];
  const tileX = Math.trunc(x/8);
  const tileY = Math.trunc(y/8);
  // Only change actual direction if we can move
  switch (direction) {
    case "up":
      if (tilemap.canGo(tileX,tileY-1))
        callbackIfTrue();
      else
        callbackIfFalse();
      return;
    
    case "down":
      if (tilemap.canGo(tileX, tileY+1))
        callbackIfTrue();
      else
        callbackIfFalse();
      return
    
    case "left":
      if (tilemap.canGo(tileX-1,tileY))
        callbackIfTrue();
      else
        callbackIfFalse();
      return;
    
    case "right":
      if (tilemap.canGo(tileX+1,tileY))
        callbackIfTrue();
      else
        callbackIfFalse();
      return;
    
    default:
      return;
  }
}

function handleCollision(): void {
  if (reversed) {
    collidedCharacters()
      .forEach((character: string) => {
        delete characterData[character];     
        server.emit("death", character);
      })
  } else {
    if (collidedCharacters().length !== 0) {
      server.emit("gameEnd", "Chasee tagged! Chasers win!");
      gameEnd = true;
    }
  }
}

// Returns list of names who collided with chasee
function collidedCharacters(): Array<string> {
  return Object.entries(characterData)
    .filter(([key, value]) => key !== 'chasee')
    .reduce((acc, [key, value]) => {
      if (hasCollided(value as { x:number, y:number}, characterData['chasee']))
        return [...acc, key];
      else 
        return acc;
    }, [])
}
