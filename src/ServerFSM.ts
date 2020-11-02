
//Implementaiton of serverFSM you can find on logbook
class ServerFSM {
  //State variables
  private readonly LOBBY: number = 0;
  private readonly GAME: number = 1;
  private state: number = -1;

  //Fields
  private lobby: Array<any>;

  constructor() {
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
        break;
      
      case this.GAME:
        console.log("Initializing Game");
        break;
      
      default:
        console.log("next default");
        break;
    }
  }

  public clientConnect(name: string): Array<any> | null {
    switch (this.state) {
      case this.LOBBY:
        if (this.lobby.length < 5) {
          this.lobby.push(name);
          return this.lobby.slice();
        } else {
          return null;
        }
      
      case this.GAME:
        return null;
      
      default:
        throw Error("Undefined state in clientConnect: " + this.state);
    }
  }

  public clientDisconnect(name: string): Array<any> | null {
    let idx: number;
    switch (this.state) {
      case this.LOBBY:
        idx = this.lobby.findIndex((element) => element == name);

        // Throw error if name not found
        if (idx == -1)
          throw Error("Could not find lobby member: " + name);

        // Otherwise return array
        this.lobby.splice(idx, 1);
        return this.lobby.slice();
      
      case this.GAME:
        idx = this.lobby.findIndex((element) => element == name);

        // Throw error if name not found
        if (idx == -1)
          throw Error("Could not find lobby member: " + name);

        this.lobby.splice(idx, 1);

        if (this.lobby.length == 0) {
          this.next(this.LOBBY);
        }
        return null;
      
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

  public gameEnd(): Array<any> | null {
    switch (this.state) {
      case this.GAME:
        console.log("Ending Game");
        return this.lobby.slice();
      
      default:
        throw Error("Undefined state in clientStart: " + this.state);
    }
  }
};

module.exports = ServerFSM;
