const game = require("./game");

//Implementaiton of serverFSM you can find on logbook
class ServerFSM {
  //State variables
  private readonly LOBBY: number = 0;
  private readonly GAME: number = 1;
  private state: number = -1;

  //Fields
  private lobby: Array<any>;
  private io: SocketIO.Server;

  constructor(server: SocketIO.Server) {
    this.io = server;
    this.initialize();
    this.lobby = [];
  }

  private initialize(): void {
    this.next(this.LOBBY);
  }

  private next(nextState: number): void {
    this.state = nextState;
    switch (this.state) {
      case this.LOBBY:
        console.log("Initializing lobby");
        return;
      
      case this.GAME:
        this.io.emit("gameStart");
        console.log("Starting Game")
        game.start(this.io);
        return;
      
      default:
        throw Error("Unknown state in serverFSM: " + this.state);
    }
  }

  public clientConnect(name: string, socket: SocketIO.Socket): void {
    switch (this.state) {
      case this.LOBBY:
        if (this.lobby.length < 5) {
          this.lobby.push(name);
          this.io.emit("lobby", this.lobby);
        } else {
          console.log("Server full. Reject connection: " + name);
          socket.disconnect(true);
        }
        return;
      
      case this.GAME:
        socket.disconnect(true);
        return;
      
      default:
        throw Error("Undefined state in clientConnect: " + this.state);
    }
  }

  public clientDisconnect(name: string): void {
    let idx: number;
    switch (this.state) {
      case this.LOBBY:
        idx = this.lobby.findIndex((element) => element == name);

        // Throw error if name not found
        if (idx == -1)
          throw Error("Could not find lobby member: " + name);

        // Otherwise broadcast array
        this.lobby.splice(idx, 1);
        this.io.emit("lobby", this.lobby);
        return;
      
      case this.GAME:
        idx = this.lobby.findIndex((element) => element == name);

        // Throw error if name not found
        if (idx == -1)
          throw Error("Could not find lobby member: " + name);

        this.lobby.splice(idx, 1);

        // If lobby is empty then we should end game
        if (this.lobby.length == 0) {
          game.end();
          this.next(this.LOBBY);
        }
        this.io.emit("lobby", this.lobby);
        return;
      
      default:
        throw Error("Undefined state in clientDisconnect: " + this.state);
    }
  }

  public clientStart(): void {
    switch (this.state) {
      case this.LOBBY:
        if (this.lobby.length == 0)
          return;
        
        this.next(this.GAME);
        return; 
      
      case this.GAME:
         return; 
      
      default:
        throw Error("Undefined state in clientStart: " + this.state);
    }
  }

  public gameEnd(message: string): void{
    switch (this.state) {
      case this.GAME:
        console.log("Game Ended");
        this.io.emit("gameEnd", message);
        game.end();
        this.next(this.LOBBY);
        return;

      case this.LOBBY:
        return;
      
      
      default:
        throw Error("Undefined state in gameEnd" + this.state);
    }
  }

  public lobbyRequest(socket: SocketIO.Socket): void {
    switch (this.state) {
      case this.LOBBY:
        socket.emit("lobby", this.lobby);
        return;

      case this.GAME:
        return;

      default:
        throw Error("Undefined state in lobbyRequest" + this.state);
    }
  }
};

module.exports = ServerFSM;
