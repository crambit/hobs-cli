'use strict';

var tab = require('tabtab')();

exports.init = function(binName) {
  tab.on(binName, function(data, done) {
    done(null, [
      'adduser',
      'config',
      'deploy',
      'init',
      'install',
      'login',
      'logout',
      'publish',
      'registry',
      'sandbox',
      'search',
      'sync',
      'template',
      'unpublish',
      'update',
      'view',
      'whoami'
    ]);
  });

  tab.start();
};
