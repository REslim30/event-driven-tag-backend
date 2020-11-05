const TileMap = require("./tilemap");
var { shuffle } = require("lodash");
var { from } = require("rxjs");
var { map, filter, zip } = require("rxjs/operators");

interface Character {
  x: number,
  y: number,
  gamepadDirection?: "up" | "down" | "left" | "right",
  actualDirection?: "up" | "down" | "left" | "right"
}

// Data about specific characters
class GameRound {
  // Hyper parameters
  readonly TILE_SIZE = 8; // in pixes
  readonly gameTime = 150; // in sec
  readonly reversalTime = 15000; // in msec
  readonly invisibleTime = 15000; // in msec

  // Map of socket-id to data about their player
  readonly connectionsToRole: Map<string, string>;
  
  // Data of the location and direction of characters
  readonly characterPosData: {
    chasee: Character,
    chaser0: Character,
    chaser1: Character,
    chaser2: Character,
    chaser3: Character,
  };

  // States
  reversed: boolean;

  // Map
  readonly tilemap: typeof TileMap;

  constructor(io: SocketIO.Server) {
    this.connectionsToRole = new Map<string,string>();
    this.reversed = false;
    this.tilemap = new TileMap();
    this.characterPosData = {
      chasee: { x: -1, y: -1 },
      chaser0: { x: -1, y: -1 },
      chaser1: { x: -1, y: -1 },
      chaser2: { x: -1, y: -1 },
      chaser3: { x: -1, y: -1 },
    } 
    this.assignCharacterLocations();
    this.assignRoles(io);
  }

  // Helper functions
  private assignCharacterLocations() {
  Object.entries(this.tilemap.characterLocations)
    .forEach(([key, value]) => {
      this.characterPosData[key]['x'] = (<any>value).tileX*this.TILE_SIZE + (this.TILE_SIZE/2);
      this.characterPosData[key]['y'] = (<any>value).tileY*this.TILE_SIZE + (this.TILE_SIZE/2);
    });
  }

  // Assign roles to connected players. 
  // Ensure that at least one is chasee
  private assignRoles(server: SocketIO.Server) {
    // Get array of sockets and array of roles
    const connected = Object.values(server.sockets.connected);
    const roles = Object.keys(this.tilemap.characterLocations)
      .filter((value: any, index: number) => {
        return index < connected.length;
      });

    // For each socket assign a role
    from(connected).pipe(
      zip(from(shuffle(roles))),
      map((arr: any[]) => {
        return { socket: arr[0], role: arr[1] }
      })
    ).subscribe((assignment: any) => {
      this.assignSocketARole(assignment);
    });
  }

  private assignSocketARole(assignment: any) {
      const { socket, role } = assignment;

      this.connectionsToRole[socket.id] = role;
      
      socket.on("ready", () => {
        socket.emit("role", role);
      });
  }
}


module.exports = GameRound;
