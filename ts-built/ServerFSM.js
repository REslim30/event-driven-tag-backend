var game = require("./game");
//Implementaiton of serverFSM you can find on logbook
var ServerFSM = /** @class */ (function () {
    function ServerFSM(server) {
        //State variables
        this.LOBBY = 0;
        this.GAME = 1;
        this.state = -1;
        this.io = server;
        this.initialize();
        this.lobby = [];
    }
    ServerFSM.prototype.initialize = function () {
        this.next(this.LOBBY);
    };
    ServerFSM.prototype.next = function (nextState) {
        this.state = nextState;
        switch (this.state) {
            case this.LOBBY:
                console.log("Initializing lobby");
                break;
            case this.GAME:
                this.io.emit("gameStart");
                game.start(this.io);
                break;
            default:
                console.log("next default");
                break;
        }
    };
    ServerFSM.prototype.clientConnect = function (name, socket) {
        switch (this.state) {
            case this.LOBBY:
                if (this.lobby.length < 5) {
                    this.lobby.push(name);
                    this.io.emit("lobby", this.lobby);
                }
                else {
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
    };
    ServerFSM.prototype.clientDisconnect = function (name) {
        var idx;
        switch (this.state) {
            case this.LOBBY:
                idx = this.lobby.findIndex(function (element) { return element == name; });
                // Throw error if name not found
                if (idx == -1)
                    throw Error("Could not find lobby member: " + name);
                // Otherwise broadcast array
                this.lobby.splice(idx, 1);
                this.io.emit("lobby", this.lobby);
                return;
            case this.GAME:
                idx = this.lobby.findIndex(function (element) { return element == name; });
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
    };
    ServerFSM.prototype.clientStart = function () {
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
    };
    ServerFSM.prototype.gameEnd = function () {
        switch (this.state) {
            case this.GAME:
                game.end();
                return this.lobby.slice();
            default:
                throw Error("Undefined state in clientStart: " + this.state);
        }
    };
    return ServerFSM;
}());
;
module.exports = ServerFSM;
