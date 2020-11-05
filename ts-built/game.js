var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
// Module that start and end an instance of a  game
var _a = require("rxjs"), Subject = _a.Subject, interval = _a.interval, fromEvent = _a.fromEvent, from = _a.from, Observable = _a.Observable;
var _b = require("rxjs/operators"), map = _b.map, filter = _b.filter, zip = _b.zip, take = _b.take, scan = _b.scan, tap = _b.tap, takeUntil = _b.takeUntil;
var hasCollided = require("./collisionCalc").hasCollided;
var GameRoundConstructor = require("./GameRound");
var server;
var gameRound;
module.exports = {
    // Subject we use to end our streams
    endStream: null,
    // Initialize game
    start: function (io) {
        server = io;
        this.endStream = new Subject();
        // sync initialization
        gameRound = new GameRoundConstructor(io);
        // async initialization
        getDirectionData(this.endStream);
        sendTimerData(this.endStream);
        updateMovementData(this.endStream);
    },
    // Executes shutdown sequence
    end: function () {
        this.endStream.next();
        this.endStream.complete();
        clearTimeout(invisibleTimerId);
        clearTimeout(reverseTimerId);
        removeSocketListeners();
    }
};
// Stream direction data into connectionsToRole
function getDirectionData(endStream) {
    Object.values(server.sockets.connected)
        .forEach(function (socket) {
        subscribeToDirectionalData(socket, endStream);
    });
}
function subscribeToDirectionalData(socket, endStream) {
    fromEvent(socket, "directionChange").pipe(takeUntil(endStream), map(function (direction) {
        return { player: gameRound.connectionsToRole[socket.id], direction: direction };
    })).subscribe({
        next: function (_a) {
            var player = _a.player, direction = _a.direction;
            gameRound.characterPosData[player]["gamepadDirection"] = direction;
        },
        error: function () { },
        completed: function () {
            console.log("Directional Data listener complete.");
        }
    });
}
function sendTimerData(endStream) {
    interval(1000).pipe(take(gameRound.gameTime), scan(function (acc, cur) { return acc - 1; }, gameRound.gameTime), map(function (timeLeft) {
        var sec = "" + timeLeft % 60;
        return Math.trunc(timeLeft / 60) + ":" + sec.padStart(2, "0");
    }), takeUntil(endStream)).subscribe({
        next: function (timeLeft) {
            server.emit("timerUpdate", timeLeft);
        },
        error: function (err) { return console.log("Timer error" + err); },
        complete: function () {
            endGame("Time ran out. Chasers win!");
            console.log("Timer has completed!");
        }
    });
}
function updateMovementData(endStream) {
    interval(40).pipe(takeUntil(endStream)).subscribe({
        next: function (value) {
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
        error: function (err) { },
        complete: function () {
            console.log("Movement Updater complete");
        }
    });
}
function handleCoin() {
    var _a = gameRound.characterPosData.chasee, x = _a.x, y = _a.y;
    var tileX = Math.trunc(x / 8);
    var tileY = Math.trunc(y / 8);
    if (gameRound.tilemap.tileHasCoin(tileX, tileY)) {
        server.emit("coinRemoval", { tileX: tileX, tileY: tileY });
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
    var _a = gameRound.characterPosData["chasee"], x = _a.x, y = _a.y;
    var tileX = Math.trunc(x / 8);
    var tileY = Math.trunc(y / 8);
    handleReversePowerup(tileX, tileY);
    handleInvisiblePowerup(tileX, tileY);
}
var invisibleTimerId;
function handleInvisiblePowerup(tileX, tileY) {
    if (gameRound.tilemap.getPowerup(tileX, tileY) === "invisible") {
        // Start invisible
        server.emit("startInvisible", { tileX: tileX, tileY: tileY });
        gameRound.tilemap.removePowerup(tileX, tileY);
        console.log("Invisible powerup");
        // Clear old timeout if exists
        clearTimeout(invisibleTimerId);
        // End invisible
        invisibleTimerId = setTimeout(function () {
            console.log("Invisible powerup end");
            server.emit("endInvisible");
        }, gameRound.invisibleTime);
    }
}
var reverseTimerId;
function handleReversePowerup(tileX, tileY) {
    if (gameRound.tilemap.getPowerup(tileX, tileY) === "reverse") {
        // Start reversal
        server.emit("startReversal", { tileX: tileX, tileY: tileY });
        gameRound.reversed = true;
        gameRound.tilemap.removePowerup(tileX, tileY);
        console.log("Reversal powerup");
        // Clear old timeout if exists
        clearTimeout(reverseTimerId);
        // End a reversal sometime later
        reverseTimerId = setTimeout(function () {
            console.log("Reversal powerup end");
            server.emit("endReversal");
            gameRound.reversed = false;
        }, gameRound.reversalTime);
    }
}
function setDirectionFromGamepad() {
    Object.keys(gameRound.characterPosData)
        .forEach(function (character) {
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
        .forEach(function (character) {
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
    });
}
// Change direction to gamepad direction only if it's ok
function setActualDirection(character) {
    var gamepadDirection = gameRound.characterPosData[character].gamepadDirection;
    gameRound.tilemap.executeCallbackIfCanGo(gameRound.characterPosData[character], gamepadDirection, function () {
        gameRound.characterPosData[character]["actualDirection"] = gamepadDirection;
    });
}
// Stop moving if we can't go
function removeActualDirectionIfCantGo(character) {
    var actualDirection = gameRound.characterPosData[character].actualDirection;
    gameRound.tilemap.executeCallbackIfCanGo(gameRound.characterPosData[character], actualDirection, function () { }, function () {
        gameRound.characterPosData[character]["actualDirection"] = undefined;
    });
}
function handleCollision() {
    if (gameRound.reversed) {
        collidedCharacters()
            .forEach(function (character) {
            delete gameRound.characterPosData[character];
            server.emit("death", character);
        });
    }
    else {
        if (collidedCharacters().length !== 0) {
            endGame("Chasee tagged! Chasers win!");
        }
    }
}
// Returns list of names who collided with chasee
function collidedCharacters() {
    return Object.entries(gameRound.characterPosData)
        .filter(function (_a) {
        var key = _a[0], value = _a[1];
        return key !== 'chasee';
    })
        .reduce(function (acc, _a) {
        var key = _a[0], value = _a[1];
        if (hasCollided(value, gameRound.characterPosData['chasee']))
            return __spreadArrays(acc, [key]);
        else
            return acc;
    }, []);
}
// Ends the game
function endGame(message) {
    global['serverFSM'].gameEnd(message);
}
function removeSocketListeners() {
    console.log("Removing Socket Listeners.");
    Object.values(server.sockets.connected)
        .forEach(function (socket) {
        socket.removeAllListeners("ready");
        socket.removeAllListeners("directionChange");
    });
}
