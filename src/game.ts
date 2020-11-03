// Module that start and end an instance of a  game
const { fromEvent, from } = require("rxjs");
const { map, filter, zip } = require("rxjs/operators");
const playerLocations = require("./playerLocations");
const _ = require("lodash");

let server: SocketIO.Server;

// Map of socket-id to data about their player
let connectionsToGame: any;

module.exports = {
  start(io: SocketIO.Server) {
    server = io;
    connectionsToGame = {};

    assignRoles(server);

    Object.values(server.sockets.connected)
      .forEach((socket: SocketIO.Socket) => {
        fromEvent(socket, "directionChange").pipe(
          map((direction: string) => {
            return { player: connectionsToGame[socket.id].role, direction: direction };
          })
        ).subscribe((obj: any) => {
          console.log(obj);
        });
      });
  },

  end() {
    console.log("Game Ended");  
  }
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

