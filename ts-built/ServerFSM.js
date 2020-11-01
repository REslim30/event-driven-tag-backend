//Implementaiton of serverFSM you can find on logbook
var ServerFSM = /** @class */ (function () {
    function ServerFSM() {
        //State variables
        this.LOBBY = 0;
        this.GAME = 1;
        this.state = -1;
        this.initialize();
    }
    ServerFSM.prototype.initialize = function () {
        this.next(this.LOBBY);
    };
    ServerFSM.prototype.next = function (nextState) {
        this.state = nextState;
        switch (this.state) {
            default:
                console.log("next default");
                break;
        }
    };
    return ServerFSM;
}());
;
module.exports = ServerFSM;
