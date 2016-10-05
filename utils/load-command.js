'use strict';

var fs = require('fs');
var join = require('path').join;

exports.load = function(program) {
  fs.readdirSync(join(__dirname, '../cmds')).forEach(function(cmd) {
    if (cmd.match(/\.js$/) !== null) {
      require(join('../cmds', cmd)).cmd(program);
    }
  });
};
