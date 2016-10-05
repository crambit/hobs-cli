'use strict';

var expect = require('chai').expect;
var mockery = require('mockery');

describe('Util Logger', function() {
  var pathStub, logger;

  before(function() {
    mockery.enable({
      warnOnReplace: false,
      warnOnUnregistered: false,
      useCleanCache: true
    });

    pathStub = {
      LOG_PATH: '/dev/null',
    };

    // replace the modules with a stub object
    mockery.registerMock('./path', pathStub);

    logger = require('../../utils/logger');
  });

  it('should handle error', function() {
    var err = new Error('fake error');

    expect(function() {
      logger.handleError(err);
    }).to.not.throw(Error);
  });

});
