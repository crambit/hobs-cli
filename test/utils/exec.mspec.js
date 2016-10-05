'use strict';

var assert = require('chai').assert;

describe('Util Exec', function() {
  var exec;

  before(function() {
    exec = require('../../utils/exec');
  });

  it('should spawn async process', function(done) {
    var echo = exec.async('echo', ['hello world']);

    echo.stdout.on('data', function(data) {
      assert.equal(data.toString('utf8').trim(), 'hello world');
    });

    echo.on('close', function(code) {
      assert.equal(code, 0);
      done();
    });
  });

  it('should spawn sync process', function() {
    var echo = exec.sync('echo', ['hello world']);
    assert.equal(echo.stdout.toString('utf8').trim(), 'hello world');
    assert.equal(echo.status, 0);
  });

});
