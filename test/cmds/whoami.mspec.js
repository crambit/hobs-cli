'use strict';

var sinon = require('sinon');
var mockery = require('mockery');
var assert = require('chai').assert;

describe('Command Whoami', function() {
  var loggerStub, nconfStub, whoami;

  before(function() {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    loggerStub = {
      log: sinon.stub(),
      print: sinon.stub(),
      errorMessage: sinon.stub(),
    };

    nconfStub = {
      get: sinon.stub(),
    };

    nconfStub.get.withArgs('default_registry').returns('quarry');
    nconfStub.get.withArgs('registries:local').returns('{"url":"fake_url}');
    nconfStub.get.withArgs('registries:quarry').returns('{"url":"fake_url}');
    nconfStub.get.withArgs('registries:quarry:token').returns('fake_token');
    nconfStub.get.withArgs('registries:quarry:username').returns('fake_user');

    // replace the modules with a stub object
    mockery.registerMock('../utils/logger', loggerStub);
    mockery.registerMock('../utils/config', nconfStub);

    whoami = require('../../cmds/whoami');
  });

  after(function() {
    mockery.disable();
  });

  afterEach(function() {
    loggerStub.print.reset();
    loggerStub.errorMessage.reset();
  });

  it('should print the username', function() {
    var code = whoami.run({});
    assert.equal(loggerStub.print.getCall(0).args[0], 'fake_user');
    assert.equal(code, 0);
  });

  it('should return error on unknown registry', function() {
    var code = whoami.run({
      registry: 'noreg'
    });
    assert.equal(loggerStub.errorMessage.getCall(0).args[0], 'Unknown registry: noreg');
    assert.equal(code, 1);
  });

  it('should return without error on not logged in user', function() {
    var code = whoami.run({
      registry: 'local'
    });
    assert.equal(loggerStub.errorMessage.getCall(0).args[0], 'Not logged in to registry: local');
    assert.equal(code, 0);
  });

});
