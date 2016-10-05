'use strict';

var prettyjson = require('prettyjson');
var nconf = require('../utils/config');
var logger = require('../utils/logger');

function actionSync(action, key, value, options) {
  var code = exports.run(action, key, value, options);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('config')
    .description('Manage hobs-cli configuration file')
    .arguments('<action> [key] [value]')
    .option('-j, --json',
      'show raw JSON data')
    .usage('set <key> [<value>]\n' +
      '         config get [<key>]\n' +
      '         config delete <key>\n' +
      '         config list');

  pm.action(actionSync);
};

exports.run = function(action, key, value, options) {
  switch (action) {
    case 'set':
      if (key) {
        if (value) {
          nconf.set(key, value);
        } else {
          nconf.set(key, 'true');
        }
        nconf.save();
      } else {
        logger.errorMessage('Unknown command. See `hobs-cli config --help`');
        return 1;
      }
      break;

    case 'get':
      if (key) {
        logger.print(nconf.get(key));
      } else {
        if (options.json) {
          logger.print(JSON.stringify(nconf.load(), null, 4));
        } else {
          logger.print(prettyjson.render(nconf.load()));
        }
      }
      break;

    case 'delete':
      if (key) {
        nconf.clear(key);
        nconf.save();
      } else {
        logger.errorMessage('Unknown command. See `hobs-cli config --help`');
        return 1;
      }
      break;

    case 'list':
      if (options.json) {
        logger.print(JSON.stringify(nconf.load(), null, 4));
      } else {
        logger.print(prettyjson.render(nconf.load()));
      }
      break;

    default:
      logger.errorMessage('Unknown command. See `hobs-cli config --help`');
      return 1;
  }

  return 0;
};
