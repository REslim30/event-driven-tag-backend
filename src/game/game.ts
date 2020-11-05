// Module that start and end an instance of a  game
var { Subject, interval, fromEvent, from, Observable } = require("rxjs");
var { debounceTime, map, filter, zip, take, scan, tap, takeUntil } = require("rxjs/operators");
const { hasCollided } = require("./collisionCalc");
const GameRoundConstructor = require("./GameRound");

let server: SocketIO.Server;

let gameRound: GameRound;

// Streams that handle reversal and invisible powerups
let reversalStream: any;
let invisibleStream: any;

module.exports = {
  // Subject we use to end our streams
  endStream: null,

  // Initialize game
  start(io: SocketIO.Server) {
    server = io;
    this.endStream = new Subject();

    // sync initialization
    gameRound = new GameRoundConstructor(io);

    // async initialization
    setPowerupEndStreams(this.endStream);
    getDirectionData(this.endStream);
    sendTimerData(this.endStream);
    updateMovementData(this.endStream);
  },

  // Executes shutdown sequence
  end() {
    this.endStream.next();
    this.endStream.complete();

    removeSocketListeners();
  }
}


function setPowerupEndStreams(endStream: typeof Observable) {
  setReversalStream(endStream);
  setInvisibleStream(endStream);
}

function setReversalStream(endStream: typeof Observable) {
  reversalStream = new Subject();
  reversalStream.pipe(
    takeUntil(endStream)
  ).subscribe(({ tileX, tileY}) => {
      server.emit("startReversal", { tileX: tileX, tileY: tileY });
      gameRound.reversed = true;
      gameRound.tilemap.removePowerup(tileX, tileY);
      console.log("Reversal powerup");
    })
  
  // End reversal only if chasee has gone gameRound.reversed without
  // Any other reversal powerups
  reversalStream.pipe(
    debounceTime(gameRound.reversalTime),
    takeUntil(endStream)
  ).subscribe(() => {
    console.log("Reversal powerup end");
    server.emit("endReversal");
    gameRound.reversed = false;
  });
}

function setInvisibleStream(endStream: typeof Observable) {
  invisibleStream = new Subject();

  invisibleStream.pipe(
    takeUntil(endStream)
  ).subscribe(({ tileX, tileY }) => {
    server.emit("startInvisible", { tileX: tileX, tileY: tileY});
    gameRound.tilemap.removePowerup(tileX, tileY);
    console.log("Invisible powerup");
  });

  // Only endInvisible if chasee has gone x amount of time without
  // Any other invisible powerup 
  invisibleStream.pipe(
    takeUntil(endStream),
    debounceTime(gameRound.invisibleTime)
  ).subscribe(() => {
    console.log("Invisible powerup end")
    server.emit("endInvisible");
  })
}

// Stream direction data into connectionsToRole
function getDirectionData(endStream: typeof Observable) {
  Object.values(server.sockets.connected)
    .forEach((socket: SocketIO.Socket) => {
      subscribeToDirectionalData(socket, endStream);
    });
}

function subscribeToDirectionalData(socket: SocketIO.Socket, endStream: typeof Observable) {
  fromEvent(socket, "directionChange").pipe(
    takeUntil(endStream),
    map((direction: string) => {
      return { player: gameRound.connectionsToRole[socket.id], direction: direction };
    }),
  ).subscribe({
    next: ({player, direction}) => {
      gameRound.characterPosData[player]["gamepadDirection"] = direction;
    },
    error: () => {},
    completed: () => {
      console.log("Directional Data listener complete.");
    },
  })
}

function sendTimerData(endStream: typeof Observable) {
  interval(1000).pipe(
    take(gameRound.gameTime),
    scan((acc: number, cur: number): number => acc - 1, gameRound.gameTime),
    map((timeLeft: number): string => {
      const sec = `${timeLeft%60}`;
      return `${Math.trunc(timeLeft/60)}:${sec.padStart(2, "0")}`;
    }),
    takeUntil(endStream)
  ).subscribe({
        next: (timeLeft: string) => {
          server.emit("timerUpdate", timeLeft);
        },
        error: (err: any) => console.log("Timer error" + err),
        complete: () => {
          endGame("Time ran out. Chasers win!");
          console.log("Timer has completed!");
        }
      });
}

function updateMovementData(endStream: typeof Observable): void {
  interval(40).pipe(
    takeUntil(endStream)
  ).subscribe({
    next: (value) => {
      // Recalculate directions
      if (value % 8 == 0) {
        handleCoin();
        setDirectionFromGamepad();
        handlePowerup();
      }

      moveCharactersSinglePixel();

      collidedCharacters();
      handleCollision();
      // Emit a position update
      server.emit("positionUpdate", gameRound.characterPosData);
    },
    error: (err: any) => {},
    complete: () => {
      console.log("Movement Updater complete");
    }
  });
}

function handleCoin() {
  const { x, y } = gameRound.characterPosData.chasee;
  let tileX = Math.trunc(x/8);
  let tileY = Math.trunc(y/8);
  if (gameRound.tilemap.tileHasCoin(tileX, tileY)) {
    server.emit("coinRemoval", {tileX: tileX, tileY: tileY});
    gameRound.tilemap.removeCoin(tileX, tileY);
    handleEndState();
  }
}

function handleEndState() {
  if (gameRound.tilemap.coinsEmpty()) {
    endGame("All coins are collected! Chasee wins!");
  }
}

function handlePowerup() {
  const { x, y } = gameRound.characterPosData["chasee"];
  const tileX: number = Math.trunc(x/8);
  const tileY: number = Math.trunc(y/8);
  if (gameRound.tilemap.getPowerup(tileX, tileY) === "invisible") {
    invisibleStream.next({tileX: tileX, tileY: tileY});
  }
  if (gameRound.tilemap.getPowerup(tileX, tileY) === "reverse") {
    reversalStream.next({tileX: tileX, tileY: tileY});
  }
}

function setDirectionFromGamepad() {
  Object.keys(gameRound.characterPosData)
    .forEach((character) => {
      // Do nothing if the character is dead
      if (gameRound.characterPosData[character] === undefined)
        return;
      setActualDirection(character);
      removeActualDirectionIfCantGo(character);
    });
}

function moveCharactersSinglePixel() {
  // Move one pixel
  Object.keys(gameRound.characterPosData)
    .forEach((character) => {
      switch (gameRound.characterPosData[character].actualDirection) {
        case "up":
          gameRound.characterPosData[character].y--;
          return;

        case "down":
          gameRound.characterPosData[character].y++;
          return;

        case "left":
          gameRound.characterPosData[character].x--;
          return;

        case "right":
          gameRound.characterPosData[character].x++;
          return;
        
        default:
          return;
      }
    })
}

// Change direction to gamepad direction only if it's ok
function setActualDirection(character: string) {
  const { gamepadDirection } = gameRound.characterPosData[character];
  gameRound.tilemap.executeCallbackIfCanGo(gameRound.characterPosData[character], gamepadDirection, () => {
    gameRound.characterPosData[character]["actualDirection"] = gamepadDirection;
  });
}

// Stop moving if we can't go
function removeActualDirectionIfCantGo(character: string) {
  const { actualDirection } = gameRound.characterPosData[character];
  gameRound.tilemap.executeCallbackIfCanGo(gameRound.characterPosData[character], actualDirection, () => {}, () => {
    gameRound.characterPosData[character]["actualDirection"] = undefined;
  });
}


function handleCollision(): void {
  if (gameRound.reversed) {
    collidedCharacters()
      .forEach((character: string) => {
        delete gameRound.characterPosData[character];     
        server.emit("death", character);
      })
  } else {
    if (collidedCharacters().length !== 0) {
      endGame("Chasee tagged! Chasers win!")
    }
  }
}

// Returns list of names who collided with chasee
function collidedCharacters(): Array<string> {
  return Object.entries(gameRound.characterPosData)
    .filter(([key, value]) => key !== 'chasee')
    .reduce((acc, [key, value]) => {
      if (hasCollided(value as { x:number, y:number}, gameRound.characterPosData['chasee']))
        return [...acc, key];
      else 
        return acc;
    }, [])
}

// Ends the game
function endGame(message: string) {
  global['serverFSM'].gameEnd(message);
}

function removeSocketListeners() {
  console.log("Removing Socket Listeners.")
  Object.values(server.sockets.connected)
    .forEach((socket: SocketIO.Socket) => {
      socket.removeAllListeners("ready");
      socket.removeAllListeners("directionChange");
    })
}
