'use strict';

var colors = require('colors');
var prompt = require('prompt');

// initialize prompt
prompt.message = '';
prompt.delimiter = '';
prompt.colors = false;

// turn off colors when non-interactive
colors.mode = process.stdout.isTTY ? colors.mode : 'none';

module.exports = prompt;
