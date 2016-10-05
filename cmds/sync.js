'use strict';

var exec = require('../utils/exec');
var path = require('../utils/path');
var logger = require('../utils/logger');

function actionSync(branch) {
  var code = exports.run(branch);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('sync')
    .description('Sync local sandbox with remote')
    .arguments('[branch]')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    A wrapper around the `git checkout` and `git pull` commands that');
      console.log('    locally incorporates changes from your Hobs sandbox and/or the');
      console.log('    workspace master branch. You can choose to sync either "sandbox",');
      console.log('    "master" or both if you omit to specify a branch.');
      console.log('');
    });

  pm.action(actionSync);
};

var overview = '';

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

  logger.log('Synchronizing ' + branch, true);
  logger.print('──> Synchronizing ' + branch);
}

/**
 * Pull sandbox changes from remote.
 */

function pullChanges() {
  var pull = exec.sync('git', ['pull']);
  logger.log(pull.stdout.toString('utf8').trim());
  logger.log(pull.stderr.toString('utf8').trim());

  if (pull.error) {
    logger.handleError(pull.error);
    return 1;
  }

  if (pull.status === 0) {
    if (pull.stderr) {
      overview += pull.stderr.toString('utf8').trim();
    }

    if (pull.stdout) {
      logger.print(pull.stdout.toString('utf8').trim());
    }
  } else {
    if (pull.stderr) {
      logger.print(pull.stderr.toString('utf8').trim());
    }

    logger.errorMessage('Git command failed');
    return 1;
  }
}

exports.run = function(branch) {
  var branches = [];

  // make sure git is installed
  if (!path.GIT_BIN) {
    logger.errorMessage('Sorry, this command requires `git`');
    return 1;
  }

  if (branch) {
    if (branch !== 'sandbox' && branch !== 'master') {
      logger.errorMessage('Not a valid branch: ' + branch);
      return 1;
    }

    branches.push(branch);
  } else {
    branches = ['master', 'sandbox'];
  }

  for (var i = 0; i < branches.length; i++) {
    // checkout
    if (checkoutBranch(branches[i]) === 1) {
      return 1;
    }

    // pull
    if (pullChanges() === 1) {
      return 1;
    }
  }

  if (overview) {
    logger.print('──> Overview');
    logger.print(overview);
  }

  logger.successMessage('Done');
  return 0;
};
