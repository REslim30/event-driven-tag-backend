// Module that start and end an instance of a  game
const { interval, fromEvent, from } = require("rxjs");
const { map, filter, zip, take, scan, tap } = require("rxjs/operators");
const playerLocations = require("./playerLocations");
var _ = require("lodash");
const tilemap = require("./tilemap");
const { hasCollided } = require("./collisionCalc");

const TILE_SIZE = 8;

let server: SocketIO.Server;

// Map of socket-id to data about their player
let connectionsToGame: any;

// Data about specific characters
let characterData: any;

// List of observables to unsubscribe
let observables: Array<any>;

module.exports = {
  start(io: SocketIO.Server) {
    // Reset variables
    server = io;
    connectionsToGame = {};
    characterData = {
      chasee: {},
      chaser0: {},
      chaser1: {},
      chaser2: {},
      chaser3: {}
    };


    assignCharacterLocations();

    assignRoles(server);

    getDirectionData();

    sendTimerData();

    updateMovementData();
  },

  end() {
      
  }
}

function assignCharacterLocations() {
  Object.entries(playerLocations)
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
  const roles = Object.keys(playerLocations)
    .filter((value: any, index: number) => {
      return index < connected.length;
    });

  // For each socket send a role
  from(connected).pipe(
    zip(from(_.shuffle(roles))),
    map((arr: any[]) => {
      return { socket: arr[0], role: arr[1] }
    })
  ).subscribe((assignment: any) => {
    const { socket, role } = assignment;

    connectionsToGame[socket.id] = { role: role };

    socket.on("ready", () => {
      socket.emit("role", role);
    });

  });
}

// Stream direction data into connectionsToGame
function getDirectionData() {
  Object.values(server.sockets.connected)
    .forEach((socket: SocketIO.Socket) => {
      const observable = fromEvent(socket, "directionChange").pipe(
        map((direction: string) => {
          return { player: connectionsToGame[socket.id].role, direction: direction };
        })
      )
      observable.subscribe(({player, direction}) => {
        characterData[player]["gamepadDirection"] = direction;
      });
    });
}

function sendTimerData() {
  const observable = interval(1000).pipe(
    take(150),
    scan((acc: number, cur: number): number => acc - 1, 151),
    map((timeLeft: number): string => {
      const sec = `${timeLeft%60}`;
      return `${Math.trunc(timeLeft/60)}:${sec.padStart(2, "0")}`;
    })
  );
  observable
    .subscribe((timeLeft: string) => {
      server.emit("timerUpdate", timeLeft);
    });

  return observable;
}

function updateMovementData() {
  const observable = interval(40);
  observable
    .subscribe((value) => {
      // Recalculate directions
      if (value % 8 == 0) {
        handleCoin();
        setDirectionFromGamepad();
      }

      moveCharactersSinglePixel();

      console.log(collidedCharacters());
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
  console.log("Checking End state... Unimplemented.");
}

function setDirectionFromGamepad() {
  Object.keys(characterData)
    .forEach((character) => {
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

