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
var shuffle = require("lodash").shuffle;
var TileMap = require("./tilemap");
var hasCollided = require("./collisionCalc").hasCollided;
// Hyper parameters
var TILE_SIZE = 8; // in pixes
var gameTime = 150; // in sec
var reversalTime = 15000; // in msec
var invisibleTime = 15000; // in msec
var server;
// Map of socket-id to data about their player
var connectionsToRole;
// Data about specific characters
var characterData;
// States
var reversed;
// Map
var tilemap;
module.exports = {
    // Subject we use to end our streams
    endStream: null,
    // Initialize game
    start: function (io) {
        this.endStream = new Subject();
        // sync initialization
        initialize(io);
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
function initialize(io) {
    server = io;
    connectionsToRole = new Map();
    reversed = false;
    tilemap = new TileMap();
    characterData = {
        chasee: { x: -1, y: -1 },
        chaser0: { x: -1, y: -1 },
        chaser1: { x: -1, y: -1 },
        chaser2: { x: -1, y: -1 },
        chaser3: { x: -1, y: -1 }
    };
    assignCharacterLocations();
    assignRoles(server);
}
function assignCharacterLocations() {
    Object.entries(tilemap.characterLocations)
        .forEach(function (_a) {
        var key = _a[0], value = _a[1];
        characterData[key]['x'] = value.tileX * TILE_SIZE + (TILE_SIZE / 2);
        characterData[key]['y'] = value.tileY * TILE_SIZE + (TILE_SIZE / 2);
    });
}
// Assign roles to connected players. 
// Ensure that at least one is chasee
function assignRoles(server) {
    // Get array of sockets and array of roles
    var connected = Object.values(server.sockets.connected);
    var roles = Object.keys(tilemap.characterLocations)
        .filter(function (value, index) {
        return index < connected.length;
    });
    // For each socket assign a role
    from(connected).pipe(zip(from(shuffle(roles))), map(function (arr) {
        return { socket: arr[0], role: arr[1] };
    })).subscribe(function (assignment) {
        assignSocketARole(assignment);
    });
}
function assignSocketARole(assignment) {
    var socket = assignment.socket, role = assignment.role;
    connectionsToRole[socket.id] = role;
    socket.on("ready", function () {
        socket.emit("role", role);
    });
}
// Stream direction data into connectionsToRole
function getDirectionData(endStream) {
    Object.values(server.sockets.connected)
        .forEach(function (socket) {
        subscribeToDirectionalData(socket, endStream);
    });
}
function subscribeToDirectionalData(socket, endStream) {
    fromEvent(socket, "directionChange").pipe(takeUntil(endStream), map(function (direction) {
        return { player: connectionsToRole[socket.id], direction: direction };
    })).subscribe({
        next: function (_a) {
            var player = _a.player, direction = _a.direction;
            characterData[player]["gamepadDirection"] = direction;
        },
        error: function () { },
        completed: function () {
            console.log("Directional Data listener complete.");
        }
    });
}
function sendTimerData(endStream) {
    interval(1000).pipe(take(gameTime), scan(function (acc, cur) { return acc - 1; }, gameTime), map(function (timeLeft) {
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
            server.emit("positionUpdate", characterData);
        },
        error: function (err) { },
        complete: function () {
            console.log("Movement Updater complete");
        }
    });
}
function handleCoin() {
    var _a = characterData.chasee, x = _a.x, y = _a.y;
    var tileX = Math.trunc(x / 8);
    var tileY = Math.trunc(y / 8);
    if (tilemap.tileHasCoin(tileX, tileY)) {
        server.emit("coinRemoval", { tileX: tileX, tileY: tileY });
        tilemap.removeCoin(tileX, tileY);
        handleEndState();
    }
}
function handleEndState() {
    if (tilemap.coinsEmpty()) {
        endGame("All coins are collected! Chasee wins!");
    }
}
function handlePowerup() {
    var _a = characterData["chasee"], x = _a.x, y = _a.y;
    var tileX = Math.trunc(x / 8);
    var tileY = Math.trunc(y / 8);
    handleReversePowerup(tileX, tileY);
    handleInvisiblePowerup(tileX, tileY);
}
var invisibleTimerId;
function handleInvisiblePowerup(tileX, tileY) {
    if (tilemap.getPowerup(tileX, tileY) === "invisible") {
        // Start invisible
        server.emit("startInvisible", { tileX: tileX, tileY: tileY });
        tilemap.removePowerup(tileX, tileY);
        console.log("Invisible powerup");
        // Clear old timeout if exists
        clearTimeout(invisibleTimerId);
        // End invisible
        invisibleTimerId = setTimeout(function () {
            console.log("Invisible powerup end");
            server.emit("endInvisible");
        }, invisibleTime);
    }
}
var reverseTimerId;
function handleReversePowerup(tileX, tileY) {
    if (tilemap.getPowerup(tileX, tileY) === "reverse") {
        // Start reversal
        server.emit("startReversal", { tileX: tileX, tileY: tileY });
        reversed = true;
        tilemap.removePowerup(tileX, tileY);
        console.log("Reversal powerup");
        // Clear old timeout if exists
        clearTimeout(reverseTimerId);
        // End a reversal sometime later
        reverseTimerId = setTimeout(function () {
            console.log("Reversal powerup end");
            server.emit("endReversal");
            reversed = false;
        }, reversalTime);
    }
}
function setDirectionFromGamepad() {
    Object.keys(characterData)
        .forEach(function (character) {
        // Do nothing if the character is dead
        if (characterData[character] === undefined)
            return;
        setActualDirection(character);
        removeActualDirectionIfCantGo(character);
    });
}
function moveCharactersSinglePixel() {
    // Move one pixel
    Object.keys(characterData)
        .forEach(function (character) {
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
    });
}
// Change direction to gamepad direction only if it's ok
function setActualDirection(character) {
    var gamepadDirection = characterData[character].gamepadDirection;
    tilemap.executeCallbackIfCanGo(characterData[character], gamepadDirection, function () {
        characterData[character]["actualDirection"] = gamepadDirection;
    });
}
// Stop moving if we can't go
function removeActualDirectionIfCantGo(character) {
    var actualDirection = characterData[character].actualDirection;
    tilemap.executeCallbackIfCanGo(characterData[character], actualDirection, function () { }, function () {
        characterData[character]["actualDirection"] = undefined;
    });
}
function handleCollision() {
    if (reversed) {
        collidedCharacters()
            .forEach(function (character) {
            delete characterData[character];
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
    return Object.entries(characterData)
        .filter(function (_a) {
        var key = _a[0], value = _a[1];
        return key !== 'chasee';
    })
        .reduce(function (acc, _a) {
        var key = _a[0], value = _a[1];
        if (hasCollided(value, characterData['chasee']))
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
