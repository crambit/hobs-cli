'use strict';

var nconf = require('../utils/config');
var logger = require('../utils/logger');

function actionSync(options) {
  var code = exports.run(options);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('whoami')
    .description('Display registry username')
    .option('-r, --registry <name>',
      'the name of the horus package registry');

  pm.action(actionSync);
};

exports.run = function(options) {
  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry + ' ' + nconf.get('registries:' + registry + ':url'));

  if (!nconf.get('registries:' + registry)) {
    logger.errorMessage('Unknown registry: ' + registry);
    return 1;
  }

  if (nconf.get('registries:' + registry + ':token')) {
    logger.print(nconf.get('registries:' + registry + ':username'));
    return 0;
  } else {
    logger.errorMessage('Not logged in to registry: ' + registry);
    return 0;
  }
};
