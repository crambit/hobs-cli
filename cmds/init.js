'use strict';

var fse = require('fs-extra');
var resolve = require('path').resolve;
var prompt = require('../utils/prompt');
var logger = require('../utils/logger');

function action(name) {
  exports.run(name, function(code) {
    process.exit(code);
  });
}

exports.cmd = function(program) {
  var pm = program
    .command('init')
    .description('Interactively create a package skeleton')
    .arguments('[name]')
    .on('--help', function() {
      console.log('  Description:');
      console.log('');
      console.log('    This will ask you a bunch of questions, and then write a');
      console.log('    package skeleton for you.');
      console.log('');
      console.log('    If you invoke it with a package name argument, it will');
      console.log('    use only defaults and not prompt you for any options.');
      console.log('');
    });

  pm.action(action);
};

/**
 * Write the package skeleton.
 */

function writeSkeleton(name, pack, done) {
  try {
    fse.statSync(resolve(process.cwd(), name));
  } catch (err) {
    // an error means the directory doesn't already exist
    logger.log(err);

    try {
      fse.mkdirsSync(resolve(process.cwd(), name, 'config'));
      fse.mkdirsSync(resolve(process.cwd(), name, 'dashboards'));
      fse.mkdirsSync(resolve(process.cwd(), name, 'widgets'));
      fse.closeSync(fse.openSync(resolve(process.cwd(), name, 'properties.yml'), 'w'));

      fse.writeFileSync(resolve(process.cwd(), name, 'horus.json'), JSON.stringify(pack, null, 2));
    } catch (err) {
      logger.handleError(err);
      return done(1);
    }

    logger.successMessage('Done');
    return done(0);
  }

  logger.errorMessage('Destination folder already exists: ' + resolve(process.cwd(), name));
  return done(209);
}

/**
 * Ask the user to confirm the package fields.
 */

function confirm(data, done) {
  logger.print('About to write to ' + resolve(process.cwd(), data.name, 'horus.json') + ':');
  logger.print('');

  var pack = {
    name: data.name,
    version: data.version,
    description: data.description,
    repository: {
      type: 'git',
      url: data.repo,
    },
    tags: null,
    author: data.author,
    producer: data.producer,
    license: data.license,
  };

  if (data.tags) {
    pack.tags = data.tags.split(',');
  } else {
    delete pack.tags;
  }

  logger.log('horus.json =>\n' + JSON.stringify(pack, null, 2), true);
  logger.print(JSON.stringify(pack, null, 2));
  logger.print('');
  logger.print('');

  prompt.get({
    name: 'ok',
    description: 'Is this ok? ',
    type: 'string',
    pattern: /y[es]*|n[o]?/,
    message: 'You must respond [y]es or [n]o',
    default: 'yes',
    required: false,
  }, function(err, result) {
    if (err) {
      logger.errorMessage(err.message);
      return done(1);
    }

    if (/n[o]?/.test(result.ok)) {
      logger.errorMessage('Aborted');
      return done(1);
    }

    writeSkeleton(data.name, pack, done);
  });
}

/**
 * Build package skeleton from template.
 */

function useTemplate(name, done) {
  var pack = {
    name: name,
    version: '1.0',
    description: '',
    repository: {
      type: 'git',
      url: '',
    },
    tags: [],
    author: '',
    producer: {
      type: 'internal',
    },
    license: 'EPL',
  };

  writeSkeleton(name, pack, done);
}

exports.run = function(name, done) {
  if (name) {
    return useTemplate(name, done);
  }

  logger.print('This utility will walk you through creating a package skeleton.');
  logger.print('');
  logger.print('Press ^C at any time to quit.');

  prompt.get({
    properties: {
      name: {
        description: 'name: ',
        type: 'string',
        message: 'Name cannot be empty',
        required: true,
      },
      version: {
        description: 'version: ',
        type: 'string',
        pattern: /^\d{1,2}\.\d{1,2}$/,
        message: 'Not a valid "BIG.SMALL" version',
        default: '1.0',
        required: true,
      },
      description: {
        description: 'description: ',
        type: 'string',
        required: false,
      },
      repo: {
        description: 'git repository: ',
        type: 'string',
        format: 'url',
        message: 'Not a valid URL',
        required: false,
      },
      tags: {
        description: 'tags: (comma-separated)',
        type: 'string',
        required: false,
      },
      author: {
        description: 'author: ',
        type: 'string',
        required: false,
      },
      license: {
        description: 'license: ',
        type: 'string',
        default: 'EPL',
        required: false,
      },
      producer: {
        description: 'producer:\n    [i]nternal\n        or\n    [e]xternal ',
        type: 'string',
        pattern: /i[nternal]*|e[xternal]*/,
        message: 'You must respond [i]nternal or [e]xternal',
        required: true,
      },
      producerRepo: {
        description: 'producer\'s git repository: ',
        type: 'string',
        format: 'url',
        message: 'Not a valid URL',
        required: false,
        ask: function() {
          return /e[xternal]*/.test(prompt.history('producer').value);
        },
      },
    },
  }, function(err, result) {
    if (err) {
      logger.errorMessage(err.message);
      return done(1);
    }

    if (/e[xternal]*/.test(result.producer)) {
      result.producer = {
        type: 'external',
        repository: {
          type: 'git',
          url: result.producerRepo,
        },
      };
    } else {
      result.producer = {
        type: 'internal',
      };
    }

    confirm(result, done);
  });
};
