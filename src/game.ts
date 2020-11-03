// Module that start and end an instance of a  game
const { interval, fromEvent, from } = require("rxjs");
const { map, filter, zip, take, scan } = require("rxjs/operators");
const playerLocations = require("./playerLocations");
const _ = require("lodash");

const TILE_SIZE = 8;

let server: SocketIO.Server;

// Map of socket-id to data about their player
let connectionsToGame: any;

// Data about specific characters
const characterData: any = {
      chasee: {},
      chaser0: {},
      chaser1: {},
      chaser2: {},
      chaser3: {}
    };

module.exports = {
  start(io: SocketIO.Server) {
    server = io;
    connectionsToGame = {};

    assignCharacterLocations();

    assignRoles(server);

    getDirectionData();

    interval(1000).pipe(
      take(120),
      scan((acc: number, cur: number): number => acc - 1, 121),
      map((timeLeft: number): string => {
        const sec = `${timeLeft%60}`;
        return `${Math.trunc(timeLeft/60)}:${sec.padStart(2, "0")}`;
      })
    ).subscribe((timeLeft: string) => {
      server.emit("timerUpdate", timeLeft);
    });
  },

  end() {
    console.log("Game Ended");  
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
      fromEvent(socket, "directionChange").pipe(
        map((direction: string) => {
          return { player: connectionsToGame[socket.id].role, direction: direction };
        })
      ).subscribe((playerDirection: any) => {
        
      });
    });
}
