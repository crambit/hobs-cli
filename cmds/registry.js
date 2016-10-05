'use strict';

var fse = require('fs-extra');
var resolve = require('path').resolve;
var prettyjson = require('prettyjson');
var nconf = require('../utils/config');
var logger = require('../utils/logger');
var path = require('../utils/path');

function actionSync(action, name, url, options) {
  var code = exports.run(action, name, url, options);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('registry')
    .description('Manage registries')
    .arguments('<action> [name] [url]')
    .option('-j, --json',
      'show raw JSON data')
    .usage('add <name> <url>\n' +
      '         registry remove <name>\n' +
      '         registry default <name>\n' +
      '         registry list');

  pm.action(actionSync);
};

exports.run = function(action, name, url, options) {
  switch (action) {
    case 'add':
      if (name && url) {
        nconf.set('registries:' + name + ':url', url);
        nconf.save();
        fse.ensureFileSync(resolve(path.HOBS_CACHE, name + '_cookies.json'));
      } else {
        logger.errorMessage('Unknown command. See `hobs-cli registry --help`');
        return 1;
      }
      break;

    case 'remove':
      if (name) {
        nconf.clear('registries:' + name);
        nconf.save();
        fse.removeSync(resolve(path.HOBS_CACHE, name));
        fse.removeSync(resolve(path.HOBS_CACHE, name + '_cookies.json'));
      } else {
        logger.errorMessage('Unknown command. See `hobs-cli registry --help`');
        return 1;
      }
      break;

    case 'default':
      if (name) {
        if (nconf.get('registries:' + name)) {
          nconf.set('default_registry', name);
          nconf.save();
        } else {
          logger.errorMessage('You must add ' + name + ' as a registry first using `hobs-cli registry add`');
          return 1;
        }
      } else {
        logger.errorMessage('Unknown command. See `hobs-cli registry --help`');
        return 1;
      }
      break;

    case 'list':
      if (options.json) {
        logger.print(JSON.stringify(nconf.load().registries, null, 4));
      } else {
        logger.print(prettyjson.render(nconf.load().registries));
      }
      break;

    default:
      logger.errorMessage('Unknown command. See `hobs-cli registry --help`');
      return 1;
  }

  return 0;
};
