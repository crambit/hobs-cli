'use strict';

var clui = require('clui');
var fse = require('fs-extra');
var yaml = require('js-yaml');
var request = require('request');
var colors = require('colors');
var tar = require('tar');
var zlib = require('zlib');
var crypto = require('crypto');
var FileCookieStore = require('tough-cookie-filestore');
var ngu = require('normalize-git-url');
var validUrl = require('valid-url');
var async = require('async');
var resolve = require('path').resolve;
var basename = require('path').basename;
var nconf = require('../utils/config');
var exec = require('../utils/exec');
var logger = require('../utils/logger');
var path = require('../utils/path');

function action(pack, options) {
  exports.run(pack, options, function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('install')
    .description('Install a package')
    .arguments('<package>')
    .option('-r, --registry <name>',
      'the name of the horus package registry')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    This command installs a package, and any packages that it depends');
      console.log('    on. A package is a <name>@<version> or just a <name> to install');
      console.log('    the latest version indexed in the local hobs-cli cache. It can also');
      console.log('    be a <git url> that resolves to an Hobs package.');
      console.log('');
      console.log('    Each package is extracted to its own folder in the current working');
      console.log('    directory. If a package of the same name already exists, the one');
      console.log('    with the latest version will always prevail, preserving any');
      console.log('    properties priorly set.');
      console.log('');
      console.log('    If no registry is specified, the default registry will be used.');
      console.log('');
    });

  pm.action(action);
};

var spinner = new clui.Spinner('Installing');
var packages = [];

/**
 * Add registry metadata to package.
 */

function addMetadata(name, registry, options, callback) {
  var horusConfig;
  var horusConfigPath = resolve(process.cwd(), name, 'horus.json');

  try {
    delete require.cache[require.resolve(horusConfigPath)];
    horusConfig = require(horusConfigPath);
  } catch (err) {
    return callback(err);
  }

  horusConfig._registry = registry;

  try {
    fse.writeFileSync(horusConfigPath, JSON.stringify(horusConfig, null, 2));
  } catch (err) {
    return callback(err);
  }

  // install package dependencies
  async.forEachOfSeries(horusConfig.dependencies, function(vers, mod, cb) {
    var opts = {
      registry: registry,
      dependency: true,
    };

    installFromRegistry(registry, mod + '@' + vers, opts, cb);
  }, callback);
}

/**
 * Merge package properties with existing ones.
 */

function writeProperties(config, file) {
  var newConfig;
  try {
    newConfig = yaml.safeLoad(fse.readFileSync(file));
  } catch (err) {
    return logger.log(err, true);
  }

  // merge properties
  for (var attr in config) {
    newConfig[attr] = config[attr];
  }

  try {
    var dump = yaml.safeDump(newConfig);

    fse.writeFileSync(file, dump);
  } catch (err) {
    return logger.log(err, true);
  }
}

/**
 * Download a package.
 */

function download(name, version, size, sha256sum, registry, options, callback) {
  var dst = resolve(process.cwd(), name);

  fse.stat(dst, function(err) {
    var config;

    if (!err) {
      // folder already exists, check which version is higher
      var horusConfig;
      var horusConfigPath = resolve(process.cwd(), name, 'horus.json');

      try {
        delete require.cache[require.resolve(horusConfigPath)];
        horusConfig = require(horusConfigPath);
      } catch (err) {
        logger.log(err, spinner);

        err.message = 'Destination folder already exists but it\'s not a valid Hobs package: ' + dst;
        err.name = 'ResourceConflict';
        return callback(err);
      }

      if (version <= horusConfig.version) {
        // version is not higher, skipping
        return callback();
      }

      // backup properties.yml of existing package
      try {
        config = yaml.safeLoad(fse.readFileSync(resolve(process.cwd(), name, 'properties.yml'), 'utf8'));
      } catch (err) {
        // nothing to backup
        logger.log(err, spinner);
      }
    }

    // remove old package, if needed
    fse.remove(dst, function(err) {
      if (err) {
        return callback(err);
      }

      var hash = crypto.createHash('sha256');
      var arrow = options.dependency ? ' ├── ' : '└┬── ';
      var url = nconf.get('registries:' + registry + ':url') +
        '/api/packages/' + name + '/download?version=' + version;

      // download package from registry
      var j = request.jar(new FileCookieStore(resolve(path.HOBS_CACHE, registry + '_cookies.json')));
      var r = request.get({
        url: url,
        jar: j
      });

      r.on('data', function(data) {
          hash.update(data, 'utf8');
        })
        .on('error', function(err) {
          callback(err);
        })
        .on('response', function(res) {
          logger.log('packages-inst (code) => ' + res.statusCode, spinner);
          logger.log('packages-inst (headers) =>\n' + JSON.stringify(res.headers, null, 2), spinner);

          var err;
          var stream;

          switch (res.statusCode) {
            case 200:
              stream = r.pipe(zlib.createGunzip())
                .pipe(tar.Extract({
                  path: dst
                }));

              stream.on('error', function(err) {
                  callback(err);
                })
                .on('finish', function() {
                  var pack = name + '@' + version;

                  if (sha256sum !== hash.digest('hex')) {
                    // checksum doesn't match
                    err = new Error('Package ' + name +
                      '@' + version + ' is corrupted. Checksum verification failed.');
                    err.name = 'ResourceCorrupted';
                    return callback(err);
                  }

                  spinner.stop();
                  logger.print(arrow + pack.yellow.bgBlack);
                  spinner.start();

                  addMetadata(name, registry, options, callback);

                  if (config) {
                    // write back properties.yml
                    writeProperties(config, resolve(process.cwd(), name, 'properties.yml'));
                  }
                });
              break;

            case 404:
              err = new Error('Package ' + name +
                '@' + version + ' not found on registry: ' + registry);
              err.name = 'ResourceNotFound';
              callback(err);
              break;

            case 503:
              err = new Error('Unreachable registry: ' + registry + ' ' +
                nconf.get('registries:' + registry + ':url'));
              err.name = 'BackendNotConnected';
              callback(err);
              break;

            default:
              callback(new Error('Request returned with status code ' + res.statusCode));
          }
        });
    });
  });
}

/**
 * Install a package from a URL.
 */

function installFromUrl(registry, pack, options, callback) {
  // make sure git is installed
  if (!path.GIT_BIN) {
    return callback('Sorry, this command requires `git`');
  }

  // normalize URL
  var normalized = ngu(pack);
  var err;

  logger.log('Checking remote repository');

  // list references in remote repository
  var remote = exec.sync('git', ['ls-remote', normalized.url]);
  logger.log(remote.stdout.toString('utf8').trim());
  logger.log(remote.stderr.toString('utf8').trim());

  if (remote.error) {
    return callback(remote.error);
  }

  if (remote.status === 0) {
    logger.log('Cloning repository');

    // clone remote repository
    var clone = exec.sync('git', ['clone', normalized.url]);
    logger.log(clone.stdout.toString('utf8').trim());
    logger.log(clone.stderr.toString('utf8').trim());

    if (clone.error) {
      return callback(clone.error);
    }

    if (clone.stderr) {
      logger.print(clone.stderr.toString('utf8').trim());
    }

    if (clone.status === 0) {
      var repoName = basename(normalized.url).replace(/\.[^/.]+$/, '');
      var repoPath = resolve(process.cwd(), repoName);

      if (normalized.branch) {
        // checkout branch
        var checkout = exec.sync('git', ['checkout', normalized.branch], {
          cwd: repoPath
        });
        logger.log(checkout.stdout.toString('utf8').trim());
        logger.log(checkout.stderr.toString('utf8').trim());

        if (checkout.error) {
          return callback(checkout.error);
        }

        if (checkout.status === 0) {
          try {
            fse.removeSync(resolve(process.cwd(), repoName, '.git'));
          } catch (err) {
            return callback(err);
          }

          addMetadata(repoName, registry, options, callback);
        } else {
          if (checkout.stderr) {
            logger.print(checkout.stderr.toString('utf8').trim());
          }

          // create error
          err = new Error('Git command failed');
          err.name = 'ResourceNotFound';
          callback(err);
        }
      } else {
        addMetadata(repoName, registry, options, callback);
      }
    } else {
      // create error
      err = new Error('Git command failed');
      err.name = 'ResourceConflict';
      callback(err);
    }
  } else {
    if (remote.stderr) {
      logger.print(remote.stderr.toString('utf8').trim());
    }

    // create error
    err = new Error('Git command failed');
    err.name = 'ResourceNotFound';
    callback(err);
  }
}

/**
 * Install a package from the registry.
 */

function installFromRegistry(registry, pack, options, callback) {
  var packageDesc = pack.split('@');
  var name = packageDesc[0];
  var version = packageDesc[1] || 'latest';

  logger.log('Reading package list', spinner, true);
  fse.readFile(resolve(path.HOBS_CACHE, registry), function(err, data) {
    if (err) {
      if (err.code === 'ENOENT') {
        return callback('First you need to update hobs-cli\'s cache using `hobs-cli update`');
      }

      return callback(err);
    }

    // find package in cache
    var match = new RegExp('Package: ' + name + '$');
    var lineByLine = data.toString().split('\n');
    var len = lineByLine.length;

    var size;
    var sha256sum;
    var cacheVersion;
    var cached = false;
    for (var i = 0; i < len; i += 10) {
      if (match.test(lineByLine[i])) {
        cacheVersion = lineByLine[i + 2].substring(9);

        if (version === 'latest' || version === cacheVersion) {
          size = lineByLine[i + 7].substring(6);
          sha256sum = lineByLine[i + 8].substring(8);
          cached = true;
          logger.log('Found package ' + name + '@' + cacheVersion, spinner, true);
        }

        break;
      }
    }

    // make sure packages are downloaded only once
    if (packages.indexOf(name + '@' + version) === -1) {
      packages.push(name + '@' + version);
    } else {
      return callback();
    }

    if (!cached) {
      logger.log('Fetching package info on registry: ' + registry, spinner, true);

      // fetch package info on registry
      var packUrl = nconf.get('registries:' + registry + ':url') + '/api/packages/' + name;
      request.get(packUrl, function(err, res, body) {
        if (err) {
          return callback(err);
        }

        logger.log('packages-info (code) => ' + res.statusCode, spinner);
        logger.log('packages-info (headers) =>\n' + JSON.stringify(res.headers, null, 2), spinner);
        if (res.headers['content-type'].indexOf('application/json') !== -1) {
          logger.log('packages-info (body) =>\n' + JSON.stringify(JSON.parse(body), null, 2), spinner);
        }

        switch (res.statusCode) {
          case 200:
            var releases = JSON.parse(body).releases;
            var available = false;

            for (var i = 0; i < releases.length; i++) {
              if (releases[i].version === version) {
                available = true;
                size = releases[i].size;
                sha256sum = releases[i].hash;
                break;
              }
            }

            if (available) {
              return download(name, version, size, sha256sum, registry, options, callback);
            }

            err = new Error('Unable to locate package ' + name +
              '@' + version + ' on registry: ' + registry);
            err.name = 'ResourceNotFound';
            callback(err);
            break;

          case 404:
            err = new Error('Unable to locate package ' + name +
              '@' + version + ' on registry: ' + registry);
            err.name = 'ResourceNotFound';
            callback(err);
            break;

          case 503:
            err = new Error('Unreachable registry: ' + registry + ' ' +
              nconf.get('registries:' + registry + ':url'));
            err.name = 'BackendNotConnected';
            callback(err);
            break;

          default:
            callback('registry: ' + body);
        }
      });
    } else {
      download(name, cacheVersion, size, sha256sum, registry, options, callback);
    }
  });
}

/**
 * Install a package.
 */

function install(pack, options, callback) {
  var registry = options.registry || nconf.get('default_registry');
  logger.log('registry => ' + registry);

  if (!nconf.get('registries:' + registry)) {
    return callback('Unknown registry: ' + registry);
  }

  if (validUrl.isUri(pack)) {
    // install package from URL
    installFromUrl(registry, pack, options, callback);
  } else {
    spinner.start();

    // install package from registry
    installFromRegistry(registry, pack, options, callback);
  }
}

exports.run = function(pack, options, done) {
  install(pack, options, function(err) {
    spinner.stop();

    if (err) {
      if (err instanceof Error) {
        switch (err.name) {
          case 'ResourceNotFound':
          case 'ResourceCorrupted':
            logger.errorMessage(err.message);
            return done(204);
          case 'ResourceConflict':
            logger.errorMessage(err.message);
            return done(209);
          case 'BackendNotConnected':
            logger.errorMessage(err.message);
            return done(253);
          default:
            logger.handleError(err);
            return done(1);
        }
      }

      logger.errorMessage(err);
      done(1);
    } else {
      logger.successMessage('Done');
      done(0);
    }
  });
};
