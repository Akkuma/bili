'use strict'

function _interopDefault(ex) {
  return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex
}

var index = require('./index-f325a455.js')
require('path')
require('chalk')
require('module')
var fs = _interopDefault(require('fs'))
require('child_process')
require('rollup')
require('ora')
require('joycon')
var stream = _interopDefault(require('stream'))
var zlib = _interopDefault(require('zlib'))

var writeMethods = ['write', 'end', 'destroy']
var readMethods = ['resume', 'pause']
var readEvents = ['data', 'close']
var slice = Array.prototype.slice

var duplexer = duplex

function forEach(arr, fn) {
  if (arr.forEach) {
    return arr.forEach(fn)
  }

  for (var i = 0; i < arr.length; i++) {
    fn(arr[i], i)
  }
}

function duplex(writer, reader) {
  var stream$1 = new stream()
  var ended = false

  forEach(writeMethods, proxyWriter)

  forEach(readMethods, proxyReader)

  forEach(readEvents, proxyStream)

  reader.on('end', handleEnd)

  writer.on('drain', function () {
    stream$1.emit('drain')
  })

  writer.on('error', reemit)
  reader.on('error', reemit)

  stream$1.writable = writer.writable
  stream$1.readable = reader.readable

  return stream$1

  function proxyWriter(methodName) {
    stream$1[methodName] = method

    function method() {
      return writer[methodName].apply(writer, arguments)
    }
  }

  function proxyReader(methodName) {
    stream$1[methodName] = method

    function method() {
      stream$1.emit(methodName)
      var func = reader[methodName]
      if (func) {
        return func.apply(reader, arguments)
      }
      reader.emit(methodName)
    }
  }

  function proxyStream(methodName) {
    reader.on(methodName, reemit)

    function reemit() {
      var args = slice.call(arguments)
      args.unshift(methodName)
      stream$1.emit.apply(stream$1, args)
    }
  }

  function handleEnd() {
    if (ended) {
      return
    }
    ended = true
    var args = slice.call(arguments)
    args.unshift('end')
    stream$1.emit.apply(stream$1, args)
  }

  function reemit(err) {
    stream$1.emit('error', err)
  }
}

const processFn = (fn, options) =>
  function (...args) {
    const P = options.promiseModule

    return new P((resolve, reject) => {
      if (options.multiArgs) {
        args.push((...result) => {
          if (options.errorFirst) {
            if (result[0]) {
              reject(result)
            } else {
              result.shift()
              resolve(result)
            }
          } else {
            resolve(result)
          }
        })
      } else if (options.errorFirst) {
        args.push((error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })
      } else {
        args.push(resolve)
      }

      fn.apply(this, args)
    })
  }

var pify = (input, options) => {
  options = Object.assign(
    {
      exclude: [/.+(Sync|Stream)$/],
      errorFirst: true,
      promiseModule: Promise,
    },
    options
  )

  const objType = typeof input
  if (!(input !== null && (objType === 'object' || objType === 'function'))) {
    throw new TypeError(
      `Expected \`input\` to be a \`Function\` or \`Object\`, got \`${
        input === null ? 'null' : objType
      }\``
    )
  }

  const filter = (key) => {
    const match = (pattern) =>
      typeof pattern === 'string' ? key === pattern : pattern.test(key)
    return options.include
      ? options.include.some(match)
      : !options.exclude.some(match)
  }

  let ret
  if (objType === 'function') {
    ret = function (...args) {
      return options.excludeMain
        ? input(...args)
        : processFn(input, options).apply(this, args)
    }
  } else {
    ret = Object.create(Object.getPrototypeOf(input))
  }

  for (const key in input) {
    // eslint-disable-line guard-for-in
    const property = input[key]
    ret[key] =
      typeof property === 'function' && filter(key)
        ? processFn(property, options)
        : property
  }

  return ret
}

var gzipSize = index.createCommonjsModule(function (module) {
  const getOptions = (options) => Object.assign({ level: 9 }, options)

  module.exports = (input, options) => {
    if (!input) {
      return Promise.resolve(0)
    }

    return pify(zlib.gzip)(input, getOptions(options))
      .then((data) => data.length)
      .catch((_) => 0)
  }

  module.exports.sync = (input, options) =>
    zlib.gzipSync(input, getOptions(options)).length

  module.exports.stream = (options) => {
    const input = new stream.PassThrough()
    const output = new stream.PassThrough()
    const wrapper = duplexer(input, output)

    let gzipSize = 0
    const gzip = zlib
      .createGzip(getOptions(options))
      .on('data', (buf) => {
        gzipSize += buf.length
      })
      .on('error', () => {
        wrapper.gzipSize = 0
      })
      .on('end', () => {
        wrapper.gzipSize = gzipSize
        wrapper.emit('gzip-size', gzipSize)
        output.end()
      })

    input.pipe(gzip)
    input.pipe(output, { end: false })

    return wrapper
  }

  module.exports.file = (path, options) => {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(path)
      stream.on('error', reject)

      const gzipStream = stream.pipe(module.exports.stream(options))
      gzipStream.on('error', reject)
      gzipStream.on('gzip-size', resolve)
    })
  }

  module.exports.fileSync = (path, options) =>
    module.exports.sync(fs.readFileSync(path), options)
})

exports.__moduleExports = gzipSize
exports.default = gzipSize