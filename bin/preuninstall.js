'use strict';

var fse = require('fs-extra');
var resolve = require('path').resolve;
var spawn = require('child_process').spawn;
var path = require('../utils/path');

// delete cache
fse.removeSync(path.HOBS_CACHE);

// delete user's hobsrc file
fse.removeSync(path.HOBS_RC);

// uninstall tabtab when compatible shell
var shell = process.env.SHELL && process.env.SHELL.split('/').slice(-1)[0];

if (['zsh', 'bash', 'fish'].indexOf(shell) >= 0) {
  var tabtab = resolve(require.resolve('tabtab'), '../bin/tabtab');
  var uninstall = spawn(tabtab, ['uninstall', '--auto']);

  uninstall.stdout.on('data', function(data) {
    process.stdout.write(data);
  });
  uninstall.stderr.on('data', function(data) {
    process.stderr.write(data);
  });
  uninstall.on('close', function(code) {
    if (code !== 0) {
      process.exit(1);
    }
  });
}
