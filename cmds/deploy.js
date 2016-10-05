'use strict';

var wrap = require('word-wrap');
var colors = require('colors');
var sync = require('./sync');
var prompt = require('../utils/prompt');
var logger = require('../utils/logger');
var exec = require('../utils/exec');
var path = require('../utils/path');

function action() {
  exports.run(function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('deploy')
    .description('Deploy to workspace')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    A wrapper around the `git commit` and `git push` commands that');
      console.log('    sends locally committed changes to your Horus sandbox and triggers');
      console.log('    a Riemann configuration reload in the workspace.');
      console.log('');
    });

  pm.action(action);
};

/**
 * Ask user whether sandbox should be synced now.
 */

function syncSandbox(done) {
  prompt.get({
    name: 'sync',
    description: '\nWould you like to sync your local \'sandbox\' now?'.bold,
    type: 'string',
    pattern: /y[es]*|n[o]?/,
    message: 'You must respond [y]es or [n]o',
    default: 'yes',
    required: false,
  }, function(err, result) {
    if (err) {
      logger.errorMessage(err.message);
      return done(1);
    }

    if (/n[o]?/.test(result.sync)) {
      logger.successMessage('Done');
      return done(0);
    }

    // redirect to sync command
    done(sync.run());
  });
}

/**
 * Push changes to remote sandbox.
 */

function pushToRemote(done) {
  var push = exec.async('git', ['push', 'origin', 'sandbox']);

  push.stdout.on('data', function(data) {
    logger.print(data.toString('utf8').trim());
    logger.log(data.toString('utf8').trim(), true);
  });

  push.stderr.on('data', function(data) {
    logger.print(data.toString('utf8').trim());
    logger.log(data.toString('utf8').trim(), true);
  });

  push.on('error', function(err) {
    logger.handleError(err);
    done(1);
  });

  push.on('close', function(code) {
    if (code === 0) {
      syncSandbox(done);
    } else {
      logger.errorMessage('Git command failed');
      done(1);
    }
  });
}

/**
 * Format deploy message.
 */

function formatMessage(message) {
  var maxLineWidth = 100;

  var wrapOptions = {
    trim: true,
    newline: '\n',
    indent: '',
    width: maxLineWidth,
  };

  // hard limit this line
  var head = (message.subject.trim()).slice(0, maxLineWidth);

  // wrap this line at 100 characters
  var body = wrap(message.body, wrapOptions);

  message = 'deploy! ' + head + '\n\n' + body;
  logger.log(message);

  return message;
}

/**
 * Commit changes on the sandbox branch.
 */

function commitChanges(message) {
  var commit = exec.sync('git', ['commit', '--allow-empty', '-m', message]);
  logger.log(commit.stdout.toString('utf8').trim());
  logger.log(commit.stderr.toString('utf8').trim());

  if (commit.error) {
    logger.handleError(commit.error);
    return 1;
  }

  if (commit.status !== 0) {
    if (commit.stderr) {
      logger.print(commit.stderr.toString('utf8').trim());
    }

    logger.errorMessage('Git command failed');
    return 1;
  }
}

/**
 * Make sure we checked out the sandbox branch.
 */

function checkoutBranch(branch) {
  var checkout = exec.sync('git', ['checkout', branch]);
  logger.log(checkout.stdout.toString('utf8').trim());
  logger.log(checkout.stderr.toString('utf8').trim());

  if (checkout.error) {
    logger.handleError(checkout.error);
    return 1;
  }

  if (checkout.status !== 0) {
    if (checkout.stderr) {
      logger.print(checkout.stderr.toString('utf8').trim());
    }

    logger.errorMessage('Git command failed');
    return 1;
  }
}

exports.run = function(done) {
  // make sure git is installed
  if (!path.GIT_BIN) {
    logger.errorMessage('Sorry, this command requires `git`');
    return done(1);
  }

  logger.print('Line 1 will be cropped at 100 characters. All other lines will be wrapped after 100 characters.');
  logger.print('');

  prompt.get({
    properties: {
      subject: {
        description: 'Write a short description of the changes:'.bold,
        type: 'string',
        message: 'Description cannot be empty',
        required: true,
      },
      body: {
        description: '\nAdd an optional extended description:'.bold,
        type: 'string',
      },
    },
  }, function(err, result) {
    if (err) {
      logger.errorMessage(err.message);
      return done(1);
    }

    // checkout
    if (checkoutBranch('sandbox') === 1) {
      return done(1);
    }

    // commit
    var message = formatMessage(result);
    if (commitChanges(message) === 1) {
      return done(1);
    }

    // push
    pushToRemote(done);
  });
};
