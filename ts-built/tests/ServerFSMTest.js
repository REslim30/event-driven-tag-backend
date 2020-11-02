// Mocha unit tests for the server FSM
var FSM = require("../ServerFSM");
var _a = require("assert"), throws = _a.throws, equal = _a.equal, deepEqual = _a.deepEqual;
describe('ServerFSM', function () {
    // Server FSM and socket.io server
    var server;
    beforeEach(function () {
        // Initialize server FSM and socket.io serever
        server = new FSM();
    });
    it('can be initialized', function () {
        new FSM();
    });
    it('can connect a client and send lobby', function () {
        deepEqual(["Huy"], server.clientConnect("Huy"));
        deepEqual(["Huy", "Ian"], server.clientConnect("Ian"));
    });
    it('can reject after lobby reaches 5', function () {
        server.clientConnect("Huy");
        server.clientConnect("Huy");
        server.clientConnect("Huy");
        server.clientConnect("Huy");
        server.clientConnect("Huy");
        equal(null, server.clientConnect('Should be Null'));
    });
    it('can reject client when in game state', function () {
        server.clientConnect("Huy");
        server.clientStart();
        deepEqual(null, server.clientConnect("Should be Rejected"));
    });
    it('can disconnect a player', function () {
        server.clientConnect("Huy");
        server.clientConnect("Ian");
        deepEqual(["Ian"], server.clientDisconnect("Huy"));
    });
    it('throws an error if player not found', function () {
        server.clientConnect("Bob");
        throws(function () { server.clientDisconnect("Huy"); }, Error);
    });
    it('returns a immutable array', function () {
        var arr = server.clientConnect("Huy");
        arr.splice(0, 1);
        deepEqual(["Huy", "Ian"], server.clientConnect("Ian"));
    });
    it('Handles clientDisconnect corrently when in game state', function () {
        server.clientConnect("Huy");
        server.clientStart();
        equal(null, server.clientDisconnect("Huy"));
        deepEqual(["newer"], server.clientConnect("newer"));
    });
    it('Does nothing when in clientStart and lobby empty or in game state', function () {
        server.clientStart();
        server.clientConnect("Huy");
        server.clientStart();
        server.clientStart();
        throw Error("Not Sure how to implement yet");
    });
    it('Starts the game', function () {
        server.clientConnect("Huy");
        server.clientStart();
        throw Error("Not sure how to implement yet");
    });
    it('ends a game', function () {
        server.clientConnect("Huy");
        server.clientStart();
        server.gameEnd();
    });
});
