var http = require('http').createServer();
var io = require('socket.io')(http);
var Rx = require('rx');


Rx.Observable
  .interval(1000)
  .map(() => Math.floor(Math.random()*100))
  .subscribe((number) => {
    io.emit('random', number);
  });


http.listen(3000, () => {
  console.log('listening on *:3000');
});

