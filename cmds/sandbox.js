'use strict';

var validUrl = require('valid-url');
var exec = require('../utils/exec');
var path = require('../utils/path');
var logger = require('../utils/logger');

function actionSync(url) {
  var code = exports.run(url);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('sandbox')
    .description('Clone a remote sandbox')
    .arguments('<url>')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    A wrapper around the `git clone` command that creates remote-');
      console.log('    tracking branches for your Horus sandbox and the workspace master');
      console.log('    branch. <url> is the sandbox repository URL to clone from.');
      console.log('');
    });

  pm.action(actionSync);
};

exports.run = function(url) {
  if (validUrl.isUri(url)) {

    // make sure git is installed
    if (!path.GIT_BIN) {
      logger.errorMessage('Sorry, this command requires `git`');
      return 1;
    }

    var clone = exec.sync('git', ['clone', '-b', 'sandbox', url]);
    logger.log(clone.stdout.toString('utf8').trim());
    logger.log(clone.stderr.toString('utf8').trim());

    if (clone.error) {
      logger.handleError(clone.error);
      return 1;
    }

    if (clone.stderr) {
      logger.print(clone.stderr.toString('utf8').trim());
    }

    if (clone.status === 0) {
      logger.successMessage('Done');
    } else {
      logger.errorMessage('Git command failed');
      return 1;
    }

    return 0;
  } else {
    logger.errorMessage('Invalid URL: ' + url);
    return 1;
  }
};
