// Module that start and end an instance of a  game
var _a = require("rxjs"), fromEvent = _a.fromEvent, from = _a.from;
var _b = require("rxjs/operators"), map = _b.map, filter = _b.filter, zip = _b.zip;
var playerLocations = require("./playerLocations");
var _ = require("lodash");
var server;
// Map of socket-id to data about their player
var connectionsToGame;
module.exports = {
    start: function (io) {
        server = io;
        connectionsToGame = {};
        assignRoles(server);
        Object.values(server.sockets.connected)
            .forEach(function (socket) {
            fromEvent(socket, "directionChange").pipe(map(function (direction) {
                return { player: connectionsToGame[socket.id].role, direction: direction };
            })).subscribe(function (obj) {
                console.log(obj);
            });
        });
    },
    end: function () {
        console.log("Game Ended");
    }
};
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
