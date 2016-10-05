'use strict';

var fse = require('fs-extra');
var nconf = require('nconf');
var resolve = require('path').resolve;
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
