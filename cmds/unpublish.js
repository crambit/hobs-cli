'use strict';

var clui = require('clui');
var request = require('request');
var nconf = require('../utils/config');
var logger = require('../utils/logger');

function action(pack, options) {
  exports.run(pack, options, function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('unpublish')
    .description('Remove a package from the registry')
    .arguments('<package>')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .on('--help', function() {
      console.log('  WARNING:');
      console.log('');
      console.log('    It is generally considered bad behavior to remove a');
      console.log('    package that others are using!');
      console.log('');
      console.log('  Description:');
      console.log('');
      console.log('    This removes a <package> from the registry, deleting its entry and');
      console.log('    removing the associated tarballs. If no registry is specified,');
      console.log('    the default registry will be used.');
      console.log('');
    });

  pm.action(action);
};

exports.run = function(pack, options, done) {
  var spinner = new clui.Spinner('Unpublishing package');

  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry + ' ' + nconf.get('registries:' + registry + ':url'));

  if (!nconf.get('registries:' + registry)) {
    logger.errorMessage('Unknown registry: ' + registry);
    return done(1);
  }

  if (nconf.get('registries:' + registry + ':token')) {
    spinner.start();

    var regUrl = nconf.get('registries:' + registry + ':url');

    // delete registry's package
    request.del({
      url: regUrl + '/api/packages',
      headers: {
        Authorization: 'Bearer ' + nconf.get('registries:' + registry + ':token'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: pack,
      }),
    }, function(err, res, body) {
      spinner.stop();

      if (err) {
        logger.handleError(err);
        return done(1);
      }

      logger.log('packages-unpub (code) => ' + res.statusCode);
      logger.log('packages-unpub (headers) =>\n' + JSON.stringify(res.headers, null, 2));
      logger.log('packages-unpub (body) =>\n' + body);

      switch (res.statusCode) {
        case 204:
          // package was successfully removed from the registry
          logger.successMessage('Done');
          done(0);
          break;

        case 404:
          logger.errorMessage('Not a valid registry: ' + registry + ' ' + regUrl);
          done(1);
          break;

        case 503:
          logger.errorMessage('Unreachable registry: ' + registry + ' ' + regUrl);
          done(1);
          break;

        default:
          logger.errorMessage('registry: ' + body);
          done(1);
      }
    });
  } else {
    logger.errorMessage('First you need to authenticate on this machine using `hobs-cli adduser`');
    done(1);
  }
};
