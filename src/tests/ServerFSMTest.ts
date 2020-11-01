// Mocha unit tests for the server FSM
const fsm = require("../ServerFSM");
const assert = require("assert");

describe('ServerFSM', function() {
  it('can be initialized', function() {
    let server: ServerFSM = new fsm();
  });
});
