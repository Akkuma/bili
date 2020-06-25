#!/usr/bin/env node
'use strict'

require('v8-compile-cache')
var cac = require('cac')

var version = '4.0.0'

function _empty() {}

function _awaitIgnored(value, direct) {
  if (!direct) {
    return value && value.then ? value.then(_empty) : Promise.resolve()
  }
}

function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value
  }

  if (!value || !value.then) {
    value = Promise.resolve(value)
  }

  return then ? value.then(then) : value
}

function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i]
    }

    try {
      return Promise.resolve(f.apply(this, args))
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

if (process.env.BILI_LOCAL_PROFILE) {
  const requireSoSlow = require('require-so-slow')

  process.on('exit', () => {
    requireSoSlow.write('require-trace.trace')
  })
}

const cli = cac.cac('bili')
cli
  .command('[...input]', 'Bundle input files', {
    ignoreOptionDefaultValue: true,
  })
  .option('-w, --watch', 'Watch files')
  .option(
    '--format <format>',
    'Output format (cjs | umd | es  | iife), can be used multiple times'
  )
  .option('--input.* [file]', 'An object mapping names to entry points')
  .option('-d, --out-dir <outDir>', 'Output directory', {
    default: 'dist',
  })
  .option('--root-dir <rootDir>', 'The root directory to resolve files from')
  .option('--file-name <name>', 'Set the file name for output files')
  .option('--module-name <name>', 'Set the module name for umd bundle')
  .option('--env.* [value]', 'Replace env variables')
  .option('--plugin, --plugins.* [options]', 'Use a plugin')
  .option(
    '--global.* [path]',
    'id:moduleName pair for external imports in umd/iife bundles'
  )
  .option('--no-extract-css', 'Do not extract CSS files')
  .option('--bundle-node-modules', 'Include node modules in your bundle')
  .option('--minify', 'Minify output files')
  .option('--external <id>', 'Mark a module id as external', {
    type: [],
  })
  .option('-t, --target <target>', 'Output target', {
    default: 'node',
  })
  .option('-c, --config <file>', 'Use a custom config file')
  .option('--minimal', 'Generate minimal output whenever possible')
  .option('--no-babelrc', 'Disable .babelrc file')
  .option('--banner', 'Add banner with pkg info to the bundle')
  .option(
    '--no-map',
    'Disable source maps, enabled by default for minified bundles'
  )
  .option('--map-exclude-sources', 'Exclude source code in source maps')
  .option('--no-async-pro, --no-async-to-promises', 'Leave async/await as is')
  .option('--concurrent', 'Build concurrently')
  .option('--verbose', 'Show verbose logs')
  .option('--quiet', 'Show minimal logs')
  .option('--stack-trace', 'Show stack trace for bundle errors')
  .example((bin) => `  ${bin} --format cjs --format esm`)
  .example((bin) => `  ${bin} src/index.js,src/cli.ts`)
  .example((bin) => `  ${bin} --input.index src/foo.ts`)
  .action(
    _async(function (input, options) {
      return _await(
        Promise.resolve().then(function () {
          return require('./index.js')
        }),
        function ({ Bundler }) {
          const rootDir = options.rootDir || '.'
          const bundler = new Bundler(
            {
              input: options.input || (input.length === 0 ? undefined : input),
              output: {
                format: options.format,
                dir: options.outDir,
                moduleName: options.moduleName,
                fileName: options.fileName,
                minify: options.minify,
                extractCSS: options.extractCss,
                sourceMap: options.map,
                sourceMapExcludeSources: options.mapExcludeSources,
                target: options.target,
              },
              bundleNodeModules: options.bundleNodeModules,
              env: options.env,
              plugins: options.plugins,
              externals: options.external,
              globals: options.global,
              banner: options.banner,
              babel: {
                asyncToPromises: options.asyncToPromises,
                minimal: options.minimal,
                babelrc: options.babelrc,
              },
            },
            {
              logLevel: options.verbose
                ? 'verbose'
                : options.quiet
                ? 'quiet'
                : undefined,
              stackTrace: options.stackTrace,
              configFile: options.config,
              rootDir,
            }
          )
          return _awaitIgnored(
            bundler
              .run({
                write: true,
                watch: options.watch,
                concurrent: options.concurrent,
              })
              .catch((err) => {
                bundler.handleError(err)
                process.exit(1)
              })
          )
        }
      )
    })
  )
cli.version(version)
cli.help()
cli.parse()
process.on('unhandledRejection', (err) => {
  console.error(err)
  process.exit(1)
})
