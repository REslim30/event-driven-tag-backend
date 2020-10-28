var server = require('http').createServer();
var io = require('socket.io')(server);
var Rx = require('rxjs');
var Op = require('rxjs/operators');


io.on('connect', (socket) => {
  //One to one connection
  Rx.interval(1000)
    .pipe(
      Op.map(() => 1)
    ).subscribe((value) => {
      socket.emit('random', Math.floor(Math.random()*100));
    });
});


Rx.interval(1000)
  .pipe(
    Op.map(() => 1)
  ).subscribe((value) => {
    io.emit('broadcast', value);
  });

server.listen(3000);
