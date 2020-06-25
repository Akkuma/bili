'use strict'

function _interopDefault(ex) {
  return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex
}

var path = _interopDefault(require('path'))
var colors = _interopDefault(require('chalk'))
var module$1 = _interopDefault(require('module'))
var fs = _interopDefault(require('fs'))
var child_process = _interopDefault(require('child_process'))
var rollup = require('rollup')
var ora = _interopDefault(require('ora'))
var JoyCon = _interopDefault(require('joycon'))

Object.values = Object.values || ((obj) => Object.keys(obj).map((i) => obj[i]))

const BYTE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

const BIT_UNITS = [
  'b',
  'kbit',
  'Mbit',
  'Gbit',
  'Tbit',
  'Pbit',
  'Ebit',
  'Zbit',
  'Ybit',
]

/*
Formats the given number using `Number#toLocaleString`.
- If locale is a string, the value is expected to be a locale-key (for example: `de`).
- If locale is true, the system default locale is used for translation.
- If no value for locale is specified, the number is returned unmodified.
*/
const toLocaleString = (number, locale) => {
  let result = number
  if (typeof locale === 'string') {
    result = number.toLocaleString(locale)
  } else if (locale === true) {
    result = number.toLocaleString()
  }

  return result
}

var prettyBytes = (number, options) => {
  if (!Number.isFinite(number)) {
    throw new TypeError(
      `Expected a finite number, got ${typeof number}: ${number}`
    )
  }

  options = Object.assign({ bits: false }, options)
  const UNITS = options.bits ? BIT_UNITS : BYTE_UNITS

  if (options.signed && number === 0) {
    return ' 0 ' + UNITS[0]
  }

  const isNegative = number < 0
  const prefix = isNegative ? '-' : options.signed ? '+' : ''

  if (isNegative) {
    number = -number
  }

  if (number < 1) {
    const numberString = toLocaleString(number, options.locale)
    return prefix + numberString + ' ' + UNITS[0]
  }

  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    UNITS.length - 1
  )
  // eslint-disable-next-line unicorn/prefer-exponentiation-operator
  number = Number((number / Math.pow(1000, exponent)).toPrecision(3))
  const numberString = toLocaleString(number, options.locale)

  const unit = UNITS[exponent]

  return prefix + numberString + ' ' + unit
}

var parseMs = (milliseconds) => {
  if (typeof milliseconds !== 'number') {
    throw new TypeError('Expected a number')
  }

  const roundTowardsZero = milliseconds > 0 ? Math.floor : Math.ceil

  return {
    days: roundTowardsZero(milliseconds / 86400000),
    hours: roundTowardsZero(milliseconds / 3600000) % 24,
    minutes: roundTowardsZero(milliseconds / 60000) % 60,
    seconds: roundTowardsZero(milliseconds / 1000) % 60,
    milliseconds: roundTowardsZero(milliseconds) % 1000,
    microseconds: roundTowardsZero(milliseconds * 1000) % 1000,
    nanoseconds: roundTowardsZero(milliseconds * 1e6) % 1000,
  }
}

const pluralize = (word, count) => (count === 1 ? word : `${word}s`)

const SECOND_ROUNDING_EPSILON = 0.0000001

var prettyMs = (milliseconds, options = {}) => {
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError('Expected a finite number')
  }

  if (options.colonNotation) {
    options.compact = false
    options.formatSubMilliseconds = false
    options.separateMilliseconds = false
    options.verbose = false
  }

  if (options.compact) {
    options.secondsDecimalDigits = 0
    options.millisecondsDecimalDigits = 0
  }

  const result = []

  const floorDecimals = (value, decimalDigits) => {
    const flooredInterimValue = Math.floor(
      value * 10 ** decimalDigits + SECOND_ROUNDING_EPSILON
    )
    const flooredValue = Math.round(flooredInterimValue) / 10 ** decimalDigits
    return flooredValue.toFixed(decimalDigits)
  }

  const add = (value, long, short, valueString) => {
    if (
      (result.length === 0 || !options.colonNotation) &&
      value === 0 &&
      !(options.colonNotation && short === 'm')
    ) {
      return
    }

    valueString = (valueString || value || '0').toString()
    let prefix
    let suffix
    if (options.colonNotation) {
      prefix = result.length > 0 ? ':' : ''
      suffix = ''
      const wholeDigits = valueString.includes('.')
        ? valueString.split('.')[0].length
        : valueString.length
      const minLength = result.length > 0 ? 2 : 1
      valueString =
        '0'.repeat(Math.max(0, minLength - wholeDigits)) + valueString
    } else {
      prefix = ''
      suffix = options.verbose ? ' ' + pluralize(long, value) : short
    }

    result.push(prefix + valueString + suffix)
  }

  const parsed = parseMs(milliseconds)

  add(Math.trunc(parsed.days / 365), 'year', 'y')
  add(parsed.days % 365, 'day', 'd')
  add(parsed.hours, 'hour', 'h')
  add(parsed.minutes, 'minute', 'm')

  if (
    options.separateMilliseconds ||
    options.formatSubMilliseconds ||
    milliseconds < 1000
  ) {
    add(parsed.seconds, 'second', 's')
    if (options.formatSubMilliseconds) {
      add(parsed.milliseconds, 'millisecond', 'ms')
      add(parsed.microseconds, 'microsecond', 'µs')
      add(parsed.nanoseconds, 'nanosecond', 'ns')
    } else {
      const millisecondsAndBelow =
        parsed.milliseconds +
        parsed.microseconds / 1000 +
        parsed.nanoseconds / 1e6

      const millisecondsDecimalDigits =
        typeof options.millisecondsDecimalDigits === 'number'
          ? options.millisecondsDecimalDigits
          : 0

      const roundedMiliseconds =
        millisecondsAndBelow >= 1
          ? Math.round(millisecondsAndBelow)
          : Math.ceil(millisecondsAndBelow)

      const millisecondsString = millisecondsDecimalDigits
        ? millisecondsAndBelow.toFixed(millisecondsDecimalDigits)
        : roundedMiliseconds

      add(
        Number.parseFloat(millisecondsString, 10),
        'millisecond',
        'ms',
        millisecondsString
      )
    }
  } else {
    const seconds = (milliseconds / 1000) % 60
    const secondsDecimalDigits =
      typeof options.secondsDecimalDigits === 'number'
        ? options.secondsDecimalDigits
        : 1
    const secondsFixed = floorDecimals(seconds, secondsDecimalDigits)
    const secondsString = options.keepDecimalsOnWholeSeconds
      ? secondsFixed
      : secondsFixed.replace(/\.0+$/, '')
    add(Number.parseFloat(secondsString, 10), 'second', 's', secondsString)
  }

  if (result.length === 0) {
    return '0' + (options.verbose ? ' milliseconds' : 'ms')
  }

  if (options.compact) {
    return result[0]
  }

  if (typeof options.unitCount === 'number') {
    const separator = options.colonNotation ? '' : ' '
    return result.slice(0, Math.max(options.unitCount, 1)).join(separator)
  }

  return options.colonNotation ? result.join('') : result.join(' ')
}

var textTable = function (rows_, opts) {
  if (!opts) opts = {}
  var hsep = opts.hsep === undefined ? '  ' : opts.hsep
  var align = opts.align || []
  var stringLength =
    opts.stringLength ||
    function (s) {
      return String(s).length
    }
  var dotsizes = reduce(
    rows_,
    function (acc, row) {
      forEach(row, function (c, ix) {
        var n = dotindex(c)
        if (!acc[ix] || n > acc[ix]) acc[ix] = n
      })
      return acc
    },
    []
  )

  var rows = map(rows_, function (row) {
    return map(row, function (c_, ix) {
      var c = String(c_)
      if (align[ix] === '.') {
        var index = dotindex(c)
        var size =
          dotsizes[ix] + (/\./.test(c) ? 1 : 2) - (stringLength(c) - index)
        return c + Array(size).join(' ')
      } else return c
    })
  })

  var sizes = reduce(
    rows,
    function (acc, row) {
      forEach(row, function (c, ix) {
        var n = stringLength(c)
        if (!acc[ix] || n > acc[ix]) acc[ix] = n
      })
      return acc
    },
    []
  )

  return map(rows, function (row) {
    return map(row, function (c, ix) {
      var n = sizes[ix] - stringLength(c) || 0
      var s = Array(Math.max(n + 1, 1)).join(' ')
      if (align[ix] === 'r' || align[ix] === '.') {
        return s + c
      }
      if (align[ix] === 'c') {
        return (
          Array(Math.ceil(n / 2 + 1)).join(' ') +
          c +
          Array(Math.floor(n / 2 + 1)).join(' ')
        )
      }

      return c + s
    })
      .join(hsep)
      .replace(/\s+$/, '')
  }).join('\n')
}

function dotindex(c) {
  var m = /\.[^.]*$/.exec(c)
  return m ? m.index + 1 : c.length
}

function reduce(xs, f, init) {
  if (xs.reduce) return xs.reduce(f, init)
  var i = 0
  var acc = arguments.length >= 3 ? init : xs[i++]
  for (; i < xs.length; i++) {
    f(acc, xs[i], i)
  }
  return acc
}

function forEach(xs, f) {
  if (xs.forEach) return xs.forEach(f)
  for (var i = 0; i < xs.length; i++) {
    f.call(xs, xs[i], i)
  }
}

function map(xs, f) {
  if (xs.map) return xs.map(f)
  var res = []
  for (var i = 0; i < xs.length; i++) {
    res.push(f.call(xs, xs[i], i))
  }
  return res
}

const resolveFrom = (fromDirectory, moduleId, silent) => {
  if (typeof fromDirectory !== 'string') {
    throw new TypeError(
      `Expected \`fromDir\` to be of type \`string\`, got \`${typeof fromDirectory}\``
    )
  }

  if (typeof moduleId !== 'string') {
    throw new TypeError(
      `Expected \`moduleId\` to be of type \`string\`, got \`${typeof moduleId}\``
    )
  }

  try {
    fromDirectory = fs.realpathSync(fromDirectory)
  } catch (error) {
    if (error.code === 'ENOENT') {
      fromDirectory = path.resolve(fromDirectory)
    } else if (silent) {
      return
    } else {
      throw error
    }
  }

  const fromFile = path.join(fromDirectory, 'noop.js')

  const resolveFileName = () =>
    module$1._resolveFilename(moduleId, {
      id: fromFile,
      filename: fromFile,
      paths: module$1._nodeModulePaths(fromDirectory),
    })

  if (silent) {
    try {
      return resolveFileName()
    } catch (error) {
      return
    }
  }

  return resolveFileName()
}

var resolveFrom_1 = (fromDirectory, moduleId) =>
  resolveFrom(fromDirectory, moduleId)
var silent = (fromDirectory, moduleId) =>
  resolveFrom(fromDirectory, moduleId, true)
resolveFrom_1.silent = silent

var ansiRegex = ({ onlyFirst = false } = {}) => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|')

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

var stripAnsi = (string) =>
  typeof string === 'string' ? string.replace(ansiRegex(), '') : string

/* eslint-disable yoda */

const isFullwidthCodePoint = (codePoint) => {
  if (Number.isNaN(codePoint)) {
    return false
  }

  // Code points are derived from:
  // http://www.unix.org/Public/UNIDATA/EastAsianWidth.txt
  if (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f || // Hangul Jamo
    codePoint === 0x2329 || // LEFT-POINTING ANGLE BRACKET
    codePoint === 0x232a || // RIGHT-POINTING ANGLE BRACKET
      // CJK Radicals Supplement .. Enclosed CJK Letters and Months
      (0x2e80 <= codePoint && codePoint <= 0x3247 && codePoint !== 0x303f) ||
      // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
      (0x3250 <= codePoint && codePoint <= 0x4dbf) ||
      // CJK Unified Ideographs .. Yi Radicals
      (0x4e00 <= codePoint && codePoint <= 0xa4c6) ||
      // Hangul Jamo Extended-A
      (0xa960 <= codePoint && codePoint <= 0xa97c) ||
      // Hangul Syllables
      (0xac00 <= codePoint && codePoint <= 0xd7a3) ||
      // CJK Compatibility Ideographs
      (0xf900 <= codePoint && codePoint <= 0xfaff) ||
      // Vertical Forms
      (0xfe10 <= codePoint && codePoint <= 0xfe19) ||
      // CJK Compatibility Forms .. Small Form Variants
      (0xfe30 <= codePoint && codePoint <= 0xfe6b) ||
      // Halfwidth and Fullwidth Forms
      (0xff01 <= codePoint && codePoint <= 0xff60) ||
      (0xffe0 <= codePoint && codePoint <= 0xffe6) ||
      // Kana Supplement
      (0x1b000 <= codePoint && codePoint <= 0x1b001) ||
      // Enclosed Ideographic Supplement
      (0x1f200 <= codePoint && codePoint <= 0x1f251) ||
      // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
      (0x20000 <= codePoint && codePoint <= 0x3fffd))
  ) {
    return true
  }

  return false
}

var isFullwidthCodePoint_1 = isFullwidthCodePoint
var _default = isFullwidthCodePoint
isFullwidthCodePoint_1.default = _default

var emojiRegex = function () {
  // https://mths.be/emoji
  return /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73)\uDB40\uDC7F|\uD83D\uDC68(?:\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68\uD83C\uDFFB|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|[\u2695\u2696\u2708]\uFE0F|\uD83D[\uDC66\uDC67]|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708])\uFE0F|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C[\uDFFB-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)\uD83C\uDFFB|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB\uDFFC])|\uD83D\uDC69(?:\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D\uD83D\uDC69)(?:\uD83C[\uDFFB-\uDFFD])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83C\uDFF4\u200D\u2620)\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83C\uDDF6\uD83C\uDDE6|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDBB\uDDD2-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5\uDEEB\uDEEC\uDEF4-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFA\uDFE0-\uDFEB]|\uD83E[\uDD0D-\uDD3A\uDD3C-\uDD45\uDD47-\uDD71\uDD73-\uDD76\uDD7A-\uDDA2\uDDA5-\uDDAA\uDDAE-\uDDCA\uDDCD-\uDDFF\uDE70-\uDE73\uDE78-\uDE7A\uDE80-\uDE82\uDE90-\uDE95])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g
}

const stringWidth = (string) => {
  string = string.replace(emojiRegex(), '  ')

  if (typeof string !== 'string' || string.length === 0) {
    return 0
  }

  string = stripAnsi(string)

  let width = 0

  for (let i = 0; i < string.length; i++) {
    const code = string.codePointAt(i)

    // Ignore control characters
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      continue
    }

    // Ignore combining characters
    if (code >= 0x300 && code <= 0x36f) {
      continue
    }

    // Surrogates
    if (code > 0xffff) {
      i++
    }

    width += isFullwidthCodePoint_1(code) ? 2 : 1
  }

  return width
}

var stringWidth_1 = stringWidth
// TODO: remove this in the next major version
var _default$1 = stringWidth
stringWidth_1.default = _default$1

const widestLine = (input) => {
  let max = 0

  for (const line of input.split('\n')) {
    max = Math.max(max, stringWidth_1(line))
  }

  return max
}

var widestLine_1 = widestLine
// TODO: remove this in the next major version
var _default$2 = widestLine
widestLine_1.default = _default$2

var single = {
  topLeft: '┌',
  topRight: '┐',
  bottomRight: '┘',
  bottomLeft: '└',
  vertical: '│',
  horizontal: '─',
}
var double = {
  topLeft: '╔',
  topRight: '╗',
  bottomRight: '╝',
  bottomLeft: '╚',
  vertical: '║',
  horizontal: '═',
}
var round = {
  topLeft: '╭',
  topRight: '╮',
  bottomRight: '╯',
  bottomLeft: '╰',
  vertical: '│',
  horizontal: '─',
}
var bold = {
  topLeft: '┏',
  topRight: '┓',
  bottomRight: '┛',
  bottomLeft: '┗',
  vertical: '┃',
  horizontal: '━',
}
var singleDouble = {
  topLeft: '╓',
  topRight: '╖',
  bottomRight: '╜',
  bottomLeft: '╙',
  vertical: '║',
  horizontal: '─',
}
var doubleSingle = {
  topLeft: '╒',
  topRight: '╕',
  bottomRight: '╛',
  bottomLeft: '╘',
  vertical: '│',
  horizontal: '═',
}
var classic = {
  topLeft: '+',
  topRight: '+',
  bottomRight: '+',
  bottomLeft: '+',
  vertical: '|',
  horizontal: '-',
}
var boxes = {
  single: single,
  double: double,
  round: round,
  bold: bold,
  singleDouble: singleDouble,
  doubleSingle: doubleSingle,
  classic: classic,
}

var boxes$1 = /*#__PURE__*/ Object.freeze({
  __proto__: null,
  single: single,
  double: double,
  round: round,
  bold: bold,
  singleDouble: singleDouble,
  doubleSingle: doubleSingle,
  classic: classic,
  default: boxes,
})

var commonjsGlobal =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
    ? self
    : {}

function createCommonjsModule(fn, basedir, module) {
  return (
    (module = {
      path: basedir,
      exports: {},
      require: function (path, base) {
        return commonjsRequire(
          path,
          base === undefined || base === null ? module.path : base
        )
      },
    }),
    fn(module, module.exports),
    module.exports
  )
}

function getCjsExportFromNamespace(n) {
  return (n && n['default']) || n
}

function commonjsRequire() {
  throw new Error(
    'Dynamic requires are not currently supported by @rollup/plugin-commonjs'
  )
}

var cliBoxes = getCjsExportFromNamespace(boxes$1)

var cliBoxes_1 = cliBoxes
// TODO: Remove this for the next major release
var _default$3 = cliBoxes
cliBoxes_1.default = _default$3

const preserveCamelCase = (string) => {
  let isLastCharLower = false
  let isLastCharUpper = false
  let isLastLastCharUpper = false

  for (let i = 0; i < string.length; i++) {
    const character = string[i]

    if (
      isLastCharLower &&
      /[a-zA-Z]/.test(character) &&
      character.toUpperCase() === character
    ) {
      string = string.slice(0, i) + '-' + string.slice(i)
      isLastCharLower = false
      isLastLastCharUpper = isLastCharUpper
      isLastCharUpper = true
      i++
    } else if (
      isLastCharUpper &&
      isLastLastCharUpper &&
      /[a-zA-Z]/.test(character) &&
      character.toLowerCase() === character
    ) {
      string = string.slice(0, i - 1) + '-' + string.slice(i - 1)
      isLastLastCharUpper = isLastCharUpper
      isLastCharUpper = false
      isLastCharLower = true
    } else {
      isLastCharLower =
        character.toLowerCase() === character &&
        character.toUpperCase() !== character
      isLastLastCharUpper = isLastCharUpper
      isLastCharUpper =
        character.toUpperCase() === character &&
        character.toLowerCase() !== character
    }
  }

  return string
}

const camelCase = (input, options) => {
  if (!(typeof input === 'string' || Array.isArray(input))) {
    throw new TypeError('Expected the input to be `string | string[]`')
  }

  options = Object.assign(
    {
      pascalCase: false,
    },
    options
  )

  const postProcess = (x) =>
    options.pascalCase ? x.charAt(0).toUpperCase() + x.slice(1) : x

  if (Array.isArray(input)) {
    input = input
      .map((x) => x.trim())
      .filter((x) => x.length)
      .join('-')
  } else {
    input = input.trim()
  }

  if (input.length === 0) {
    return ''
  }

  if (input.length === 1) {
    return options.pascalCase ? input.toUpperCase() : input.toLowerCase()
  }

  const hasUpperCase = input !== input.toLowerCase()

  if (hasUpperCase) {
    input = preserveCamelCase(input)
  }

  input = input
    .replace(/^[_.\- ]+/, '')
    .toLowerCase()
    .replace(/[_.\- ]+(\w|$)/g, (_, p1) => p1.toUpperCase())
    .replace(/\d+(\w|$)/g, (m) => m.toUpperCase())

  return postProcess(input)
}

var camelcase = camelCase
// TODO: Remove this for the next major release
var _default$4 = camelCase
camelcase.default = _default$4

var ansiRegex$1 = (options) => {
  options = Object.assign(
    {
      onlyFirst: false,
    },
    options
  )

  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|')

  return new RegExp(pattern, options.onlyFirst ? undefined : 'g')
}

const stripAnsi$1 = (string) =>
  typeof string === 'string' ? string.replace(ansiRegex$1(), '') : string

var stripAnsi_1 = stripAnsi$1
var _default$5 = stripAnsi$1
stripAnsi_1.default = _default$5

/* eslint-disable yoda */
var isFullwidthCodePoint$1 = (x) => {
  if (Number.isNaN(x)) {
    return false
  }

  // code points are derived from:
  // http://www.unix.org/Public/UNIDATA/EastAsianWidth.txt
  if (
    x >= 0x1100 &&
    (x <= 0x115f || // Hangul Jamo
    x === 0x2329 || // LEFT-POINTING ANGLE BRACKET
    x === 0x232a || // RIGHT-POINTING ANGLE BRACKET
      // CJK Radicals Supplement .. Enclosed CJK Letters and Months
      (0x2e80 <= x && x <= 0x3247 && x !== 0x303f) ||
      // Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
      (0x3250 <= x && x <= 0x4dbf) ||
      // CJK Unified Ideographs .. Yi Radicals
      (0x4e00 <= x && x <= 0xa4c6) ||
      // Hangul Jamo Extended-A
      (0xa960 <= x && x <= 0xa97c) ||
      // Hangul Syllables
      (0xac00 <= x && x <= 0xd7a3) ||
      // CJK Compatibility Ideographs
      (0xf900 <= x && x <= 0xfaff) ||
      // Vertical Forms
      (0xfe10 <= x && x <= 0xfe19) ||
      // CJK Compatibility Forms .. Small Form Variants
      (0xfe30 <= x && x <= 0xfe6b) ||
      // Halfwidth and Fullwidth Forms
      (0xff01 <= x && x <= 0xff60) ||
      (0xffe0 <= x && x <= 0xffe6) ||
      // Kana Supplement
      (0x1b000 <= x && x <= 0x1b001) ||
      // Enclosed Ideographic Supplement
      (0x1f200 <= x && x <= 0x1f251) ||
      // CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
      (0x20000 <= x && x <= 0x3fffd))
  ) {
    return true
  }

  return false
}

var emojiRegex$1 = function () {
  // https://mths.be/emoji
  return /\uD83C\uDFF4(?:\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67|\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74)\uDB40\uDC7F|\u200D\u2620\uFE0F)|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC68(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDB0-\uDDB3])|(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDB0-\uDDB3]))|\uD83D\uDC69\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDB0-\uDDB3])|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]|\uD83D\uDC68(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)\uFE0F|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDD6-\uDDDD])(?:(?:\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\uD83D\uDC69\u200D[\u2695\u2696\u2708])\uFE0F|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC68(?:\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])\u200D(?:\uD83C[\uDF3E\uDF73\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDB0-\uDDB3])|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC69(?:\uD83C[\uDFFB-\uDFFF])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|[#\*0-9]\uFE0F\u20E3|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270A-\u270D]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC70\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDCAA\uDD74\uDD7A\uDD90\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD36\uDDB5\uDDB6\uDDD1-\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDEEB\uDEEC\uDEF4-\uDEF9]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD70\uDD73-\uDD76\uDD7A\uDD7C-\uDDA2\uDDB0-\uDDB9\uDDC0-\uDDC2\uDDD0-\uDDFF])|(?:[#\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEF9]|\uD83E[\uDD10-\uDD3A\uDD3C-\uDD3E\uDD40-\uDD45\uDD47-\uDD70\uDD73-\uDD76\uDD7A\uDD7C-\uDDA2\uDDB0-\uDDB9\uDDC0-\uDDC2\uDDD0-\uDDFF])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC69\uDC6E\uDC70-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD18-\uDD1C\uDD1E\uDD1F\uDD26\uDD30-\uDD39\uDD3D\uDD3E\uDDB5\uDDB6\uDDB8\uDDB9\uDDD1-\uDDDD])/g
}

const emojiRegex$2 = emojiRegex$1()

var stringWidth$1 = (input) => {
  input = input.replace(emojiRegex$2, '  ')

  if (typeof input !== 'string' || input.length === 0) {
    return 0
  }

  input = stripAnsi_1(input)

  let width = 0

  for (let i = 0; i < input.length; i++) {
    const code = input.codePointAt(i)

    // Ignore control characters
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      continue
    }

    // Ignore combining characters
    if (code >= 0x300 && code <= 0x36f) {
      continue
    }

    // Surrogates
    if (code > 0xffff) {
      i++
    }

    width += isFullwidthCodePoint$1(code) ? 2 : 1
  }

  return width
}

function ansiAlign(text, opts) {
  if (!text) return text

  opts = opts || {}
  const align = opts.align || 'center'

  // short-circuit `align: 'left'` as no-op
  if (align === 'left') return text

  const split = opts.split || '\n'
  const pad = opts.pad || ' '
  const widthDiffFn = align !== 'right' ? halfDiff : fullDiff

  let returnString = false
  if (!Array.isArray(text)) {
    returnString = true
    text = String(text).split(split)
  }

  let width
  let maxWidth = 0
  text = text
    .map(function (str) {
      str = String(str)
      width = stringWidth$1(str)
      maxWidth = Math.max(width, maxWidth)
      return {
        str,
        width,
      }
    })
    .map(function (obj) {
      return new Array(widthDiffFn(maxWidth, obj.width) + 1).join(pad) + obj.str
    })

  return returnString ? text.join(split) : text
}

ansiAlign.left = function left(text) {
  return ansiAlign(text, { align: 'left' })
}

ansiAlign.center = function center(text) {
  return ansiAlign(text, { align: 'center' })
}

ansiAlign.right = function right(text) {
  return ansiAlign(text, { align: 'right' })
}

var ansiAlign_1 = ansiAlign

function halfDiff(maxWidth, curWidth) {
  return Math.floor((maxWidth - curWidth) / 2)
}

function fullDiff(maxWidth, curWidth) {
  return maxWidth - curWidth
}

const { execFileSync } = child_process

const exec = (command, arguments_, shell) =>
  execFileSync(command, arguments_, { encoding: 'utf8', shell }).trim()

const create = (columns, rows) => ({
  columns: parseInt(columns, 10),
  rows: parseInt(rows, 10),
})

var termSize = () => {
  const { env, stdout, stderr } = process

  if (stdout && stdout.columns && stdout.rows) {
    return create(stdout.columns, stdout.rows)
  }

  if (stderr && stderr.columns && stderr.rows) {
    return create(stderr.columns, stderr.rows)
  }

  // These values are static, so not the first choice
  if (env.COLUMNS && env.LINES) {
    return create(env.COLUMNS, env.LINES)
  }

  if (process.platform === 'win32') {
    try {
      // Binary: https://github.com/sindresorhus/win-term-size
      const size = exec(
        path.join(__dirname, 'vendor/windows/term-size.exe')
      ).split(/\r?\n/)

      if (size.length === 2) {
        return create(size[0], size[1])
      }
    } catch (_) {}
  } else {
    if (process.platform === 'darwin') {
      try {
        // Binary: https://github.com/sindresorhus/macos-term-size
        const size = exec(
          path.join(__dirname, 'vendor/macos/term-size'),
          [],
          true
        ).split(/\r?\n/)

        if (size.length === 2) {
          return create(size[0], size[1])
        }
      } catch (_) {}
    }

    // `resize` is preferred as it works even when all file descriptors are redirected
    // https://linux.die.net/man/1/resize
    try {
      const size = exec('resize', ['-u']).match(/\d+/g)

      if (size.length === 2) {
        return create(size[0], size[1])
      }
    } catch (_) {}

    if (process.env.TERM) {
      try {
        const columns = exec('tput', ['cols'])
        const rows = exec('tput', ['lines'])

        if (columns && rows) {
          return create(columns, rows)
        }
      } catch (_) {}
    }
  }

  return create(80, 24)
}

const chalk = require('chalk')

const getObject = (detail) => {
  let object

  if (typeof detail === 'number') {
    object = {
      top: detail,
      right: detail * 3,
      bottom: detail,
      left: detail * 3,
    }
  } else {
    object = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      ...detail,
    }
  }

  return object
}

const getBorderChars = (borderStyle) => {
  const sides = [
    'topLeft',
    'topRight',
    'bottomRight',
    'bottomLeft',
    'vertical',
    'horizontal',
  ]

  let chararacters

  if (typeof borderStyle === 'string') {
    chararacters = cliBoxes_1[borderStyle]

    if (!chararacters) {
      throw new TypeError(`Invalid border style: ${borderStyle}`)
    }
  } else {
    for (const side of sides) {
      if (!borderStyle[side] || typeof borderStyle[side] !== 'string') {
        throw new TypeError(`Invalid border style: ${side}`)
      }
    }

    chararacters = borderStyle
  }

  return chararacters
}

const isHex = (color) => color.match(/^#[0-f]{3}(?:[0-f]{3})?$/i)
const isColorValid = (color) =>
  typeof color === 'string' && (chalk[color] || isHex(color))
const getColorFn = (color) => (isHex(color) ? chalk.hex(color) : chalk[color])
const getBGColorFn = (color) =>
  isHex(color) ? chalk.bgHex(color) : chalk[camelcase(['bg', color])]

var boxen = (text, options) => {
  options = {
    padding: 0,
    borderStyle: 'single',
    dimBorder: false,
    align: 'left',
    float: 'left',
    ...options,
  }

  if (options.borderColor && !isColorValid(options.borderColor)) {
    throw new Error(`${options.borderColor} is not a valid borderColor`)
  }

  if (options.backgroundColor && !isColorValid(options.backgroundColor)) {
    throw new Error(`${options.backgroundColor} is not a valid backgroundColor`)
  }

  const chars = getBorderChars(options.borderStyle)
  const padding = getObject(options.padding)
  const margin = getObject(options.margin)

  const colorizeBorder = (border) => {
    const newBorder = options.borderColor
      ? getColorFn(options.borderColor)(border)
      : border
    return options.dimBorder ? chalk.dim(newBorder) : newBorder
  }

  const colorizeContent = (content) =>
    options.backgroundColor
      ? getBGColorFn(options.backgroundColor)(content)
      : content

  text = ansiAlign_1(text, { align: options.align })

  const NL = '\n'
  const PAD = ' '

  let lines = text.split(NL)

  if (padding.top > 0) {
    lines = new Array(padding.top).fill('').concat(lines)
  }

  if (padding.bottom > 0) {
    lines = lines.concat(new Array(padding.bottom).fill(''))
  }

  const contentWidth = widestLine_1(text) + padding.left + padding.right
  const paddingLeft = PAD.repeat(padding.left)
  const { columns } = termSize()
  let marginLeft = PAD.repeat(margin.left)

  if (options.float === 'center') {
    const padWidth = Math.max((columns - contentWidth) / 2, 0)
    marginLeft = PAD.repeat(padWidth)
  } else if (options.float === 'right') {
    const padWidth = Math.max(columns - contentWidth - margin.right - 2, 0)
    marginLeft = PAD.repeat(padWidth)
  }

  const horizontal = chars.horizontal.repeat(contentWidth)
  const top = colorizeBorder(
    NL.repeat(margin.top) +
      marginLeft +
      chars.topLeft +
      horizontal +
      chars.topRight
  )
  const bottom = colorizeBorder(
    marginLeft +
      chars.bottomLeft +
      horizontal +
      chars.bottomRight +
      NL.repeat(margin.bottom)
  )
  const side = colorizeBorder(chars.vertical)

  const middle = lines
    .map((line) => {
      const paddingRight = PAD.repeat(
        contentWidth - stringWidth_1(line) - padding.left
      )
      return (
        marginLeft +
        side +
        colorizeContent(paddingLeft + line + paddingRight) +
        side
      )
    })
    .join(NL)

  return top + NL + middle + NL + bottom
}

var _borderStyles = cliBoxes_1
boxen._borderStyles = _borderStyles

/**
 * Removes all key-value entries from the list cache.
 *
 * @private
 * @name clear
 * @memberOf ListCache
 */
function listCacheClear() {
  this.__data__ = []
  this.size = 0
}

var _listCacheClear = listCacheClear

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other)
}

var eq_1 = eq

/**
 * Gets the index at which the `key` is found in `array` of key-value pairs.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length
  while (length--) {
    if (eq_1(array[length][0], key)) {
      return length
    }
  }
  return -1
}

var _assocIndexOf = assocIndexOf

/** Used for built-in method references. */
var arrayProto = Array.prototype

/** Built-in value references. */
var splice = arrayProto.splice

/**
 * Removes `key` and its value from the list cache.
 *
 * @private
 * @name delete
 * @memberOf ListCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function listCacheDelete(key) {
  var data = this.__data__,
    index = _assocIndexOf(data, key)

  if (index < 0) {
    return false
  }
  var lastIndex = data.length - 1
  if (index == lastIndex) {
    data.pop()
  } else {
    splice.call(data, index, 1)
  }
  --this.size
  return true
}

var _listCacheDelete = listCacheDelete

/**
 * Gets the list cache value for `key`.
 *
 * @private
 * @name get
 * @memberOf ListCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function listCacheGet(key) {
  var data = this.__data__,
    index = _assocIndexOf(data, key)

  return index < 0 ? undefined : data[index][1]
}

var _listCacheGet = listCacheGet

/**
 * Checks if a list cache value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf ListCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function listCacheHas(key) {
  return _assocIndexOf(this.__data__, key) > -1
}

var _listCacheHas = listCacheHas

/**
 * Sets the list cache `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf ListCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the list cache instance.
 */
function listCacheSet(key, value) {
  var data = this.__data__,
    index = _assocIndexOf(data, key)

  if (index < 0) {
    ++this.size
    data.push([key, value])
  } else {
    data[index][1] = value
  }
  return this
}

var _listCacheSet = listCacheSet

/**
 * Creates an list cache object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function ListCache(entries) {
  var index = -1,
    length = entries == null ? 0 : entries.length

  this.clear()
  while (++index < length) {
    var entry = entries[index]
    this.set(entry[0], entry[1])
  }
}

// Add methods to `ListCache`.
ListCache.prototype.clear = _listCacheClear
ListCache.prototype['delete'] = _listCacheDelete
ListCache.prototype.get = _listCacheGet
ListCache.prototype.has = _listCacheHas
ListCache.prototype.set = _listCacheSet

var _ListCache = ListCache

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = new _ListCache()
  this.size = 0
}

var _stackClear = stackClear

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
    result = data['delete'](key)

  this.size = data.size
  return result
}

var _stackDelete = stackDelete

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  return this.__data__.get(key)
}

var _stackGet = stackGet

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  return this.__data__.has(key)
}

var _stackHas = stackHas

/** Detect free variable `global` from Node.js. */
var freeGlobal =
  typeof commonjsGlobal == 'object' &&
  commonjsGlobal &&
  commonjsGlobal.Object === Object &&
  commonjsGlobal

var _freeGlobal = freeGlobal

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self

/** Used as a reference to the global object. */
var root = _freeGlobal || freeSelf || Function('return this')()

var _root = root

/** Built-in value references. */
var Symbol$1 = _root.Symbol

var _Symbol = Symbol$1

/** Used for built-in method references. */
var objectProto = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString = objectProto.toString

/** Built-in value references. */
var symToStringTag = _Symbol ? _Symbol.toStringTag : undefined

/**
 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the raw `toStringTag`.
 */
function getRawTag(value) {
  var isOwn = hasOwnProperty.call(value, symToStringTag),
    tag = value[symToStringTag]

  try {
    value[symToStringTag] = undefined
    var unmasked = true
  } catch (e) {}

  var result = nativeObjectToString.call(value)
  if (unmasked) {
    if (isOwn) {
      value[symToStringTag] = tag
    } else {
      delete value[symToStringTag]
    }
  }
  return result
}

var _getRawTag = getRawTag

/** Used for built-in method references. */
var objectProto$1 = Object.prototype

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var nativeObjectToString$1 = objectProto$1.toString

/**
 * Converts `value` to a string using `Object.prototype.toString`.
 *
 * @private
 * @param {*} value The value to convert.
 * @returns {string} Returns the converted string.
 */
function objectToString(value) {
  return nativeObjectToString$1.call(value)
}

var _objectToString = objectToString

/** `Object#toString` result references. */
var nullTag = '[object Null]',
  undefinedTag = '[object Undefined]'

/** Built-in value references. */
var symToStringTag$1 = _Symbol ? _Symbol.toStringTag : undefined

/**
 * The base implementation of `getTag` without fallbacks for buggy environments.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function baseGetTag(value) {
  if (value == null) {
    return value === undefined ? undefinedTag : nullTag
  }
  return symToStringTag$1 && symToStringTag$1 in Object(value)
    ? _getRawTag(value)
    : _objectToString(value)
}

var _baseGetTag = baseGetTag

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value
  return value != null && (type == 'object' || type == 'function')
}

var isObject_1 = isObject

/** `Object#toString` result references. */
var asyncTag = '[object AsyncFunction]',
  funcTag = '[object Function]',
  genTag = '[object GeneratorFunction]',
  proxyTag = '[object Proxy]'

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  if (!isObject_1(value)) {
    return false
  }
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 9 which returns 'object' for typed arrays and other constructors.
  var tag = _baseGetTag(value)
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag
}

var isFunction_1 = isFunction

/** Used to detect overreaching core-js shims. */
var coreJsData = _root['__core-js_shared__']

var _coreJsData = coreJsData

/** Used to detect methods masquerading as native. */
var maskSrcKey = (function () {
  var uid = /[^.]+$/.exec(
    (_coreJsData && _coreJsData.keys && _coreJsData.keys.IE_PROTO) || ''
  )
  return uid ? 'Symbol(src)_1.' + uid : ''
})()

/**
 * Checks if `func` has its source masked.
 *
 * @private
 * @param {Function} func The function to check.
 * @returns {boolean} Returns `true` if `func` is masked, else `false`.
 */
function isMasked(func) {
  return !!maskSrcKey && maskSrcKey in func
}

var _isMasked = isMasked

/** Used for built-in method references. */
var funcProto = Function.prototype

/** Used to resolve the decompiled source of functions. */
var funcToString = funcProto.toString

/**
 * Converts `func` to its source code.
 *
 * @private
 * @param {Function} func The function to convert.
 * @returns {string} Returns the source code.
 */
function toSource(func) {
  if (func != null) {
    try {
      return funcToString.call(func)
    } catch (e) {}
    try {
      return func + ''
    } catch (e) {}
  }
  return ''
}

var _toSource = toSource

/**
 * Used to match `RegExp`
 * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
 */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g

/** Used to detect host constructors (Safari). */
var reIsHostCtor = /^\[object .+?Constructor\]$/

/** Used for built-in method references. */
var funcProto$1 = Function.prototype,
  objectProto$2 = Object.prototype

/** Used to resolve the decompiled source of functions. */
var funcToString$1 = funcProto$1.toString

/** Used to check objects for own properties. */
var hasOwnProperty$1 = objectProto$2.hasOwnProperty

/** Used to detect if a method is native. */
var reIsNative = RegExp(
  '^' +
    funcToString$1
      .call(hasOwnProperty$1)
      .replace(reRegExpChar, '\\$&')
      .replace(
        /hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,
        '$1.*?'
      ) +
    '$'
)

/**
 * The base implementation of `_.isNative` without bad shim checks.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function,
 *  else `false`.
 */
function baseIsNative(value) {
  if (!isObject_1(value) || _isMasked(value)) {
    return false
  }
  var pattern = isFunction_1(value) ? reIsNative : reIsHostCtor
  return pattern.test(_toSource(value))
}

var _baseIsNative = baseIsNative

/**
 * Gets the value at `key` of `object`.
 *
 * @private
 * @param {Object} [object] The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function getValue(object, key) {
  return object == null ? undefined : object[key]
}

var _getValue = getValue

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = _getValue(object, key)
  return _baseIsNative(value) ? value : undefined
}

var _getNative = getNative

/* Built-in method references that are verified to be native. */
var Map$1 = _getNative(_root, 'Map')

var _Map = Map$1

/* Built-in method references that are verified to be native. */
var nativeCreate = _getNative(Object, 'create')

var _nativeCreate = nativeCreate

/**
 * Removes all key-value entries from the hash.
 *
 * @private
 * @name clear
 * @memberOf Hash
 */
function hashClear() {
  this.__data__ = _nativeCreate ? _nativeCreate(null) : {}
  this.size = 0
}

var _hashClear = hashClear

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @name delete
 * @memberOf Hash
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(key) {
  var result = this.has(key) && delete this.__data__[key]
  this.size -= result ? 1 : 0
  return result
}

var _hashDelete = hashDelete

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__'

/** Used for built-in method references. */
var objectProto$3 = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty$2 = objectProto$3.hasOwnProperty

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @name get
 * @memberOf Hash
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(key) {
  var data = this.__data__
  if (_nativeCreate) {
    var result = data[key]
    return result === HASH_UNDEFINED ? undefined : result
  }
  return hasOwnProperty$2.call(data, key) ? data[key] : undefined
}

var _hashGet = hashGet

/** Used for built-in method references. */
var objectProto$4 = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty$3 = objectProto$4.hasOwnProperty

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Hash
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(key) {
  var data = this.__data__
  return _nativeCreate
    ? data[key] !== undefined
    : hasOwnProperty$3.call(data, key)
}

var _hashHas = hashHas

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED$1 = '__lodash_hash_undefined__'

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Hash
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the hash instance.
 */
function hashSet(key, value) {
  var data = this.__data__
  this.size += this.has(key) ? 0 : 1
  data[key] = _nativeCreate && value === undefined ? HASH_UNDEFINED$1 : value
  return this
}

var _hashSet = hashSet

/**
 * Creates a hash object.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Hash(entries) {
  var index = -1,
    length = entries == null ? 0 : entries.length

  this.clear()
  while (++index < length) {
    var entry = entries[index]
    this.set(entry[0], entry[1])
  }
}

// Add methods to `Hash`.
Hash.prototype.clear = _hashClear
Hash.prototype['delete'] = _hashDelete
Hash.prototype.get = _hashGet
Hash.prototype.has = _hashHas
Hash.prototype.set = _hashSet

var _Hash = Hash

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapCacheClear() {
  this.size = 0
  this.__data__ = {
    hash: new _Hash(),
    map: new (_Map || _ListCache)(),
    string: new _Hash(),
  }
}

var _mapCacheClear = mapCacheClear

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value
  return type == 'string' ||
    type == 'number' ||
    type == 'symbol' ||
    type == 'boolean'
    ? value !== '__proto__'
    : value === null
}

var _isKeyable = isKeyable

/**
 * Gets the data for `map`.
 *
 * @private
 * @param {Object} map The map to query.
 * @param {string} key The reference key.
 * @returns {*} Returns the map data.
 */
function getMapData(map, key) {
  var data = map.__data__
  return _isKeyable(key)
    ? data[typeof key == 'string' ? 'string' : 'hash']
    : data.map
}

var _getMapData = getMapData

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapCacheDelete(key) {
  var result = _getMapData(this, key)['delete'](key)
  this.size -= result ? 1 : 0
  return result
}

var _mapCacheDelete = mapCacheDelete

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapCacheGet(key) {
  return _getMapData(this, key).get(key)
}

var _mapCacheGet = mapCacheGet

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapCacheHas(key) {
  return _getMapData(this, key).has(key)
}

var _mapCacheHas = mapCacheHas

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache instance.
 */
function mapCacheSet(key, value) {
  var data = _getMapData(this, key),
    size = data.size

  data.set(key, value)
  this.size += data.size == size ? 0 : 1
  return this
}

var _mapCacheSet = mapCacheSet

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function MapCache(entries) {
  var index = -1,
    length = entries == null ? 0 : entries.length

  this.clear()
  while (++index < length) {
    var entry = entries[index]
    this.set(entry[0], entry[1])
  }
}

// Add methods to `MapCache`.
MapCache.prototype.clear = _mapCacheClear
MapCache.prototype['delete'] = _mapCacheDelete
MapCache.prototype.get = _mapCacheGet
MapCache.prototype.has = _mapCacheHas
MapCache.prototype.set = _mapCacheSet

var _MapCache = MapCache

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache instance.
 */
function stackSet(key, value) {
  var data = this.__data__
  if (data instanceof _ListCache) {
    var pairs = data.__data__
    if (!_Map || pairs.length < LARGE_ARRAY_SIZE - 1) {
      pairs.push([key, value])
      this.size = ++data.size
      return this
    }
    data = this.__data__ = new _MapCache(pairs)
  }
  data.set(key, value)
  this.size = data.size
  return this
}

var _stackSet = stackSet

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [entries] The key-value pairs to cache.
 */
function Stack(entries) {
  var data = (this.__data__ = new _ListCache(entries))
  this.size = data.size
}

// Add methods to `Stack`.
Stack.prototype.clear = _stackClear
Stack.prototype['delete'] = _stackDelete
Stack.prototype.get = _stackGet
Stack.prototype.has = _stackHas
Stack.prototype.set = _stackSet

var _Stack = Stack

var defineProperty = (function () {
  try {
    var func = _getNative(Object, 'defineProperty')
    func({}, '', {})
    return func
  } catch (e) {}
})()

var _defineProperty = defineProperty

/**
 * The base implementation of `assignValue` and `assignMergeValue` without
 * value checks.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function baseAssignValue(object, key, value) {
  if (key == '__proto__' && _defineProperty) {
    _defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      value: value,
      writable: true,
    })
  } else {
    object[key] = value
  }
}

var _baseAssignValue = baseAssignValue

/**
 * This function is like `assignValue` except that it doesn't assign
 * `undefined` values.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignMergeValue(object, key, value) {
  if (
    (value !== undefined && !eq_1(object[key], value)) ||
    (value === undefined && !(key in object))
  ) {
    _baseAssignValue(object, key, value)
  }
}

var _assignMergeValue = assignMergeValue

/**
 * Creates a base function for methods like `_.forIn` and `_.forOwn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function (object, iteratee, keysFunc) {
    var index = -1,
      iterable = Object(object),
      props = keysFunc(object),
      length = props.length

    while (length--) {
      var key = props[fromRight ? length : ++index]
      if (iteratee(iterable[key], key, iterable) === false) {
        break
      }
    }
    return object
  }
}

var _createBaseFor = createBaseFor

/**
 * The base implementation of `baseForOwn` which iterates over `object`
 * properties returned by `keysFunc` and invokes `iteratee` for each property.
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = _createBaseFor()

var _baseFor = baseFor

var _cloneBuffer = createCommonjsModule(function (module, exports) {
  /** Detect free variable `exports`. */
  var freeExports = exports && !exports.nodeType && exports

  /** Detect free variable `module`. */
  var freeModule =
    freeExports && 'object' == 'object' && module && !module.nodeType && module

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports

  /** Built-in value references. */
  var Buffer = moduleExports ? _root.Buffer : undefined,
    allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined

  /**
   * Creates a clone of  `buffer`.
   *
   * @private
   * @param {Buffer} buffer The buffer to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Buffer} Returns the cloned buffer.
   */
  function cloneBuffer(buffer, isDeep) {
    if (isDeep) {
      return buffer.slice()
    }
    var length = buffer.length,
      result = allocUnsafe
        ? allocUnsafe(length)
        : new buffer.constructor(length)

    buffer.copy(result)
    return result
  }

  module.exports = cloneBuffer
})

/** Built-in value references. */
var Uint8Array = _root.Uint8Array

var _Uint8Array = Uint8Array

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength)
  new _Uint8Array(result).set(new _Uint8Array(arrayBuffer))
  return result
}

var _cloneArrayBuffer = cloneArrayBuffer

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? _cloneArrayBuffer(typedArray.buffer) : typedArray.buffer
  return new typedArray.constructor(
    buffer,
    typedArray.byteOffset,
    typedArray.length
  )
}

var _cloneTypedArray = cloneTypedArray

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
    length = source.length

  array || (array = Array(length))
  while (++index < length) {
    array[index] = source[index]
  }
  return array
}

var _copyArray = copyArray

/** Built-in value references. */
var objectCreate = Object.create

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} proto The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function () {
  function object() {}
  return function (proto) {
    if (!isObject_1(proto)) {
      return {}
    }
    if (objectCreate) {
      return objectCreate(proto)
    }
    object.prototype = proto
    var result = new object()
    object.prototype = undefined
    return result
  }
})()

var _baseCreate = baseCreate

/**
 * Creates a unary function that invokes `func` with its argument transformed.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {Function} transform The argument transform.
 * @returns {Function} Returns the new function.
 */
function overArg(func, transform) {
  return function (arg) {
    return func(transform(arg))
  }
}

var _overArg = overArg

/** Built-in value references. */
var getPrototype = _overArg(Object.getPrototypeOf, Object)

var _getPrototype = getPrototype

/** Used for built-in method references. */
var objectProto$5 = Object.prototype

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
    proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$5

  return value === proto
}

var _isPrototype = isPrototype

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  return typeof object.constructor == 'function' && !_isPrototype(object)
    ? _baseCreate(_getPrototype(object))
    : {}
}

var _initCloneObject = initCloneObject

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return value != null && typeof value == 'object'
}

var isObjectLike_1 = isObjectLike

/** `Object#toString` result references. */
var argsTag = '[object Arguments]'

/**
 * The base implementation of `_.isArguments`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 */
function baseIsArguments(value) {
  return isObjectLike_1(value) && _baseGetTag(value) == argsTag
}

var _baseIsArguments = baseIsArguments

/** Used for built-in method references. */
var objectProto$6 = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty$4 = objectProto$6.hasOwnProperty

/** Built-in value references. */
var propertyIsEnumerable = objectProto$6.propertyIsEnumerable

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
var isArguments = _baseIsArguments(
  (function () {
    return arguments
  })()
)
  ? _baseIsArguments
  : function (value) {
      return (
        isObjectLike_1(value) &&
        hasOwnProperty$4.call(value, 'callee') &&
        !propertyIsEnumerable.call(value, 'callee')
      )
    }

var isArguments_1 = isArguments

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray

var isArray_1 = isArray

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return (
    typeof value == 'number' &&
    value > -1 &&
    value % 1 == 0 &&
    value <= MAX_SAFE_INTEGER
  )
}

var isLength_1 = isLength

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength_1(value.length) && !isFunction_1(value)
}

var isArrayLike_1 = isArrayLike

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike_1(value) && isArrayLike_1(value)
}

var isArrayLikeObject_1 = isArrayLikeObject

/**
 * This method returns `false`.
 *
 * @static
 * @memberOf _
 * @since 4.13.0
 * @category Util
 * @returns {boolean} Returns `false`.
 * @example
 *
 * _.times(2, _.stubFalse);
 * // => [false, false]
 */
function stubFalse() {
  return false
}

var stubFalse_1 = stubFalse

var isBuffer_1 = createCommonjsModule(function (module, exports) {
  /** Detect free variable `exports`. */
  var freeExports = exports && !exports.nodeType && exports

  /** Detect free variable `module`. */
  var freeModule =
    freeExports && 'object' == 'object' && module && !module.nodeType && module

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports

  /** Built-in value references. */
  var Buffer = moduleExports ? _root.Buffer : undefined

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined

  /**
   * Checks if `value` is a buffer.
   *
   * @static
   * @memberOf _
   * @since 4.3.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
   * @example
   *
   * _.isBuffer(new Buffer(2));
   * // => true
   *
   * _.isBuffer(new Uint8Array(2));
   * // => false
   */
  var isBuffer = nativeIsBuffer || stubFalse_1

  module.exports = isBuffer
})

/** `Object#toString` result references. */
var objectTag = '[object Object]'

/** Used for built-in method references. */
var funcProto$2 = Function.prototype,
  objectProto$7 = Object.prototype

/** Used to resolve the decompiled source of functions. */
var funcToString$2 = funcProto$2.toString

/** Used to check objects for own properties. */
var hasOwnProperty$5 = objectProto$7.hasOwnProperty

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString$2.call(Object)

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @since 0.8.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike_1(value) || _baseGetTag(value) != objectTag) {
    return false
  }
  var proto = _getPrototype(value)
  if (proto === null) {
    return true
  }
  var Ctor = hasOwnProperty$5.call(proto, 'constructor') && proto.constructor
  return (
    typeof Ctor == 'function' &&
    Ctor instanceof Ctor &&
    funcToString$2.call(Ctor) == objectCtorString
  )
}

var isPlainObject_1 = isPlainObject

/** `Object#toString` result references. */
var argsTag$1 = '[object Arguments]',
  arrayTag = '[object Array]',
  boolTag = '[object Boolean]',
  dateTag = '[object Date]',
  errorTag = '[object Error]',
  funcTag$1 = '[object Function]',
  mapTag = '[object Map]',
  numberTag = '[object Number]',
  objectTag$1 = '[object Object]',
  regexpTag = '[object RegExp]',
  setTag = '[object Set]',
  stringTag = '[object String]',
  weakMapTag = '[object WeakMap]'

var arrayBufferTag = '[object ArrayBuffer]',
  dataViewTag = '[object DataView]',
  float32Tag = '[object Float32Array]',
  float64Tag = '[object Float64Array]',
  int8Tag = '[object Int8Array]',
  int16Tag = '[object Int16Array]',
  int32Tag = '[object Int32Array]',
  uint8Tag = '[object Uint8Array]',
  uint8ClampedTag = '[object Uint8ClampedArray]',
  uint16Tag = '[object Uint16Array]',
  uint32Tag = '[object Uint32Array]'

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {}
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[
  int8Tag
] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[
  uint8Tag
] = typedArrayTags[uint8ClampedTag] = typedArrayTags[
  uint16Tag
] = typedArrayTags[uint32Tag] = true
typedArrayTags[argsTag$1] = typedArrayTags[arrayTag] = typedArrayTags[
  arrayBufferTag
] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[
  dateTag
] = typedArrayTags[errorTag] = typedArrayTags[funcTag$1] = typedArrayTags[
  mapTag
] = typedArrayTags[numberTag] = typedArrayTags[objectTag$1] = typedArrayTags[
  regexpTag
] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[
  weakMapTag
] = false

/**
 * The base implementation of `_.isTypedArray` without Node.js optimizations.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 */
function baseIsTypedArray(value) {
  return (
    isObjectLike_1(value) &&
    isLength_1(value.length) &&
    !!typedArrayTags[_baseGetTag(value)]
  )
}

var _baseIsTypedArray = baseIsTypedArray

/**
 * The base implementation of `_.unary` without support for storing metadata.
 *
 * @private
 * @param {Function} func The function to cap arguments for.
 * @returns {Function} Returns the new capped function.
 */
function baseUnary(func) {
  return function (value) {
    return func(value)
  }
}

var _baseUnary = baseUnary

var _nodeUtil = createCommonjsModule(function (module, exports) {
  /** Detect free variable `exports`. */
  var freeExports = exports && !exports.nodeType && exports

  /** Detect free variable `module`. */
  var freeModule =
    freeExports && 'object' == 'object' && module && !module.nodeType && module

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports

  /** Detect free variable `process` from Node.js. */
  var freeProcess = moduleExports && _freeGlobal.process

  /** Used to access faster Node.js helpers. */
  var nodeUtil = (function () {
    try {
      // Use `util.types` for Node.js 10+.
      var types =
        freeModule && freeModule.require && freeModule.require('util').types

      if (types) {
        return types
      }

      // Legacy `process.binding('util')` for Node.js < 10.
      return freeProcess && freeProcess.binding && freeProcess.binding('util')
    } catch (e) {}
  })()

  module.exports = nodeUtil
})

/* Node.js helper references. */
var nodeIsTypedArray = _nodeUtil && _nodeUtil.isTypedArray

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
var isTypedArray = nodeIsTypedArray
  ? _baseUnary(nodeIsTypedArray)
  : _baseIsTypedArray

var isTypedArray_1 = isTypedArray

/**
 * Gets the value at `key`, unless `key` is "__proto__" or "constructor".
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the property to get.
 * @returns {*} Returns the property value.
 */
function safeGet(object, key) {
  if (key === 'constructor' && typeof object[key] === 'function') {
    return
  }

  if (key == '__proto__') {
    return
  }

  return object[key]
}

var _safeGet = safeGet

/** Used for built-in method references. */
var objectProto$8 = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty$6 = objectProto$8.hasOwnProperty

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key]
  if (
    !(hasOwnProperty$6.call(object, key) && eq_1(objValue, value)) ||
    (value === undefined && !(key in object))
  ) {
    _baseAssignValue(object, key, value)
  }
}

var _assignValue = assignValue

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  var isNew = !object
  object || (object = {})

  var index = -1,
    length = props.length

  while (++index < length) {
    var key = props[index]

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined

    if (newValue === undefined) {
      newValue = source[key]
    }
    if (isNew) {
      _baseAssignValue(object, key, newValue)
    } else {
      _assignValue(object, key, newValue)
    }
  }
  return object
}

var _copyObject = copyObject

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
    result = Array(n)

  while (++index < n) {
    result[index] = iteratee(index)
  }
  return result
}

var _baseTimes = baseTimes

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER$1 = 9007199254740991

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  var type = typeof value
  length = length == null ? MAX_SAFE_INTEGER$1 : length

  return (
    !!length &&
    (type == 'number' || (type != 'symbol' && reIsUint.test(value))) &&
    value > -1 &&
    value % 1 == 0 &&
    value < length
  )
}

var _isIndex = isIndex

/** Used for built-in method references. */
var objectProto$9 = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty$7 = objectProto$9.hasOwnProperty

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  var isArr = isArray_1(value),
    isArg = !isArr && isArguments_1(value),
    isBuff = !isArr && !isArg && isBuffer_1(value),
    isType = !isArr && !isArg && !isBuff && isTypedArray_1(value),
    skipIndexes = isArr || isArg || isBuff || isType,
    result = skipIndexes ? _baseTimes(value.length, String) : [],
    length = result.length

  for (var key in value) {
    if (
      (inherited || hasOwnProperty$7.call(value, key)) &&
      !(
        skipIndexes &&
        // Safari 9 has enumerable `arguments.length` in strict mode.
        (key == 'length' ||
          // Node.js 0.10 has enumerable non-index properties on buffers.
          (isBuff && (key == 'offset' || key == 'parent')) ||
          // PhantomJS 2 has enumerable non-index properties on typed arrays.
          (isType &&
            (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
          // Skip index properties.
          _isIndex(key, length))
      )
    ) {
      result.push(key)
    }
  }
  return result
}

var _arrayLikeKeys = arrayLikeKeys

/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = []
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key)
    }
  }
  return result
}

var _nativeKeysIn = nativeKeysIn

/** Used for built-in method references. */
var objectProto$a = Object.prototype

/** Used to check objects for own properties. */
var hasOwnProperty$8 = objectProto$a.hasOwnProperty

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject_1(object)) {
    return _nativeKeysIn(object)
  }
  var isProto = _isPrototype(object),
    result = []

  for (var key in object) {
    if (
      !(
        key == 'constructor' &&
        (isProto || !hasOwnProperty$8.call(object, key))
      )
    ) {
      result.push(key)
    }
  }
  return result
}

var _baseKeysIn = baseKeysIn

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike_1(object)
    ? _arrayLikeKeys(object, true)
    : _baseKeysIn(object)
}

var keysIn_1 = keysIn

/**
 * Converts `value` to a plain object flattening inherited enumerable string
 * keyed properties of `value` to own properties of the plain object.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {Object} Returns the converted plain object.
 * @example
 *
 * function Foo() {
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.assign({ 'a': 1 }, new Foo);
 * // => { 'a': 1, 'b': 2 }
 *
 * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
 * // => { 'a': 1, 'b': 2, 'c': 3 }
 */
function toPlainObject(value) {
  return _copyObject(value, keysIn_1(value))
}

var toPlainObject_1 = toPlainObject

/**
 * A specialized version of `baseMerge` for arrays and objects which performs
 * deep merges and tracks traversed objects enabling objects with circular
 * references to be merged.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {string} key The key of the value to merge.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} mergeFunc The function to merge values.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {Object} [stack] Tracks traversed source values and their merged
 *  counterparts.
 */
function baseMergeDeep(
  object,
  source,
  key,
  srcIndex,
  mergeFunc,
  customizer,
  stack
) {
  var objValue = _safeGet(object, key),
    srcValue = _safeGet(source, key),
    stacked = stack.get(srcValue)

  if (stacked) {
    _assignMergeValue(object, key, stacked)
    return
  }
  var newValue = customizer
    ? customizer(objValue, srcValue, key + '', object, source, stack)
    : undefined

  var isCommon = newValue === undefined

  if (isCommon) {
    var isArr = isArray_1(srcValue),
      isBuff = !isArr && isBuffer_1(srcValue),
      isTyped = !isArr && !isBuff && isTypedArray_1(srcValue)

    newValue = srcValue
    if (isArr || isBuff || isTyped) {
      if (isArray_1(objValue)) {
        newValue = objValue
      } else if (isArrayLikeObject_1(objValue)) {
        newValue = _copyArray(objValue)
      } else if (isBuff) {
        isCommon = false
        newValue = _cloneBuffer(srcValue, true)
      } else if (isTyped) {
        isCommon = false
        newValue = _cloneTypedArray(srcValue, true)
      } else {
        newValue = []
      }
    } else if (isPlainObject_1(srcValue) || isArguments_1(srcValue)) {
      newValue = objValue
      if (isArguments_1(objValue)) {
        newValue = toPlainObject_1(objValue)
      } else if (!isObject_1(objValue) || isFunction_1(objValue)) {
        newValue = _initCloneObject(srcValue)
      }
    } else {
      isCommon = false
    }
  }
  if (isCommon) {
    // Recursively merge objects and arrays (susceptible to call stack limits).
    stack.set(srcValue, newValue)
    mergeFunc(newValue, srcValue, srcIndex, customizer, stack)
    stack['delete'](srcValue)
  }
  _assignMergeValue(object, key, newValue)
}

var _baseMergeDeep = baseMergeDeep

/**
 * The base implementation of `_.merge` without support for multiple sources.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} [customizer] The function to customize merged values.
 * @param {Object} [stack] Tracks traversed source values and their merged
 *  counterparts.
 */
function baseMerge(object, source, srcIndex, customizer, stack) {
  if (object === source) {
    return
  }
  _baseFor(
    source,
    function (srcValue, key) {
      stack || (stack = new _Stack())
      if (isObject_1(srcValue)) {
        _baseMergeDeep(
          object,
          source,
          key,
          srcIndex,
          baseMerge,
          customizer,
          stack
        )
      } else {
        var newValue = customizer
          ? customizer(
              _safeGet(object, key),
              srcValue,
              key + '',
              object,
              source,
              stack
            )
          : undefined

        if (newValue === undefined) {
          newValue = srcValue
        }
        _assignMergeValue(object, key, newValue)
      }
    },
    keysIn_1
  )
}

var _baseMerge = baseMerge

/**
 * This method returns the first argument it receives.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'a': 1 };
 *
 * console.log(_.identity(object) === object);
 * // => true
 */
function identity(value) {
  return value
}

var identity_1 = identity

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0:
      return func.call(thisArg)
    case 1:
      return func.call(thisArg, args[0])
    case 2:
      return func.call(thisArg, args[0], args[1])
    case 3:
      return func.call(thisArg, args[0], args[1], args[2])
  }
  return func.apply(thisArg, args)
}

var _apply = apply

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max

/**
 * A specialized version of `baseRest` which transforms the rest array.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @param {Function} transform The rest array transform.
 * @returns {Function} Returns the new function.
 */
function overRest(func, start, transform) {
  start = nativeMax(start === undefined ? func.length - 1 : start, 0)
  return function () {
    var args = arguments,
      index = -1,
      length = nativeMax(args.length - start, 0),
      array = Array(length)

    while (++index < length) {
      array[index] = args[start + index]
    }
    index = -1
    var otherArgs = Array(start + 1)
    while (++index < start) {
      otherArgs[index] = args[index]
    }
    otherArgs[start] = transform(array)
    return _apply(func, this, otherArgs)
  }
}

var _overRest = overRest

/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new constant function.
 * @example
 *
 * var objects = _.times(2, _.constant({ 'a': 1 }));
 *
 * console.log(objects);
 * // => [{ 'a': 1 }, { 'a': 1 }]
 *
 * console.log(objects[0] === objects[1]);
 * // => true
 */
function constant(value) {
  return function () {
    return value
  }
}

var constant_1 = constant

/**
 * The base implementation of `setToString` without support for hot loop shorting.
 *
 * @private
 * @param {Function} func The function to modify.
 * @param {Function} string The `toString` result.
 * @returns {Function} Returns `func`.
 */
var baseSetToString = !_defineProperty
  ? identity_1
  : function (func, string) {
      return _defineProperty(func, 'toString', {
        configurable: true,
        enumerable: false,
        value: constant_1(string),
        writable: true,
      })
    }

var _baseSetToString = baseSetToString

/** Used to detect hot functions by number of calls within a span of milliseconds. */
var HOT_COUNT = 800,
  HOT_SPAN = 16

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeNow = Date.now

/**
 * Creates a function that'll short out and invoke `identity` instead
 * of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
 * milliseconds.
 *
 * @private
 * @param {Function} func The function to restrict.
 * @returns {Function} Returns the new shortable function.
 */
function shortOut(func) {
  var count = 0,
    lastCalled = 0

  return function () {
    var stamp = nativeNow(),
      remaining = HOT_SPAN - (stamp - lastCalled)

    lastCalled = stamp
    if (remaining > 0) {
      if (++count >= HOT_COUNT) {
        return arguments[0]
      }
    } else {
      count = 0
    }
    return func.apply(undefined, arguments)
  }
}

var _shortOut = shortOut

/**
 * Sets the `toString` method of `func` to return `string`.
 *
 * @private
 * @param {Function} func The function to modify.
 * @param {Function} string The `toString` result.
 * @returns {Function} Returns `func`.
 */
var setToString = _shortOut(_baseSetToString)

var _setToString = setToString

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  return _setToString(_overRest(func, start, identity_1), func + '')
}

var _baseRest = baseRest

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject_1(object)) {
    return false
  }
  var type = typeof index
  if (
    type == 'number'
      ? isArrayLike_1(object) && _isIndex(index, object.length)
      : type == 'string' && index in object
  ) {
    return eq_1(object[index], value)
  }
  return false
}

var _isIterateeCall = isIterateeCall

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return _baseRest(function (object, sources) {
    var index = -1,
      length = sources.length,
      customizer = length > 1 ? sources[length - 1] : undefined,
      guard = length > 2 ? sources[2] : undefined

    customizer =
      assigner.length > 3 && typeof customizer == 'function'
        ? (length--, customizer)
        : undefined

    if (guard && _isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer
      length = 1
    }
    object = Object(object)
    while (++index < length) {
      var source = sources[index]
      if (source) {
        assigner(object, source, index, customizer)
      }
    }
    return object
  })
}

var _createAssigner = createAssigner

/**
 * This method is like `_.assign` except that it recursively merges own and
 * inherited enumerable string keyed properties of source objects into the
 * destination object. Source properties that resolve to `undefined` are
 * skipped if a destination value exists. Array and plain object properties
 * are merged recursively. Other objects and value types are overridden by
 * assignment. Source objects are applied from left to right. Subsequent
 * sources overwrite property assignments of previous sources.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 0.5.0
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var object = {
 *   'a': [{ 'b': 2 }, { 'd': 4 }]
 * };
 *
 * var other = {
 *   'a': [{ 'c': 3 }, { 'e': 5 }]
 * };
 *
 * _.merge(object, other);
 * // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
 */
var merge = _createAssigner(function (object, source, srcIndex) {
  _baseMerge(object, source, srcIndex)
})

var merge_1 = merge

const pReduce = (iterable, reducer, initialValue) =>
  new Promise((resolve, reject) => {
    const iterator = iterable[Symbol.iterator]()
    let index = 0

    const next = async (total) => {
      const element = iterator.next()

      if (element.done) {
        resolve(total)
        return
      }

      try {
        const value = await Promise.all([total, element.value])
        next(reducer(value[0], value[1], index++))
      } catch (error) {
        reject(error)
      }
    }

    next(initialValue)
  })

var pReduce_1 = pReduce
// TODO: Remove this for the next major release
var _default$6 = pReduce
pReduce_1.default = _default$6

const pWaterfall = (iterable, initialValue) =>
  pReduce_1(iterable, (previousValue, fn) => fn(previousValue), initialValue)

var pWaterfall_1 = pWaterfall
// TODO: Remove this for the next major release
var _default$7 = pWaterfall
pWaterfall_1.default = _default$7

var spinner = ora()

class Logger {
  constructor(options) {
    this.options = options || {}
  }

  setOptions(options) {
    Object.assign(this.options, options)
  }

  get isDebug() {
    return this.options.logLevel === 'verbose'
  }

  get isQuiet() {
    return this.options.logLevel === 'quiet'
  }

  warn(...args) {
    this.log(colors.yellow('warning'), ...args)
  }

  error(...args) {
    this.log(colors.red('error'), ...args)
  }

  success(...args) {
    this.log(colors.green('success'), ...args)
  }

  log(...args) {
    spinner.stop()
    if (this.isQuiet) return
    console.log(...args)
  }

  debug(...args) {
    if (!this.isDebug) return
    this.log(colors.magenta('verbose'), ...args)
  }

  progress(text) {
    if (this.isQuiet) return
    spinner.start(text)
  }
}

var logger = new Logger()

function progressPlugin({ title }) {
  return {
    name: 'progress',

    buildStart() {
      logger.progress(title)
    },

    transform(code, id) {
      if (!process.env.CI && process.stdout.isTTY) {
        logger.progress(`Bundling ${id.replace(process.cwd(), '.')}`)
      }

      return null
    },
  }
}

const { builtinModules } = module$1

const blacklist = ['sys']

// eslint-disable-next-line node/no-deprecated-api
var builtinModules_1 = (
  builtinModules || Object.keys(process.binding('natives'))
)
  .filter(
    (x) =>
      !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && !blacklist.includes(x)
  )
  .sort()

var slash = (path) => {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path)
  const hasNonAscii = /[^\u0000-\u0080]+/.test(path) // eslint-disable-line no-control-regex

  if (isExtendedLengthPath || hasNonAscii) {
    return path
  }

  return path.replace(/\\/g, '/')
}

function isExternal(externals, id, parentId) {
  id = slash(id)

  if (!Array.isArray(externals)) {
    externals = [externals]
  }

  for (const external of externals) {
    if (
      typeof external === 'string' &&
      (id === external || id.includes(`/node_modules/${external}/`))
    ) {
      return true
    }

    if (external instanceof RegExp) {
      if (external.test(id)) {
        return true
      }
    }

    if (typeof external === 'function') {
      if (external(id, parentId)) {
        return true
      }
    }
  }

  return false
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

var nodeResolvePlugin = (options) => {
  const plugin = require('@rollup/plugin-node-resolve').default({
    extensions: ['.js', '.json', '.jsx', '.ts', '.tsx'],
    preferBuiltins: true,
    mainFields: [
      options.browser && 'browser',
      'module',
      'jsnext:main',
      'main',
    ].filter(Boolean),
  })

  return Object.assign(Object.assign({}, plugin), {
    name: 'bili-custom-resolve',
    resolveId: _async(function (importee, importer) {
      return _await(
        plugin.resolveId(
          importee,
          importer || `${options.rootDir}/__no_importer__.js`
        ),
        function (resolved) {
          const id =
            (resolved === null || resolved === void 0 ? void 0 : resolved.id) ||
            resolved

          if (typeof id === 'string') {
            // Exclude built-in modules
            if (builtinModules_1.includes(id)) {
              return false
            } // If we don't intend to bundle node_modules
            // Mark it as external

            if (/node_modules/.test(id)) {
              if (!options.bundleNodeModules) {
                return false
              }

              if (Array.isArray(options.bundleNodeModules)) {
                const shouldBundle = options.bundleNodeModules.some((name) =>
                  id.includes(`/node_modules/${name}/`)
                )

                if (!shouldBundle) {
                  return false
                }
              }
            }

            if (isExternal(options.externals, id, importer)) {
              return false
            }

            if (/node_modules/.test(id) && !/^\.?\//.test(importee)) {
              logger.debug(
                `Bundled ${importee} because ${importer} imported it.`
              )
            }
          }

          return id
        }
      )
    }),
  })
}

var requireFromString = createCommonjsModule(function (module) {
  module.exports = function requireFromString(code, filename, opts) {
    if (typeof filename === 'object') {
      opts = filename
      filename = undefined
    }

    opts = opts || {}
    filename = filename || ''

    opts.appendPaths = opts.appendPaths || []
    opts.prependPaths = opts.prependPaths || []

    if (typeof code !== 'string') {
      throw new Error('code must be a string, not ' + typeof code)
    }

    var paths = module$1._nodeModulePaths(path.dirname(filename))

    var parent = module.parent
    var m = new module$1(filename, parent)
    m.filename = filename
    m.paths = []
      .concat(opts.prependPaths)
      .concat(paths)
      .concat(opts.appendPaths)
    m._compile(code, filename)

    var exports = m.exports
    parent &&
      parent.children &&
      parent.children.splice(parent.children.indexOf(m), 1)

    return exports
  }
})

const configLoader = new JoyCon({
  stopDir: path.dirname(process.cwd()),
})
configLoader.addLoader({
  test: /\.[jt]s$/,

  loadSync(id) {
    const content = require('@babel/core').transform(
      fs.readFileSync(id, 'utf8'),
      {
        babelrc: false,
        configFile: false,
        filename: id,
        presets: [
          [
            require('@babel/preset-env'),
            {
              targets: {
                node: 'current',
              },
            },
          ],
          id.endsWith('.ts') && require('@babel/preset-typescript'),
        ].filter(Boolean),
      }
    )

    const m = requireFromString(content && content.code ? content.code : '', id)
    return m.default || m
  },
})

/*!
 * stringify-author <https://github.com/jonschlinkert/stringify-author>
 *
 * Copyright (c) 2014-2015 Jon Schlinkert.
 * Licensed under the MIT license.
 */

var stringifyAuthor = function (author) {
  if (typeof author !== 'object') {
    throw new Error('expected an author to be an object')
  }

  var tmpl = { name: ['', ''], email: ['<', '>'], url: ['(', ')'] }
  var str = ''

  if (author.url) author.url = stripSlash(author.url)

  for (var key in tmpl) {
    if (author[key]) {
      str += tmpl[key][0] + author[key] + tmpl[key][1] + ' '
    }
  }
  return str.trim()
}

function stripSlash(str) {
  return str.replace(/\/$/, '')
}

var getBanner = (banner, pkg) => {
  if (!banner || typeof banner === 'string') {
    return banner || ''
  }

  banner = Object.assign(Object.assign({}, pkg), banner === true ? {} : banner)
  const author =
    typeof banner.author === 'string'
      ? banner.author
      : typeof banner.author === 'object'
      ? stringifyAuthor(banner.author)
      : ''
  const license = banner.license || ''
  return (
    '/*!\n' +
    ` * ${banner.name} v${banner.version}\n` +
    ` * (c) ${author || ''}\n` +
    (license && ` * Released under the ${license} License.\n`) +
    ' */'
  )
}

// TODO: PR to rollup-plugin-vue to allow this as an API option

function _await$1(value, then, direct) {
  if (direct) {
    return then ? then(value) : value
  }

  if (!value || !value.then) {
    value = Promise.resolve(value)
  }

  return then ? value.then(then) : value
}

function _call(body, then, direct) {
  if (direct) {
    return then ? then(body()) : body()
  }

  try {
    var result = Promise.resolve(body())
    return then ? result.then(then) : result
  } catch (e) {
    return Promise.reject(e)
  }
}

function _async$1(f) {
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

function _empty() {}

function _awaitIgnored(value, direct) {
  if (!direct) {
    return value && value.then ? value.then(_empty) : Promise.resolve()
  }
}

function _invokeIgnored(body) {
  var result = body()

  if (result && result.then) {
    return result.then(_empty)
  }
}

function _catch(body, recover) {
  try {
    var result = body()
  } catch (e) {
    return recover(e)
  }

  if (result && result.then) {
    return result.then(void 0, recover)
  }

  return result
}

function _invoke(body, then) {
  var result = body()

  if (result && result.then) {
    return result.then(then)
  }

  return then(result)
}

const printAssets = _async$1(function (assets, title) {
  return _await$1(
    Promise.resolve()
      .then(function () {
        return require('./index-75d3b0c7.js')
      })
      .then((res) => res.default),
    function (gzipSize) {
      return _await$1(
        Promise.all(
          [...assets.keys()].map(
            _async$1(function (relative) {
              const asset = assets.get(relative)
              const size = asset.source.length

              const _prettyBytes = prettyBytes(size),
                _colors$green = colors.green(relative)

              return _await$1(gzipSize(asset.source), function (_gzipSize) {
                return [_colors$green, _prettyBytes, prettyBytes(_gzipSize)]
              })
            })
          )
        ),
        function (table) {
          table.unshift(['File', 'Size', 'Gzipped'].map((v) => colors.dim(v)))
          logger.success(title)
          logger.log(
            boxen(
              textTable(table, {
                stringLength: stringWidth_1,
              })
            )
          )
        }
      )
    }
  )
})

process.env.BUILD = 'production'
class Bundler {
  constructor(config, options = {}) {
    this.options = options
    logger.setOptions({
      logLevel: options.logLevel,
    })
    this.rootDir = path.resolve(options.rootDir || '.')
    this.pkg = configLoader.loadSync({
      files: ['package.json'],
      cwd: this.rootDir,
    })

    if (!this.pkg.data) {
      this.pkg.data = {}
    }

    if (/\.mjs$/.test(this.pkg.data.module || this.pkg.data.main)) {
      logger.warn(
        `Bili no longer use .mjs extension for esm bundle, you should use .js instead!`
      )
    }

    const userConfig =
      options.configFile === false
        ? {}
        : configLoader.loadSync({
            files:
              typeof options.configFile === 'string'
                ? [options.configFile]
                : [
                    'bili.config.js',
                    'bili.config.ts',
                    '.bilirc.js',
                    '.bilirc.ts',
                    'package.json',
                  ],
            cwd: this.rootDir,
            packageKey: 'bili',
          })

    if (userConfig.path) {
      logger.debug(`Using config file:`, userConfig.path)
      this.configPath = userConfig.path
    }

    this.config = this.normalizeConfig(config, userConfig.data || {})
    this.bundles = new Set()
  }

  normalizeConfig(config, userConfig) {
    const externals = new Set([
      ...Object.keys(this.pkg.data.dependencies || {}),
      ...(Array.isArray(userConfig.externals)
        ? userConfig.externals
        : [userConfig.externals]),
      ...(Array.isArray(config.externals)
        ? config.externals
        : [config.externals]),
    ])
    const result = merge_1({}, userConfig, config, {
      input: config.input || userConfig.input || 'src/index.js',
      output: merge_1({}, userConfig.output, config.output),
      plugins: merge_1({}, userConfig.plugins, config.plugins),
      babel: merge_1(
        {
          asyncToPromises: true,
        },
        userConfig.babel,
        config.babel
      ),
      externals: [...externals].filter(Boolean),
    })
    result.output.dir = path.resolve(result.output.dir || 'dist')
    return result
  }

  createRollupConfig({ source, format, title, context, assets, config }) {
    const _this = this

    return _call(function () {
      // Always minify if config.minify is truthy
      // Otherwise infer by format
      const minify =
        config.output.minify === undefined
          ? format.endsWith('-min')
          : config.output.minify
      let minPlaceholder = ''
      let rollupFormat

      if (format.endsWith('-min')) {
        rollupFormat = format.replace(/-min$/, '')
        minPlaceholder = '.min'
      } else {
        rollupFormat = format
      } // UMD format should always bundle node_modules

      const bundleNodeModules =
        rollupFormat === 'umd' ||
        rollupFormat === 'iife' ||
        config.bundleNodeModules // rollup-plugin-typescript2 < v0.26 needs the `objectHashIgnoreUnknownHack`
      // option to be enabled to correctly handle async plugins, but it's no
      // longer needed (and causes a warning) if the user has a more recent
      // version installed. [1] if the plugin is installed, detect the version
      // and enable/disable the option accordingly.
      //
      // [1] https://github.com/egoist/bili/issues/305

      const getObjectHashIgnoreUnknownHack = () => {
        try {
          const { version } = _this.localRequire(
            'rollup-plugin-typescript2/package.json'
          )

          const semver = require('semver')

          return semver.lt(version, '0.26.0')
        } catch (e) {
          return true
        }
      }

      const pluginsOptions = {
        progress:
          config.plugins.progress !== false &&
          merge_1(
            {
              title,
            },
            config.plugins.progress
          ),
        json: config.plugins.json !== false && merge_1({}, config.plugins.json),
        hashbang:
          config.plugins.hashbang !== false &&
          merge_1({}, config.plugins.hashbang),
        'node-resolve':
          config.plugins['node-resolve'] !== false &&
          merge_1(
            {},
            {
              rootDir: _this.rootDir,
              bundleNodeModules,
              externals: config.externals,
              browser: config.output.target === 'browser',
            },
            config.plugins['node-resolve']
          ),
        postcss:
          config.plugins.postcss !== false &&
          merge_1(
            {
              extract: config.output.extractCSS !== false,
            },
            config.plugins.postcss
          ),
        vue:
          (source.hasVue || config.plugins.vue) &&
          merge_1(
            {
              css: false,
            },
            config.plugins.vue
          ),
        typescript2:
          (source.hasTs || config.plugins.typescript2) &&
          merge_1(
            {
              objectHashIgnoreUnknownHack: getObjectHashIgnoreUnknownHack(),
              tsconfigOverride: {
                compilerOptions: {
                  module: 'esnext',
                },
              },
            },
            config.plugins.typescript2
          ),
        babel:
          config.plugins.babel !== false &&
          merge_1(
            {
              exclude: 'node_modules/**',
              extensions: ['.js', '.jsx', '.mjs', '.ts', '.tsx', '.vue'],
              babelrc: config.babel.babelrc,
              configFile: config.babel.configFile,
              presetOptions: config.babel,
              babelHelpers: 'bundled',
            },
            config.plugins.babel
          ),
        buble:
          (config.plugins.buble || config.babel.minimal) &&
          merge_1(
            {
              exclude: 'node_modules/**',
              include: '**/*.{js,mjs,jsx,ts,tsx,vue}',
              transforms: {
                modules: false,
                dangerousForOf: true,
                dangerousTaggedTemplateString: true,
              },
            },
            config.plugins.buble
          ),
        commonjs:
          config.plugins.commonjs !== false &&
          merge_1({}, config.plugins.commonjs, {
            // `ignore` is required to allow dynamic require
            // See: https://github.com/rollup/rollup-plugin-commonjs/blob/4a22147456b1092dd565074dc33a63121675102a/src/index.js#L32
            ignore: (name) => {
              const { commonjs } = config.plugins

              if (commonjs && commonjs.ignore && commonjs.ignore(name)) {
                return true
              }

              return isExternal(config.externals, name)
            },
          }),
      }
      const env = Object.assign({}, config.env) // drop process.env.NODE_ENV from umd/iife

      if (
        ['umd', 'umd-min', 'iife', 'iife-min'].includes(format) &&
        env.NODE_ENV === undefined
      ) {
        env.NODE_ENV = minify ? 'production' : 'development'
      }

      pluginsOptions.replace = Object.assign(
        Object.assign(
          {},
          Object.keys(env).reduce((res, name) => {
            res[`process.env.${name}`] = JSON.stringify(env[name])
            return res
          }, {})
        ),
        config.plugins.replace
      )

      if (Object.keys(pluginsOptions.replace).length === 0) {
        pluginsOptions.replace = false
      }

      const banner = getBanner(config.banner, _this.pkg.data)

      if (minify) {
        const terserOptions = config.plugins.terser || {}
        pluginsOptions.terser = Object.assign(
          Object.assign({}, terserOptions),
          {
            output: Object.assign(
              Object.assign(
                {
                  comments: false,
                },
                terserOptions.output
              ),
              {
                // Add banner (if there is)
                preamble: banner,
              }
            ),
          }
        )
      }

      for (const name of Object.keys(config.plugins)) {
        if (pluginsOptions[name] === undefined) {
          Object.assign(pluginsOptions, {
            [name]: config.plugins[name],
          })
        }
      }

      const getPlugin = _async$1(function (name) {
        if (config.resolvePlugins && config.resolvePlugins[name]) {
          return config.resolvePlugins[name]
        }

        const pkg = require('../package')

        const isCommunityBuiltin = pkg.dependencies[`rollup-plugin-${name}`]
        const isOfficialBuiltin = pkg.dependencies[`@rollup/plugin-${name}`]
        return _await$1(
          name === 'babel'
            ? Promise.resolve().then(function () {
                return require('./babel-2e3a0fbe.js')
              })
            : name === 'node-resolve'
            ? nodeResolvePlugin
            : name === 'progress'
            ? progressPlugin
            : name.startsWith('@rollup/')
            ? _this.localRequire(name)
            : isCommunityBuiltin
            ? require(`rollup-plugin-${name}`)
            : isOfficialBuiltin
            ? require(`@rollup/plugin-${name}`)
            : _this.localRequire(`rollup-plugin-${name}`),
          function (plugin) {
            return name === 'terser' ? plugin.terser : plugin.default || plugin
          },
          !(name === 'babel')
        )
      })

      return _await$1(
        Promise.all(
          Object.keys(pluginsOptions)
            .filter((name) => pluginsOptions[name])
            .map(
              _async$1(function (name) {
                const options =
                  pluginsOptions[name] === true ? {} : pluginsOptions[name]
                return _await$1(getPlugin(name), function (plugin) {
                  if (typeof plugin !== 'function') {
                    throw new Error(
                      `Plugin "${name}" doesn't export a function, got ${plugin}`
                    )
                  }

                  return plugin(options)
                })
              })
            )
        ),
        function (plugins) {
          if (logger.isDebug) {
            for (const name of Object.keys(pluginsOptions)) {
              if (pluginsOptions[name]) {
                logger.debug(colors.dim(format), `Using plugin: ${name}`)
              }
            }
          } // Add bundle to out assets Map
          // So that we can log the stats when all builds completed
          // Make sure this is the last plugin!

          let startTime
          let endTime
          plugins.push({
            name: 'record-bundle',

            generateBundle(outputOptions, _assets) {
              const EXTS = [
                outputOptions.entryFileNames
                  ? path.extname(outputOptions.entryFileNames)
                  : '.js',
                '.css',
              ]

              for (const fileName of Object.keys(_assets)) {
                if (EXTS.some((ext) => fileName.endsWith(ext))) {
                  const file = _assets[fileName]
                  const absolute =
                    outputOptions.dir &&
                    path.resolve(outputOptions.dir, fileName)

                  if (absolute) {
                    const relative = path.relative(process.cwd(), absolute)
                    assets.set(relative, {
                      absolute,

                      get source() {
                        return file.type === 'asset'
                          ? file.source.toString()
                          : file.code
                      },
                    })
                  }
                }
              }
            },

            buildStart() {
              startTime = Date.now()
            },

            buildEnd() {
              endTime = Date.now()
            },

            writeBundle: _async$1(function () {
              return _awaitIgnored(
                printAssets(
                  assets,
                  `${title.replace('Bundle', 'Bundled')} ${colors.dim(
                    `(${prettyMs(endTime - startTime)})`
                  )}`
                )
              )
            }),
          })
          const defaultFileName = getDefaultFileName(rollupFormat)
          const getFileName = config.output.fileName || defaultFileName
          const fileNameTemplate =
            typeof getFileName === 'function'
              ? getFileName(
                  {
                    format: rollupFormat,
                    minify,
                  },
                  defaultFileName
                )
              : getFileName
          let fileName = fileNameTemplate
            .replace(/\[min\]/, minPlaceholder) // The `[ext]` placeholder no longer makes sense
            // Since we only output to `.js` now
            // Probably remove it in the future
            .replace(/\[ext\]/, '.js')

          if (rollupFormat === 'esm') {
            fileName = fileName.replace(/\[format\]/, 'esm')
          }

          return {
            inputConfig: {
              input: source.input,
              plugins,
              external: Object.keys(config.globals || {}).filter(
                (v) => !/^[\.\/]/.test(v)
              ),

              onwarn(warning) {
                if (typeof warning === 'string') {
                  return logger.warn(warning)
                }

                const code = (warning.code || '').toLowerCase()

                if (
                  code === 'mixed_exports' ||
                  code === 'missing_global_name'
                ) {
                  return
                }

                let message = warning.message

                if (code === 'unresolved_import' && warning.source) {
                  if (
                    format !== 'umd' ||
                    context.unresolved.has(warning.source)
                  ) {
                    return
                  }

                  context.unresolved.add(warning.source)
                  message = `${warning.source} is treated as external dependency`
                }

                logger.warn(
                  `${colors.yellow(`${code}`)}${colors.dim(':')} ${message}`
                )
              },
            },
            outputConfig: {
              globals: config.globals,
              format: rollupFormat,
              dir: path.resolve(config.output.dir || 'dist'),
              entryFileNames: fileName,
              name: config.output.moduleName,
              banner,
              sourcemap:
                typeof config.output.sourceMap === 'boolean'
                  ? config.output.sourceMap
                  : minify,
              sourcemapExcludeSources: config.output.sourceMapExcludeSources,
            },
          }
        }
      )
    })
  }

  run(options = {}) {
    const _this2 = this

    return _call(function () {
      let _exit = false
      const context = {
        unresolved: new Set(),
      }
      const tasks = []
      let { input } = _this2.config

      if (!Array.isArray(input)) {
        input = [input || 'src/index.js']
      }

      if (Array.isArray(input) && input.length === 0) {
        input = ['src/index.js']
      }

      const getMeta = (files) => {
        return {
          hasVue: files.some((file) => file.endsWith('.vue')),
          hasTs: files.some((file) => /\.tsx?$/.test(file)),
        }
      }

      const normalizeInputValue = (input) => {
        if (Array.isArray(input)) {
          return input.map(
            (v) =>
              `./${path.relative(_this2.rootDir, _this2.resolveRootDir(v))}`
          )
        }

        return Object.keys(input).reduce((res, entryName) => {
          res[entryName] = `./${path.relative(
            _this2.rootDir,
            _this2.resolveRootDir(input[entryName])
          )}`
          return res
        }, {})
      }

      const sources = input.map((v) => {
        if (typeof v === 'string') {
          const files = v.split(',')
          return Object.assign(
            {
              files,
              input: normalizeInputValue(files),
            },
            getMeta(files)
          )
        }

        const files = Object.values(v)
        return Object.assign(
          {
            files,
            input: normalizeInputValue(v),
          },
          getMeta(files)
        )
      })
      let { format, target } = _this2.config.output

      if (Array.isArray(format)) {
        if (format.length === 0) {
          format = ['cjs']
        }
      } else if (typeof format === 'string') {
        format = format.split(',')
      } else {
        format = ['cjs']
      }

      const formats = format

      for (const source of sources) {
        for (const format of formats) {
          let title = `Bundle ${source.files.join(', ')} in ${format} format`

          if (target) {
            title += ` for target ${target}`
          }

          tasks.push({
            title,
            getConfig: _async$1(function (context, task) {
              const assets = new Map()

              _this2.bundles.add(assets)

              const config = _this2.config.extendConfig
                ? _this2.config.extendConfig(merge_1({}, _this2.config), {
                    input: source.input,
                    format,
                  })
                : _this2.config
              return _await$1(
                _this2.createRollupConfig({
                  source,
                  format,
                  title: task.title,
                  context,
                  assets,
                  config,
                }),
                function (rollupConfig) {
                  return _this2.config.extendRollupConfig
                    ? _this2.config.extendRollupConfig(rollupConfig)
                    : rollupConfig
                }
              )
            }),
          })
        }
      }

      return _await$1(
        _invoke(
          function () {
            if (options.watch) {
              return _await$1(
                Promise.all(
                  tasks.map(
                    _async$1(function (task) {
                      return _await$1(task.getConfig(context, task), function ({
                        inputConfig,
                        outputConfig,
                      }) {
                        return Object.assign(Object.assign({}, inputConfig), {
                          output: outputConfig,
                          watch: {},
                        })
                      })
                    })
                  )
                ),
                function (configs) {
                  const watcher = rollup.watch(configs)
                  watcher.on('event', (e) => {
                    if (e.code === 'ERROR') {
                      logger.error(e.error.message)
                    }
                  })
                }
              )
            } else {
              return _catch(
                function () {
                  return _invokeIgnored(function () {
                    if (options.concurrent) {
                      return _awaitIgnored(
                        Promise.all(
                          tasks.map((task) => {
                            return _this2.build(task, context, options.write)
                          })
                        )
                      )
                    } else {
                      return _awaitIgnored(
                        pWaterfall_1(
                          tasks.map((task) => () => {
                            return _this2.build(task, context, options.write)
                          }),
                          context
                        )
                      )
                    }
                  })
                },
                function (err) {
                  spinner.stop()
                  throw err
                }
              )
            }
          },
          function (_result) {
            return _exit ? _result : _this2
          }
        )
      )
    })
  }

  build(task, context, write) {
    return _call(function () {
      return _await$1(
        _catch(
          function () {
            return _await$1(task.getConfig(context, task), function ({
              inputConfig,
              outputConfig,
            }) {
              return _await$1(rollup.rollup(inputConfig), function (bundle) {
                return _invokeIgnored(function () {
                  if (write) {
                    return _awaitIgnored(bundle.write(outputConfig))
                  } else {
                    return _awaitIgnored(bundle.generate(outputConfig))
                  }
                })
              })
            })
          },
          function (err) {
            err.rollup = true
            logger.error(task.title.replace('Bundle', 'Failed to bundle'))

            if (
              err.message.includes(
                'You must supply output.name for UMD bundles'
              )
            ) {
              err.code = 'require_module_name'
              err.message = `You must supply output.moduleName option or use --module-name <name> flag for UMD bundles`
            }

            throw err
          }
        )
      )
    })
  }

  handleError(err) {
    if (err.stack) {
      console.error()
      console.error(colors.bold(colors.red('Stack Trace:')))
      console.error(colors.dim(err.stack))
    }
  }

  resolveRootDir(...args) {
    return path.resolve(this.rootDir, ...args)
  }

  localRequire(name, { silent, cwd } = {}) {
    cwd = cwd || this.rootDir
    const resolved = silent
      ? resolveFrom_1.silent(cwd, name)
      : resolveFrom_1(cwd, name)
    return resolved && require(resolved)
  }

  getBundle(index) {
    return [...this.bundles][index]
  }
}

function getDefaultFileName(format) {
  return format === 'cjs' ? `[name][min][ext]` : `[name].[format][min][ext]`
}

exports.Bundler = Bundler
exports.createCommonjsModule = createCommonjsModule