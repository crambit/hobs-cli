'use strict';

var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;

exports.async = function(cmd, args, opts) {
  opts = opts || {};
  return spawn(cmd, args || [], opts);
};

exports.sync = function(cmd, args, opts) {
  opts = opts || {};
  return spawnSync(cmd, args || [], opts);
};
