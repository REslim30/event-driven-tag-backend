var TileMap = require("./tilemap");
var shuffle = require("lodash").shuffle;
var from = require("rxjs").from;
var _a = require("rxjs/operators"), map = _a.map, filter = _a.filter, zip = _a.zip;
// Data about specific characters
var GameRound = /** @class */ (function () {
    function GameRound(io) {
        // Hyper parameters
        this.TILE_SIZE = 8; // in pixes
        this.gameTime = 150; // in sec
        this.reversalTime = 15000; // in msec
        this.invisibleTime = 15000; // in msec
        this.connectionsToRole = new Map();
        this.reversed = false;
        this.tilemap = new TileMap();
        this.characterPosData = {
            chasee: { x: -1, y: -1 },
            chaser0: { x: -1, y: -1 },
            chaser1: { x: -1, y: -1 },
            chaser2: { x: -1, y: -1 },
            chaser3: { x: -1, y: -1 }
        };
        this.assignCharacterLocations();
        this.assignRoles(io);
    }
    // Helper functions
    GameRound.prototype.assignCharacterLocations = function () {
        var _this = this;
        Object.entries(this.tilemap.characterLocations)
            .forEach(function (_a) {
            var key = _a[0], value = _a[1];
            _this.characterPosData[key]['x'] = value.tileX * _this.TILE_SIZE + (_this.TILE_SIZE / 2);
            _this.characterPosData[key]['y'] = value.tileY * _this.TILE_SIZE + (_this.TILE_SIZE / 2);
        });
    };
    // Assign roles to connected players. 
    // Ensure that at least one is chasee
    GameRound.prototype.assignRoles = function (server) {
        var _this = this;
        // Get array of sockets and array of roles
        var connected = Object.values(server.sockets.connected);
        var roles = Object.keys(this.tilemap.characterLocations)
            .filter(function (value, index) {
            return index < connected.length;
        });
        // For each socket assign a role
        from(connected).pipe(zip(from(shuffle(roles))), map(function (arr) {
            return { socket: arr[0], role: arr[1] };
        })).subscribe(function (assignment) {
            _this.assignSocketARole(assignment);
        });
    };
    GameRound.prototype.assignSocketARole = function (assignment) {
        var socket = assignment.socket, role = assignment.role;
        this.connectionsToRole[socket.id] = role;
        socket.on("ready", function () {
            socket.emit("role", role);
        });
    };
    return GameRound;
}());
module.exports = GameRound;
