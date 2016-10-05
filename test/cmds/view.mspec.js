'use strict';

var sinon = require('sinon');
var mockery = require('mockery');
var assert = require('chai').assert;
var resolve = require('path').resolve;

describe('Command View', function() {
  var pathStub, loggerStub, nconfStub, view;

  before(function() {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    pathStub = {
      HOBS_CACHE: resolve(__dirname, '../fixtures/.hobs/cache'),
    };

    loggerStub = {
      log: sinon.stub(),
      print: sinon.stub(),
      errorMessage: sinon.stub(),
    };

    nconfStub = {
      get: sinon.stub(),
    };

    nconfStub.get.withArgs('default_registry').returns('quarry');
    nconfStub.get.withArgs('registries:quarry').returns('{"url":"fake_url}');
    nconfStub.get.withArgs('registries:quarry:token').returns('fake_token');
    nconfStub.get.withArgs('registries:quarry:username').returns('fake_user');

    // replace the modules with a stub object
    mockery.registerMock('../utils/path', pathStub);
    mockery.registerMock('../utils/logger', loggerStub);
    mockery.registerMock('../utils/config', nconfStub);

    view = require('../../cmds/view');
  });

  after(function() {
    mockery.disable();
  });

  afterEach(function() {
    loggerStub.print.reset();
    loggerStub.errorMessage.reset();
  });

  it('should print the package definition', function() {
    var code = view.run('health', {});
    assert.equal(loggerStub.print.getCall(0).args[0], 'Package: health');
    assert.equal(code, 0);
  });

  it('should return error on unknown registry', function() {
    var code = view.run('health', {
      registry: 'noreg'
    });
    assert.equal(loggerStub.errorMessage.getCall(0).args[0], 'Unknown registry: noreg');
    assert.equal(code, 1);
  });

  it('should return error on not found package', function() {
    var code = view.run('nopack', {});
    assert.equal(loggerStub.errorMessage.getCall(0).args[0], 'Package nopack not found in registry: quarry');
    assert.equal(code, 1);
  });

});
