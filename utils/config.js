'use strict';

var nconf = require('nconf');
var logger = require('./logger');
var path = require('./path');

// load .hobsrc config
try {
  nconf.file({
    file: path.HOBS_RC
  }).load();
} catch (err) {
  logger.handleError(err);
}

module.exports = nconf;
