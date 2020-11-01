// Mocha unit tests for the server FSM
var fsm = require("../ServerFSM");
var assert = require("assert");
describe('ServerFSM', function () {
    it('can be initialized', function () {
        var server = new fsm();
    });
});
