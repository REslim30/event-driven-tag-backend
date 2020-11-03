// Module that start and end an instance of a  game
var _a = require("rxjs"), interval = _a.interval, fromEvent = _a.fromEvent, from = _a.from;
var _b = require("rxjs/operators"), map = _b.map, filter = _b.filter, zip = _b.zip, take = _b.take, scan = _b.scan, tap = _b.tap;
var playerLocations = require("./playerLocations");
var _ = require("lodash");
var tilemap = require("./tilemap");
var TILE_SIZE = 8;
var server;
// Map of socket-id to data about their player
var connectionsToGame;
// Data about specific characters
var characterData;
// List of observables to unsubscribe
var observables;
module.exports = {
    start: function (io) {
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
    end: function () {
    }
};
function assignCharacterLocations() {
    Object.entries(playerLocations)
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
    var roles = Object.keys(playerLocations)
        .filter(function (value, index) {
        return index < connected.length;
    });
    // For each socket send a role
    from(connected).pipe(zip(from(_.shuffle(roles))), map(function (arr) {
        return { socket: arr[0], role: arr[1] };
    })).subscribe(function (assignment) {
        var socket = assignment.socket, role = assignment.role;
        connectionsToGame[socket.id] = { role: role };
        socket.on("ready", function () {
            socket.emit("role", role);
        });
    });
}
// Stream direction data into connectionsToGame
function getDirectionData() {
    Object.values(server.sockets.connected)
        .forEach(function (socket) {
        var observable = fromEvent(socket, "directionChange").pipe(map(function (direction) {
            return { player: connectionsToGame[socket.id].role, direction: direction };
        }));
        observable.subscribe(function (_a) {
            var player = _a.player, direction = _a.direction;
            characterData[player]["gamepadDirection"] = direction;
        });
    });
}
function sendTimerData() {
    var observable = interval(1000).pipe(take(120), scan(function (acc, cur) { return acc - 1; }, 121), map(function (timeLeft) {
        var sec = "" + timeLeft % 60;
        return Math.trunc(timeLeft / 60) + ":" + sec.padStart(2, "0");
    }));
    observable
        .subscribe(function (timeLeft) {
        server.emit("timerUpdate", timeLeft);
    });
    return observable;
}
function updateMovementData() {
    var observable = interval(55);
    observable
        .subscribe(function (value) {
        // Recalculate directions
        if (value % 8 == 0) {
            setDirectionFromGamepad();
        }
        // Move one pixel
        Object.keys(characterData)
            .forEach(function (character) {
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
        });
        // Emit a position update
        server.emit("positionUpdate", characterData);
    });
    return observable;
}
function setDirectionFromGamepad() {
    Object.keys(characterData)
        .forEach(function (character) {
        setActualDirection(character);
        removeActualDirectionIfCantGo(character);
    });
}
function setActualDirection(character) {
    var gamepadDirection = characterData[character].gamepadDirection;
    executeCallbackIfCanGo(character, gamepadDirection, function () {
        characterData[character]["actualDirection"] = gamepadDirection;
    });
}
// Stop moving if we can't go
function removeActualDirectionIfCantGo(character) {
    var actualDirection = characterData[character].actualDirection;
    executeCallbackIfCanGo(character, actualDirection, function () { }, function () {
        characterData[character]["actualDirection"] = undefined;
    });
}
function executeCallbackIfCanGo(character, direction, callbackIfTrue, callbackIfFalse) {
    if (callbackIfTrue === void 0) { callbackIfTrue = function () { }; }
    if (callbackIfFalse === void 0) { callbackIfFalse = function () { }; }
    var _a = characterData[character], x = _a.x, y = _a.y;
    var tileX = Math.trunc(x / 8);
    var tileY = Math.trunc(y / 8);
    // Only change actual direction if we can move
    switch (direction) {
        case "up":
            if (tilemap.canGo(tileX, tileY - 1))
                callbackIfTrue();
            else
                callbackIfFalse();
            return;
        case "down":
            if (tilemap.canGo(tileX, tileY + 1))
                callbackIfTrue();
            else
                callbackIfFalse();
            return;
        case "left":
            if (tilemap.canGo(tileX - 1, tileY))
                callbackIfTrue();
            else
                callbackIfFalse();
            return;
        case "right":
            if (tilemap.canGo(tileX + 1, tileY))
                callbackIfTrue();
            else
                callbackIfFalse();
            return;
        default:
            return;
    }
}
