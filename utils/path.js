'use strict';

var resolve = require('path').resolve;
var exec = require('./exec');

exports.LOG_PATH = resolve(process.cwd(), 'hobs-debug.log');

exports.HOBS_CACHE = process.platform === 'win32' ?
  resolve(process.env.APPDATA, 'hobs', 'cache') :
  resolve(process.env.HOME, '.hobs', 'cache');

exports.HOBS_RC = process.platform === 'win32' ?
  resolve(process.env.APPDATA, 'hobs', '.hobsrc') :
  resolve(process.env.HOME, '.hobsrc');

/**
 * Check whether git is installed
 */

exports.GIT_BIN = function() {
  var cmd;
  var args;

  if (process.platform === 'win32') {
    cmd = 'where';
    args = ['git', '>nul'];
  } else {
    cmd = 'which';
    args = 'git';
  }

  var git = exec.sync(cmd, args);
  return git.status === 0 ?
    true : false;
};
