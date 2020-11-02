//Implementaiton of serverFSM you can find on logbook
var ServerFSM = /** @class */ (function () {
    function ServerFSM() {
        //State variables
        this.LOBBY = 0;
        this.GAME = 1;
        this.state = -1;
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
                console.log("Initializing Game");
                break;
            default:
                console.log("next default");
                break;
        }
    };
    ServerFSM.prototype.clientConnect = function (name) {
        switch (this.state) {
            case this.LOBBY:
                if (this.lobby.length < 5) {
                    this.lobby.push(name);
                    return this.lobby.slice();
                }
                else {
                    return null;
                }
            case this.GAME:
                return null;
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
                // Otherwise return array
                this.lobby.splice(idx, 1);
                return this.lobby.slice();
            case this.GAME:
                idx = this.lobby.findIndex(function (element) { return element == name; });
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
                console.log("Ending Game");
                return this.lobby.slice();
            default:
                throw Error("Undefined state in clientStart: " + this.state);
        }
    };
    return ServerFSM;
}());
;
module.exports = ServerFSM;
