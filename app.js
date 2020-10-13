var app = require('express')();
var http = require('http').createServer();
var io = require('socket.io')(http);


io.on('connection', (socket) => {
  socket.on('chat message', (msg) => {
    io.emit('gameupdate', msg)
    console.log('client sent: ' + msg)
  })
});


http.listen(3000, () => {
  console.log('listening on *:3000');
});

