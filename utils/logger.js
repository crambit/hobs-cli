'use strict';

var fs = require('fs');
var util = require('util');
var platform = require('platform');
var colors = require('colors');
var path = require('./path');
var pjson = require('../package.json');

/**
 * Print to stdout.
 */

exports.print = function() {
  console.log(util.format.apply(this, arguments));
};

var logMessages = [];

/**
 * Setup logging and messaging to handle log file, debug mode and spinner.
 *
 * Log to file only, spinner has no effect:
 *     exports.log('log entry', true);
 *
 * Log to file + [debug], no spinner:
 *     exports.log('log entry');
 *
 * Log to file + [debug], active spinner:
 *     exports.log('log entry', spinner);
 *
 * Log to file + [debug], active spinner + update spinner message:
 *     exports.log('log entry', spinner, true);
 */

exports.log = (function(debugMode) {
  return function(logEntry, noPrint, updateMsg) {
    logMessages.push(logEntry);

    if (!noPrint && debugMode) {
      console.error('--debug-- '.cyan + logEntry);
    } else if (typeof noPrint === 'object') {
      // noPrint is a spinner
      var spinner = noPrint;

      if (debugMode || updateMsg) {
        spinner.stop();

        if (debugMode) {
          console.error('--debug-- '.cyan + logEntry);
        }

        if (updateMsg) {
          spinner.message(logEntry);
        }

        spinner.start();
      }
    }
  };
})(process.argv.indexOf('--debug') !== -1 || process.argv.indexOf('-d') !== -1);

/**
 * Print success message.
 */

exports.successMessage = function successMessage() {
  var msg = util.format.apply(this, arguments);
  exports.log('Success: ' + msg, true);
  console.log('> '.bold.green + msg + '\n');
};

/**
 * Print error message.
 */

exports.errorMessage = function errorMessage() {
  var msg = util.format.apply(this, arguments);
  exports.log('Error: ' + msg, true);
  console.log('> '.bold.red + msg + '\n');
};

/**
 * Handle unexpected errors.
 */

exports.handleError = function handleError(err) {
  if (err) {
    if (err.message) {
      exports.errorMessage(err.message);
    } else {
      exports.errorMessage(err);
    }
  }

  console.log('Please include the following file with any support request:');
  console.log('    ' + path.LOG_PATH);

  try {
    fs.writeFileSync(path.LOG_PATH, logMessages.join('\n') + '\n');
  } catch (err) {
    console.error(err);
  }
};

/**
 * Log debugging meta info.
 */

exports.log('hobs-cli version ' + pjson.version);
exports.log('platform => ' + platform.description);
exports.log('command => ' + process.argv.join(' '));
exports.log('');
