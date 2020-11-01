//Implementaiton of serverFSM you can find on logbook
class ServerFSM {
  //State variables
  private readonly LOBBY: number = 0;
  private readonly GAME: number = 1;
  private state: number = -1;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.next(this.LOBBY);
  }

  private next(nextState: number): void {
    this.state = nextState;
    switch (this.state) {
      
      default:
        console.log("next default");
        break;
    }
  }
};

module.exports = ServerFSM;
