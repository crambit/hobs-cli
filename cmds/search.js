'use strict';

var fs = require('fs');
var resolve = require('path').resolve;
var nconf = require('../utils/config');
var logger = require('../utils/logger');
var path = require('../utils/path');

function actionSync(terms) {
  var code = exports.run(terms);
  process.exit(code);
}

exports.cmd = function(program) {
  var pm = program
    .command('search')
    .description('Search for packages')
    .arguments('<terms...>')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    Search the local hobs-cli cache for packages matching the search <terms>.');
      console.log('    Please note that it performs a logical OR search of the terms unless');
      console.log('    specified as a phrase.');
      console.log('');
    });

  pm.action(actionSync);
};

exports.run = function(terms) {
  var registries = nconf.get('registries');

  for (var reg in registries) {
    if (registries.hasOwnProperty(reg)) {
      var cachePath = resolve(path.HOBS_CACHE, reg);

      var data;
      try {
        data = fs.readFileSync(cachePath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          logger.log(err);

          logger.errorMessage('First you need to update hobs-cli\'s cache using `hobs-cli update`');
          return 1;
        }

        logger.handleError(err);
        return 1;
      }

      var lineByLine = data.toString().split('\n');
      var len = lineByLine.length;

      // package description is 9+1 lines
      for (var i = 0; i < len - 1; i += 10) {
        var match = false;

        // attempt to match with package name
        for (var j = 0; j < terms.length; j++) {
          if (lineByLine[i]
            .substring(9)
            .toLowerCase()
            .indexOf(terms[j].toLowerCase()) !== -1) {
            match = true;
            break;
          }
        }

        if (!match) {
          // attempt to match with package description
          for (var k = 0; k < terms.length; k++) {
            if (lineByLine[i + 3]
              .substring(13)
              .toLowerCase()
              .indexOf(terms[k].toLowerCase()) !== -1) {
              match = true;
              break;
            }
          }
        }

        if (!match) {
          // attempt to match with package tags
          for (var l = 0; l < terms.length; l++) {
            if (lineByLine[i + 5]
              .substring(6)
              .toLowerCase()
              .indexOf(terms[l].toLowerCase()) !== -1) {
              match = true;
              break;
            }
          }
        }

        if (match) {
          // format matching results
          logger.print(lineByLine[i].substring(9) + ' - ' +
            lineByLine[i + 3].substring(13) + ' (' + reg + ')');

          logger.log(cachePath + ':' + (i + 1));
        }
      }
    }
  }

  return 0;
};
