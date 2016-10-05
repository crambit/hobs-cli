'use strict';

var fs = require('fs');
var resolve = require('path').resolve;
var nconf = require('../utils/config');
var logger = require('../utils/logger');
var path = require('../utils/path');

function actionSync(pack, options) {
  var code = exports.run(pack, options);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('view')
    .description('View registry info on a package')
    .arguments('<package>')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    This command shows data about a <package> and prints it to stdout.');
      console.log('    If no registry is specified, the default registry will be used.');
      console.log('');
    });

  pm.action(actionSync);
};

exports.run = function(pack, options) {
  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry + ' ' + nconf.get('registries:' + registry + ':url'));

  if (!nconf.get('registries:' + registry)) {
    logger.errorMessage('Unknown registry: ' + registry);
    return 1;
  }

  var data;
  try {
    data = fs.readFileSync(resolve(path.HOBS_CACHE, registry));
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.log(err);

      logger.errorMessage('First you need to update hobs-cli\'s cache using `hobs-cli update`');
      return 1;
    }

    logger.handleError(err);
    return 1;
  }

  var match = new RegExp('Package: ' + pack + '$');
  var lineByLine = data.toString().split('\n');

  // package description is 9+1 lines
  for (var i = 0; i < lineByLine.length; i += 10) {
    if (match.test(lineByLine[i])) {

      // print package description
      for (var j = i; j < i + 9; j++) {
        logger.print(lineByLine[j]);
      }

      return 0;
    }
  }

  logger.errorMessage('Package ' + pack + ' not found in registry: ' + registry);
  return 1;
};
