'use strict';

var assert = require('chai').assert;
var exec = require('child_process').exec;
var path = require('path');

describe('validation', function() {
  it('Expect it to be true', function() {
    assert.isTrue(true);
  });
});

describe('hobs-cli bin', function() {
  var cmd = 'node ' + path.join(__dirname, '../../bin/hobs-cli') + ' ';

  it('--help should run without errors', function(done) {
    exec(cmd + '--help', function(error, stdout, stderr) {
      assert(!error);
      done();
    });
  });

  it('--version should run without errors', function(done) {
    exec(cmd + '--version', function(error, stdout, stderr) {
      assert(!error);
      done();
    });
  });

  it('should return error on missing command', function(done) {
    exec(cmd, function(error, stdout, stderr) {
      assert(error);
      assert.equal(error.code, 1);
      done();
    });

  });

  it('should return error on unknown command', function(done) {
    exec(cmd + 'junkcmd', function(error, stdout, stderr) {
      assert(error);
      assert.equal(error.code, 1);
      done();
    });
  });

});
