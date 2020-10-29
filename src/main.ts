const Rx = require("rxjs");
const server = require("http").createServer();
const io = require("socket.io")(server);

Rx.interval(1000)
    .subscribe((value: number) => io.emit("broadcast", value));

io.on('connect', (socket: any) => {
    //One to one connection
    console.log("connected");
});


server.listen(3000);
