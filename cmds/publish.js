'use strict';

var clui = require('clui');
var request = require('request');
var validUrl = require('valid-url');
var resolve = require('path').resolve;
var tar = require('tar');
var zlib = require('zlib');
var fstreamIgnore = require('fstream-ignore');
var nconf = require('../utils/config');
var logger = require('../utils/logger');

function action(pack, options) {
  exports.run(pack, options, function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('publish')
    .description('Publish a package')
    .arguments('<package>')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    Publishes a package to the registry so that it can be installed by');
      console.log('    name. A package is either a <folder> containing a valid horus.json');
      console.log('    file or a <git url> that resolves to a Horus package in the root');
      console.log('    of your project or in a .horus subdirectory. The following fields');
      console.log('    are required as a minimum:');
      console.log('');
      console.log('        name       : Package name');
      console.log('        version    : Package version');
      console.log('        engines    : The version of Riemann required.');
      console.log('        author     : Package author');
      console.log('');
      console.log('    In the case of a <folder>, all files in the package directory are');
      console.log('    included if no local .gitignore or .hobsignore file exists.');
      console.log('');
      console.log('    If no registry is specified, the default registry will be used.');
      console.log('');
    });

  pm.action(action);
};

var spinner = new clui.Spinner('Publishing package');

/**
 * Publish a package at a given URL to the registry.
 */

function publishRemotePackage(registry, pack, done) {
  var regUrl = nconf.get('registries:' + registry + ':url');

  // package is a url
  logger.log('Publishing package at ' + pack +
    ' to registry: ' + registry, spinner, true);

  // publish package on registry
  request.post({
    url: regUrl + '/api/packages',
    headers: {
      Authorization: 'Bearer ' + nconf.get('registries:' + registry + ':token'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pack,
    }),
  }, function(err, res, body) {
    spinner.stop();

    if (err) {
      logger.handleError(err);
      return done(1);
    }

    logger.log('packages-pub (code) => ' + res.statusCode);
    logger.log('packages-pub (headers) =>\n' + JSON.stringify(res.headers, null, 2));
    logger.log('packages-pub (body) =>\n' + body);

    switch (res.statusCode) {
      case 201:
        logger.successMessage('Done');
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
}

/**
 * Compress and publish a local package to the registry.
 */

function publishLocalPackage(registry, pack, done) {
  var regUrl = nconf.get('registries:' + registry + ':url');

  // package is a local folder
  var horusConfig;
  try {
    horusConfig = require(resolve(process.cwd(), pack, 'horus.json'));
  } catch (err) {
    spinner.stop();
    logger.handleError(err);
    return done(1);
  }

  logger.log('horus.json =>\n' + JSON.stringify(horusConfig, null, 2), spinner);
  logger.log('Publishing ' + horusConfig.name + '@' + horusConfig.version +
    ' to registry: ' + registry, spinner, true);

  var r = request.post({
    url: regUrl + '/api/packages',
    headers: {
      Authorization: 'Bearer ' + nconf.get('registries:' + registry + ':token'),
    },
  });

  fstreamIgnore({
      path: resolve(process.cwd(), pack),
      ignoreFiles: ['.gitignore', '.hobsignore'],
    })
    .pipe(tar.Pack({
      fromBase: true
    }))
    .pipe(zlib.createGzip())
    .pipe(r);

  r.on('error', function(err) {
    spinner.stop();
    logger.handleError(err);
    done(1);
  });

  r.on('response', function(res) {
    spinner.stop();

    logger.log('packages-pub (code) => ' + res.statusCode);
    logger.log('packages-pub (headers) =>\n' + JSON.stringify(res.headers, null, 2));

    switch (res.statusCode) {
      case 201:
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
        r.on('data', function(data) {
          logger.errorMessage('registry: ' + data.toString('utf8'));
          return done(1);
        });
    }
  });
}

exports.run = function(pack, options, done) {
  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry + ' ' + nconf.get('registries:' + registry + ':url'));

  if (!nconf.get('registries:' + registry)) {
    logger.errorMessage('Unknown registry: ' + registry);
    return done(1);
  }

  if (nconf.get('registries:' + registry + ':token')) {
    spinner.start();

    if (validUrl.isUri(pack)) {
      publishRemotePackage(registry, pack, done);
    } else {
      publishLocalPackage(registry, pack, done);
    }
  } else {
    logger.errorMessage('First you need to authenticate on this machine using `hobs-cli adduser`');
    done(1);
  }
};
