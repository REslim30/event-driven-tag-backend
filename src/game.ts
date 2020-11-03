// Module that start and end an instance of a  game
const { interval, fromEvent, from } = require("rxjs");
const { map, filter, zip, take, scan, tap } = require("rxjs/operators");
const playerLocations = require("./playerLocations");
var _ = require("lodash");
const tilemap = require("tilemap.ts");

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

      observables.push(observable);
    });
}

function sendTimerData() {
  const observable = interval(1000).pipe(
    take(120),
    scan((acc: number, cur: number): number => acc - 1, 121),
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
  const observable = interval(55);
  observable
    .subscribe((value) => {
      // Recalculate directions
      if (value % 8 == 0) {
        Object.keys(characterData)
          .forEach((character) => {
            characterData[character].actualDirection = characterData[character]?.gamepadDirection;
          });
      }

      // Move one pixel
      Object.keys(characterData)
        .forEach((character) => {
          switch (characterData[character].actualDirection) {
            case "up":
              characterData[character].y--;
              break;

            case "down":
              characterData[character].y++;
              break;

            case "left":
              characterData[character].x--;
              break;

            case "right":
              characterData[character].x++;
              break;
            
            default:
              break;
          }
        })

      // Emit a position update
      server.emit("positionUpdate", characterData);
    })

    return observable;
}
