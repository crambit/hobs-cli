'use strict';

exports.cmd = function(program) {

  var pm = program
    .command('login')
    .description('Alias to `adduser`')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .option('-t, --token <token>',
      'force the use of a specific token for authentication');

  pm.action(function() {
    // redirect command
    process.argv[2] = 'adduser';
    program.parse(process.argv);
  });
};
