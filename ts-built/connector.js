// Script that initializes server and listens to connections
// While registering events on the serverFSM
var Rx = require("rxjs");
var Op = require("rxjs/operators");
var io = require("socket.io")(3000);
var fsm = require("./ServerFSM");
console.log("Listening on port: 3000");
// Initialize ServerFSM instance
var serverFSM = new fsm(io);
// Listen to connection events
var connectionStream = Rx.fromEvent(io, "connection");
// Reject any connections that do not include a name as query param
connectionStream.pipe(Op.filter(function (socket) {
    return socket.handshake.query.name === undefined;
})).subscribe(function (socket) {
    console.log("Client doesn't contain name. Rejecting.");
    socket.disconnect();
});
// Accept any connections that include a name as query param
// !!! Cold Observable
var acceptedConnectionStream = connectionStream.pipe(Op.filter(function (socket) {
    return socket.handshake.query.name !== undefined;
}), 
// First connect client to stream. Only continue if client
// has not being rejected
Op.filter(function (socket) {
    serverFSM.clientConnect(socket.handshake.query.name, socket);
    return socket.connected;
}));
// Register clientDisconnect and start and clientStart
acceptedConnectionStream
    .subscribe(function (socket) {
    console.log("connected client: " + socket.handshake.query.name);
    // Register clientDisconnect
    Rx.fromEvent(socket, "disconnect")
        .subscribe(function (reason) {
        console.log("client " + socket.handshake.query.name + " disconnected: " + reason);
        serverFSM.clientDisconnect(socket.handshake.query.name);
        // Register update to lobby
    });
    // register clientStart
    Rx.fromEvent(socket, "startClick")
        .subscribe(function () {
        serverFSM.clientStart();
    });
});
