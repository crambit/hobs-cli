'use strict';

var fse = require('fs-extra');
var nconf = require('nconf');
var resolve = require('path').resolve;
var spawn = require('child_process').spawn;
var path = require('../utils/path');

// create cache & quarry cookie jar file
fse.mkdirsSync(path.HOBS_CACHE);
fse.ensureFileSync(resolve(path.HOBS_CACHE, 'quarry_cookies.json'));

// load user's hobsrc file
nconf.file({
  file: path.HOBS_RC
}).load();

// set quarry as default package registry
nconf.set('registries:quarry:url', 'https://quarry.crambit.com');
nconf.set('default_registry', 'quarry');
nconf.save();

// install tabtab when compatible shell
var shell = process.env.SHELL && process.env.SHELL.split('/').slice(-1)[0];

if (['zsh', 'bash', 'fish'].indexOf(shell) >= 0) {
  var tabtab = resolve(require.resolve('tabtab'), '../bin/tabtab');
  var install = spawn(tabtab, ['install', '--auto']);

  install.stdout.on('data', function(data) {
    process.stdout.write(data);
  });
  install.stderr.on('data', function(data) {
    process.stderr.write(data);
  });
  install.on('close', function(code) {
    if (code !== 0) {
      process.exit(1);
    }
  });
}
