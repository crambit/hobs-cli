# Hobs Client Tools

![status-stable](https://img.shields.io/badge/status-stable-green.svg)
[![Build Status](https://travis-ci.org/crambit/hobs-cli.svg?branch=master)](https://travis-ci.org/crambit/hobs-cli)

## Description

The Hobs client tools, known as **hobs-cli**, that you use to interact with your
[Hobs Server](https://github.com/crambit/hobs) and package registries.

hobs-cli is configured to use the public package registry, Quarry, at
[quarry.crambit.com](https://quarry.crambit.com) by default. It's a repository
of packages written by our community for Hobs.

You can configure hobs-cli to use any compatible registry you like, and also run
your own registry. For further information, head over to https://github.com/crambit/hobs-registry.

## Installation

DEPENDENCIES:

- Node.js 0.12+
- Git 1.6.6+

Get the latest version of the client tools and make sure it's successfully installed:
```
$ npm install -g hobs-cli
$ hobs-cli --help
```

### Getting Started

Once you have an Hobs Server up and running, go to your Account Profile page
and copy your sandbox Git URL. hobs-cli will use it to get access to your
remote sandbox on the server.

Then, set up a local sandbox and update hobs-cli's cache
```
$ hobs-cli sandbox <url>
$ hobs-cli update
```

In your local sandbox, you can now install, edit and deploy any available
packages, or create your own
```
$ hobs-cli install <package>
$ vi <package>/properties.yml
$ git add <package>
$ git commit
$ hobs-cli deploy
```

Finally, set up the event producer as described in the package's README file in
order to forward events to your Riemann server and visualize your new dashboards
with Hobs!

## Testing

```
$ npm test
```

## License

[Apache 2.0](LICENSE)
