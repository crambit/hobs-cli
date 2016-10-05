'use strict';

var sinon = require('sinon');
var mockery = require('mockery');
var assert = require('chai').assert;

describe('Command Adduser', function() {
  var loggerStub, promptStub, requestStub, nconfStub, adduser;

  before(function() {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    loggerStub = {
      log: sinon.stub(),
      successMessage: sinon.stub(),
    };

    promptStub = {
      get: sinon.stub(),
    };

    nconfStub = {
      get: sinon.stub(),
      set: sinon.stub(),
      save: sinon.stub(),
    };

    requestStub = {
      post: sinon.stub(),
    };

    nconfStub.get.withArgs('default_registry').returns('quarry');
    nconfStub.get.withArgs('registries:quarry').returns('{"url":"fake_url}');
    nconfStub.get.withArgs('registries:quarry:token').returns('fake_token');
    nconfStub.get.withArgs('registries:quarry:username').returns('fake_user');

    // replace the modules with a stub object
    mockery.registerMock('../utils/logger', loggerStub);
    mockery.registerMock('../utils/prompt', promptStub);
    mockery.registerMock('../utils/config', nconfStub);
    mockery.registerMock('request', requestStub);

    adduser = require('../../cmds/adduser');
  });

  after(function() {
    mockery.disable();
  });

  afterEach(function() {
    nconfStub.set.reset();
    loggerStub.successMessage.reset();
  });

  it('can authenticate with token', function(done) {
    var token = 'fake_token';
    adduser.run({
      token: token
    }, function(code) {
      if (code !== 0) {
        return done(code);
      }

      assert.equal(nconfStub.set.getCall(0).args[1], token);
      assert.equal(nconfStub.set.getCall(1).args[1], 'unknown');
      assert.equal(loggerStub.successMessage.getCall(0).args[0], 'Done');
      done();
    });
  });

  it('can authenticate with username+password', function(done) {
    var username = 'fake_user';
    var token = 'fake_token';

    promptStub.get.yields(null, {
      'username': username,
      'password': 'fake_password',
    });
    requestStub.post.yields(null, {
      statusCode: 200
    }, JSON.stringify({
      'name': username,
      'registry': 'fake_url',
      'token': token,
    }));

    adduser.run({}, function(code) {
      if (code !== 0) {
        return done(code);
      }

      assert.equal(nconfStub.set.getCall(0).args[1], token);
      assert.equal(nconfStub.set.getCall(1).args[1], username);
      assert.equal(loggerStub.successMessage.getCall(0).args[0], 'Done');
      done();
    });
  });

  it('can register a new user', function(done) {
    var username = 'fake_user';
    var token = 'fake_token';

    promptStub.get.yields(null, {
      'username': username,
      'password': 'fake_password',
      'email': 'fake_email@example.net',
    });
    requestStub.post.yields(null, {
      statusCode: 403
    }, {});
    requestStub.post.yields(null, {
      statusCode: 200
    }, JSON.stringify({
      'name': username,
      'registry': 'fake_url',
      'token': token,
    }));

    adduser.run({}, function(code) {
      if (code !== 0) {
        return done(code);
      }

      assert.equal(nconfStub.set.getCall(0).args[1], token);
      assert.equal(nconfStub.set.getCall(1).args[1], username);
      assert.equal(loggerStub.successMessage.getCall(0).args[0], 'Done');
      done();
    });
  });

});
