// Module that start and end an instance of a  game
var _a = require("rxjs"), interval = _a.interval, fromEvent = _a.fromEvent, from = _a.from;
var _b = require("rxjs/operators"), map = _b.map, filter = _b.filter, zip = _b.zip, take = _b.take, scan = _b.scan;
var playerLocations = require("./playerLocations");
var _ = require("lodash");
var TILE_SIZE = 8;
var server;
// Map of socket-id to data about their player
var connectionsToGame;
// Data about specific characters
var characterData = {
    chasee: {},
    chaser0: {},
    chaser1: {},
    chaser2: {},
    chaser3: {}
};
module.exports = {
    start: function (io) {
        server = io;
        connectionsToGame = {};
        assignCharacterLocations();
        assignRoles(server);
        getDirectionData();
        interval(1000).pipe(take(120), scan(function (acc, cur) { return acc - 1; }, 121), map(function (timeLeft) {
            var sec = "" + timeLeft % 60;
            return Math.trunc(timeLeft / 60) + ":" + sec.padStart(2, "0");
        })).subscribe(function (timeLeft) {
            server.emit("timerUpdate", timeLeft);
        });
    },
    end: function () {
        console.log("Game Ended");
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
        fromEvent(socket, "directionChange").pipe(map(function (direction) {
            return { player: connectionsToGame[socket.id].role, direction: direction };
        })).subscribe(function (playerDirection) {
        });
    });
}
