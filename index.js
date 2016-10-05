'use strict';

var program = require('commander');
var didyoumean = require('didyoumean');
var commands = require('./utils/load-command');
var completion = require('./utils/completion');
var pjson = require('./package.json');

// auto-complete commands
completion.init(Object.keys(pjson.bin)[0]);

// load commands
commands.load(program);

program
  .version('hobs-cli version ' + pjson.version)
  .usage('<command>')
  .option('-d, --debug', 'show debug info');

program
  .on('*', function(name) {
    // bypass if shell completion scripts
    if (name[0] !== 'completion') {
      console.log('`' + name + '` is not a known command. See `hobs-cli --help`.\n');

      var d = didyoumean(name.toString(), program.commands, '_name');

      if (d) {
        console.log('Did you mean this?');
        console.log('       ', d);
      }

      process.exit(1);
    }
  });

program.parse(process.argv);

if (program.args.length < 1) {
  console.log('No command specified. See `hobs-cli --help`:');
  program.outputHelp();
  process.exit(1);
}
