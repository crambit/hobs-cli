'use strict';

var clui = require('clui');
var request = require('request');
var fse = require('fs-extra');
var async = require('async');
var resolve = require('path').resolve;
var nconf = require('../utils/config');
var logger = require('../utils/logger');
var path = require('../utils/path');

function action() {
  exports.run(function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('update')
    .description('Update local package index')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    This command synchronizes your local hobs-cli cache with the');
      console.log('    latest changes in the configured registries.');
      console.log('');
    });

  pm.action(action);
};

var spinner = new clui.Spinner('Updating cache');

/**
 * Parse multipart byte ranges mime.
 */

function parseMultipartByteranges(body, contentType, callback) {
  var match = contentType.match(/boundary=(.*)$/);

  if (!match) {
    return callback();
  }

  var boundary = match[1];
  var reg = new RegExp('\(\?:\\r\\n)\?--' + boundary + '\(\?:--\)\?\\r\\n');
  var parts = body.split(reg);
  var ranges = {};

  async.eachSeries(parts, function(part, cb) {
    if (part.match(/\A\s*\Z/)) {
      return cb();
    }

    var sections = part.split('\r\n\r\n', 2);
    var partHeader = sections[0];
    var partBody = sections[1];

    if (!partBody) {
      return cb();
    }

    var headerLines = partHeader.split('\r\n');
    var headers = [];

    for (var i = 0; i < headerLines.length; i++) {
      var stripLine = headerLines[i].replace(/(\r\n|\n|\r)/gm, '');
      var attr = stripLine.split(/:\s*/, 2);
      if (!attr[1]) {
        return cb();
      }

      headers[attr[0].toLowerCase()] = attr[1];
    }

    var contentRange = headers['content-range'];

    if (!contentRange) {
      return cb();
    }

    var bytesMatch = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (!bytesMatch) {
      return cb();
    }

    var offset = parseInt(bytesMatch[1]);
    var length = parseInt(bytesMatch[2]);

    ranges[offset] = partBody.substring(0, length);

    cb();
  }, function() {
    callback(ranges);
  });
}

/**
 * Diff with actual index cache to check for missing packages.
 */

function diffCache(index, data, callback) {
  var missingPackages = [];
  var removedPackages = 0;
  var cache = data ? data.toString().split('\n') : [];
  var j = 0;

  // check for packages to update
  for (var i = 0; i < index.length - 1; i++) {
    var del1 = index[i].indexOf('@');
    var del2 = index[i].indexOf('[');
    var del3 = index[i].indexOf(']');
    var name = index[i].substring(0, del1);
    var version = index[i].substring(del1 + 1, del2);
    var bytes = index[i].substring(del2 + 1, del3);

    var nameMatch = new RegExp('Package: ' + name + '$');
    var versionMatch = new RegExp('Version: ' + version + '$');

    if (nameMatch.test(cache[j * 10])) {
      if (versionMatch.test(cache[j * 10 + 2])) {
        j++;
      } else {
        cache.splice(j * 10, 10);
        missingPackages.push(bytes);
      }
    } else {
      if (cache[j * 10] && name > cache[j * 10].substring(9)) {
        cache.splice(j * 10, 10);
        removedPackages++;
        i--;
      } else {
        missingPackages.push(bytes);
      }
    }
  }

  // clean up remaining packages
  var remainingPackages = Math.trunc((cache.length - (j * 10)) / 10);
  if (remainingPackages > 0) {
    cache.splice(j * 10, remainingPackages * 10);
    removedPackages += remainingPackages;
  }

  // cleaned up cache content
  var updatedCache = cache.join('\n');

  callback(updatedCache, missingPackages, removedPackages);
}

/**
 * Assemble range request header.
 */

function buildRangeRequest(missingPackages, indexLength) {
  var totalBytes = 0;

  for (var i = 0; i < missingPackages.length; i++) {
    var size = missingPackages[i].split('-');
    totalBytes += size[1] - size[0];
  }

  var headers = {};
  if (missingPackages.length < (indexLength - 1)) {
    logger.log('Fetching ' + missingPackages.length + '/' + (indexLength - 1) +
      ' package description(s) [' + totalBytes + ' B]', spinner, true);
    headers = {
      Range: 'bytes=' + missingPackages.join(),
    };
  } else {
    logger.log('Fetching ' + (indexLength - 1) +
      ' package description(s) [' + totalBytes + ' B]', spinner, true);
  }

  return headers;
}

exports.run = function(done) {
  logger.log('Local cache ' + path.HOBS_CACHE + ' will be synced');
  var registries = nconf.get('registries');

  spinner.start();

  var fetchErrors = [];
  var statusMsg = '';

  async.forEachOfSeries(registries, function(reg, regName, callback) {
    logger.log('Updating cache from ' + regName + ' ' + reg.url, spinner, true);

    fse.readFile(resolve(path.HOBS_CACHE, regName), function(err, data) {
      if (err) {
        if (err.code === 'ENOENT') {
          logger.log(err, true);

          try {
            // create the registry's cache if it doesn't exist already
            fse.ensureFileSync(resolve(path.HOBS_CACHE, regName));
          } catch (err) {
            return callback(err);
          }
        } else {
          return callback(err);
        }
      }

      // get registry's package index
      request.get({
        url: reg.url + '/api/packages.index',
        headers: {
          'If-None-Match': nconf.get('index_etag') || null,
        },
      }, function(err, res, body) {
        if (err) {
          return callback(err);
        }

        logger.log('packages-index (code) => ' + res.statusCode, spinner);
        logger.log('packages-index (headers) =>\n' + JSON.stringify(res.headers, null, 2), spinner);
        logger.log('packages-index (body) =>\n' + body, spinner);

        switch (res.statusCode) {
          case 200:
            nconf.set('index_etag', res.headers.etag);

            // update package index
            var index = body.split('\n');

            diffCache(index, data, function(updatedCache, missingPackages, removedPackages) {
              if (missingPackages.length === 0) {
                if (removedPackages === 0) {
                  logger.log('Already up to date', spinner);
                  return callback();
                } else {
                  logger.log('Removing ' + removedPackages + ' package description(s)', spinner);

                  try {
                    fse.writeFileSync(resolve(path.HOBS_CACHE, regName), updatedCache);
                  } catch (err) {
                    return callback(err);
                  }

                  return callback();
                }
              }

              if (removedPackages !== 0) {
                logger.log('Removing ' + removedPackages + ' package description(s)', spinner);
              }

              var headers = buildRangeRequest(missingPackages, index.length);

              // get registry's package list
              request.get({
                url: reg.url + '/api/packages.list',
                headers: headers,
              }, function(err, res, body) {
                if (err) {
                  return callback(err);
                }

                logger.log('packages-list (code) => ' + res.statusCode, spinner);
                logger.log('packages-list (headers) =>\n' + JSON.stringify(res.headers, null, 2), spinner);
                logger.log('packages-list (body) =>\n' + body, spinner);

                // process response
                if (res.headers['content-type'].indexOf('multipart/byteranges') === -1) {
                  if (res.headers['content-range']) {
                    var key = res.headers['content-range'].substring(6).split('/')[0].split('-')[0];

                    updatedCache = updatedCache.slice(0, key) + body + updatedCache.slice(key);
                    fse.writeFile(resolve(path.HOBS_CACHE, regName), updatedCache, callback);
                  } else {
                    fse.writeFile(resolve(path.HOBS_CACHE, regName), body, callback);
                  }
                } else {
                  parseMultipartByteranges(body, res.headers['content-type'], function(ranges) {
                    async.forEachOfSeries(ranges, function(value, key, cb) {
                      if (!updatedCache.slice(0, key)) {
                        value += '\n';
                      }

                      updatedCache = updatedCache.slice(0, key) + value + updatedCache.slice(key);
                      cb();
                    }, function() {
                      fse.writeFile(resolve(path.HOBS_CACHE, regName), updatedCache, callback);
                    });
                  });
                }
              });
            });
            break;

          case 304:
            logger.log('Content is fresh, returned immediately without hitting the endpoint', spinner);

            callback();
            break;

          case 404:
            statusMsg = 'Not a valid registry: ' + regName + ' ' + reg.url;
            logger.log(statusMsg, spinner);

            // add message to status array
            fetchErrors.push(statusMsg);

            callback();
            break;

          case 503:
            statusMsg = 'Unreachable registry: ' + regName + ' ' + reg.url;
            logger.log(statusMsg, spinner);

            // add message to status array
            fetchErrors.push(statusMsg);

            callback();
            break;

          default:
            statusMsg = 'Registry: ' + regName + ' ' + reg.url + ' returned code ' + res.statusCode;
            logger.log(statusMsg, spinner);

            // add message to status array
            fetchErrors.push(statusMsg);

            callback();
        }
      });
    });
  }, function(err) {
    spinner.stop();

    if (err) {
      if (err instanceof Error) {
        logger.handleError(err);
      } else {
        logger.errorMessage(err);
      }

      return done(1);
    }

    // set last updated date
    nconf.set('last_updated', new Date());
    nconf.save();

    if (fetchErrors.length > 0) {
      logger.errorMessage(fetchErrors.join('\n'));
    } else {
      logger.successMessage('Done');
    }

    done(0);
  });
};
