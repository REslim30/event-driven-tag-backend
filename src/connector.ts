// Script that initializes server and listens to connections
// While registering events on the serverFSM
var Rx = require("rxjs");
var Op = require("rxjs/operators");
const io: SocketIO.Server = require("socket.io")(3000);
const fsm = require("./ServerFSM");

console.log("Listening on port: 3000");

// Initialize ServerFSM instance
let serverFSM: ServerFSM = new fsm(io);
global['serverFSM'] = serverFSM;

// Listen to connection events
let connectionStream = Rx.fromEvent(io, "connection");

// Reject any connections that do not include a name as query param
connectionStream.pipe(
  Op.filter((socket: SocketIO.Socket) => {
    return socket.handshake.query.name === undefined;
  })
).subscribe((socket: SocketIO.Socket) => {
  console.log("Client doesn't contain name. Rejecting.");
  socket.disconnect();
});

// Accept any connections that include a name as query param
// !!! Cold Observable
let acceptedConnectionStream = connectionStream.pipe(
  Op.filter((socket: SocketIO.Socket) => {
    return socket.handshake.query.name !== undefined;
  }),
  // First connect client to stream. Only continue if client
  // has not being rejected
  Op.filter((socket: SocketIO.Socket) => {
    serverFSM.clientConnect(socket.handshake.query.name, socket);
    return socket.connected;
  })
);


// Register clientDisconnect and start and clientStart
acceptedConnectionStream
  .subscribe((socket: SocketIO.Socket) => {
    console.log("connected client: " + socket.handshake.query.name);
    // Register clientDisconnect
    Rx.fromEvent(socket, "disconnect")
      .subscribe((reason: string) => {
        console.log("client " + socket.handshake.query.name + " disconnected: " + reason);
        serverFSM.clientDisconnect(socket.handshake.query.name);
        // Register update to lobby
      });

    // register clientStart
    Rx.fromEvent(socket, "startClick")
      .subscribe(() => {
        serverFSM.clientStart();
      });

    socket.on("lobbyRequest", () => {
      serverFSM.lobbyRequest(socket);
    });
  });
