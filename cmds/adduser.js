'use strict';

var clui = require('clui');
var request = require('request');
var nconf = require('../utils/config');
var prompt = require('../utils/prompt');
var logger = require('../utils/logger');

function action(options) {
  exports.run(options, function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('adduser')
    .description('Add a registry user account')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .option('-t, --token <token>',
      'force the use of a specific token for authentication')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    Create or verify a user named <username> in the specified');
      console.log('    registry, and save the credentials to the .hobsrc file.');
      console.log('    The username, password, and email are read in from prompts.');
      console.log('');
      console.log('    If a <token> option is passed, this token will be directly saved');
      console.log('    to the .hobsrc file without prompting for credentials.');
      console.log('');
      console.log('    If no registry is specified, the default registry will be used.');
      console.log('');
      console.log('  Alias: login');
      console.log('');
    });

  pm.action(action);
};

var spinner = new clui.Spinner('Logging in');

/**
 * Register user on the registry.
 */

function createUser(registry, user, done) {
  var regUrl = nconf.get('registries:' + registry + ':url');

  logger.log('Creating user', spinner, true);

  // register user on registry
  request.post({
    url: regUrl + '/api/users',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: user.username,
      password: user.password,
      email: user.email,
    }),
  }, function(err, res, body) {
    spinner.stop();

    if (err) {
      logger.handleError(err);
      return done(1);
    }

    logger.log('adduser (code) => ' + res.statusCode);
    logger.log('adduser (headers) =>\n' + JSON.stringify(res.headers, null, 2));
    logger.log('adduser (body) =>\n' + body);

    if (res.statusCode === 201) {
      var data = JSON.parse(body);
      nconf.set('registries:' + registry + ':token', data.token);
      nconf.set('registries:' + registry + ':username', user.username);
      nconf.save();

      logger.successMessage('Done');
      done(0);
    } else {
      logger.errorMessage('registry: ' + body);
      done(1);
    }
  });
}

/**
 * Authenticate user against the registry.
 */

function authenticateUser(registry, user, done) {
  spinner.start();

  var regUrl = nconf.get('registries:' + registry + ':url');
  var auth = 'Basic ' + new Buffer(user.username + ':' + user.password).toString('base64');

  // authenticate to registry
  request.post({
    url: regUrl + '/api/users',
    headers: {
      Authorization: auth,
    },
  }, function(err, res, body) {
    if (err) {
      spinner.stop();
      logger.handleError(err);
      return done(1);
    }

    logger.log('login (code) => ' + res.statusCode, spinner);
    logger.log('login (headers) =>\n' + JSON.stringify(res.headers, null, 2), spinner);
    logger.log('login (body) =>\n' + body, spinner);

    switch (res.statusCode) {
      case 403:
        if (!user.email) {
          spinner.stop();
          logger.errorMessage('registry: ' + body);
          return done(1);
        }

        createUser(registry, user, done);
        break;

      case 200:
        spinner.stop();

        var data = JSON.parse(body);
        nconf.set('registries:' + registry + ':token', data.token);
        nconf.set('registries:' + registry + ':username', user.username);
        nconf.save();

        logger.successMessage('Done');
        done(0);
        break;

      case 404:
        spinner.stop();

        logger.errorMessage('Not a valid registry: ' + registry + ' ' +
          nconf.get('registries:' + registry + ':url'));
        done(1);
        break;

      case 503:
        spinner.stop();

        logger.errorMessage('Unreachable registry: ' + registry + ' ' +
          nconf.get('registries:' + registry + ':url'));
        done(1);
        break;

      default:
        spinner.stop();

        logger.errorMessage('registry: ' + body);
        done(1);
    }
  });
}

/**
 * Prompt user for credentials.
 */

function promptUser(registry, done) {
  var regUrl = nconf.get('registries:' + registry + ':url');

  prompt.get({
    properties: {
      username: {
        description: 'Username for \'' + regUrl + '\': ',
        type: 'string',
        message: 'Username cannot be empty',
        required: true,
      },
      password: {
        description: 'Password for \'' + regUrl + '\': ',
        type: 'string',
        hidden: true,
        replace: '*',
        message: 'Password cannot be empty',
        required: true,
      },
      email: {
        description: 'Email: (only IF registering) ',
        type: 'string',
        format: 'email',
        message: 'Oops! That looks like an invalid email address',
        required: false,
      },
    },
  }, function(err, result) {
    if (err) {
      logger.errorMessage(err.message);
      return done(1);
    }

    authenticateUser(registry, result, done);
  });
}

exports.run = function(options, done) {
  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry + ' ' + nconf.get('registries:' + registry + ':url'));

  if (!nconf.get('registries:' + registry)) {
    logger.errorMessage('Unknown registry: ' + registry);
    return done(1);
  }

  if (options.token) {
    nconf.set('registries:' + registry + ':token', options.token);
    nconf.set('registries:' + registry + ':username', 'unknown');
    nconf.save();
    logger.successMessage('Done');
    done(0);
  } else {
    promptUser(registry, done);
  }
};
