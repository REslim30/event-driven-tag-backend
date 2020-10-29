var Rx = require("rxjs");
var server = require("http").createServer();
var io = require("socket.io")(server);
Rx.interval(1000)
    .subscribe(function (value) { return io.emit("broadcast", value); });
io.on('connect', function (socket) {
    //One to one connection
    console.log("connected");
});
server.listen(3000);
