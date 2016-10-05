'use strict';

var clui = require('clui');
var request = require('request');
var nconf = require('../utils/config');
var logger = require('../utils/logger');

function action(options) {
  exports.run(options, function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('logout')
    .description('Log out of the registry')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    Tells the registry to end this token\'s session. This will');
      console.log('    invalidate the token, but also any other token(s) associated to');
      console.log('    your username on the registry. If no registry is specified, the');
      console.log('    default registry will be used.');
      console.log('');
    });

  pm.action(action);
};

exports.run = function(options, done) {
  var spinner = new clui.Spinner('Logging out');

  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry + ' ' + nconf.get('registries:' + registry + ':url'));

  if (!nconf.get('registries:' + registry)) {
    logger.errorMessage('Unknown registry: ' + registry);
    return done(1);
  }

  if (nconf.get('registries:' + registry + ':token')) {
    spinner.start();

    var regUrl = nconf.get('registries:' + registry + ':url');

    // logout from registry
    request.post({
      url: regUrl + '/api/users/logout',
      headers: {
        Authorization: 'Bearer ' + nconf.get('registries:' + registry + ':token'),
      },
    }, function(err, res, body) {
      spinner.stop();

      if (err) {
        logger.handleError(err);
        return done(1);
      }

      logger.log('logout (code) => ' + res.statusCode);
      logger.log('logout (headers) =>\n' + JSON.stringify(res.headers, null, 2));
      logger.log('logout (body) =>\n' + body);

      switch (res.statusCode) {
        case 200:
          // remove username and token associated to this registry
          nconf.clear('registries:' + registry + ':token');
          nconf.clear('registries:' + registry + ':username');
          nconf.save();

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
    logger.errorMessage('Not logged in to registry: ' + registry);
    done(1);
  }
};
