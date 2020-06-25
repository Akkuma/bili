'use strict'

var babel$1 = require('./babel.js')
var pluginBabel = require('@rollup/plugin-babel')

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __rest(s, e) {
  var t = {}
  for (var p in s)
    if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
      t[p] = s[p]
  if (s != null && typeof Object.getOwnPropertySymbols === 'function')
    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
      if (
        e.indexOf(p[i]) < 0 &&
        Object.prototype.propertyIsEnumerable.call(s, p[i])
      )
        t[p[i]] = s[p[i]]
    }
  return t
}

const a = 1
var babel = pluginBabel.createBabelInputPluginFactory((babelCore) => {
  const presetItem = babelCore.createConfigItem(babel$1, {
    type: 'preset',
  })
  return {
    // Passed the plugin options.
    options(_a) {
      var { presetOptions } = _a,
        pluginOptions = __rest(_a, ['presetOptions'])

      return {
        // Pull out any custom options that the plugin might have.
        customOptions: {
          presetOptions,
        },
        // Pass the options back with the two custom options removed.
        pluginOptions,
      }
    },

    // Passed Babel's 'PartialConfig' object.
    config(cfg, data) {
      if (cfg.hasFilesystemConfig()) {
        // Use the normal config
        return cfg.options
      }

      const presetOptions = data.customOptions.presetOptions // We set the options for default preset using env vars
      // So that you can use our default preset in your own babel.config.js
      // And our options will still work

      if (presetOptions.asyncToPromises) {
        process.env.BILI_ASYNC_TO_PROMISES = 'enabled'
      }

      if (presetOptions.jsx) {
        process.env.BILI_JSX = presetOptions.jsx
      }

      if (presetOptions.objectAssign) {
        process.env.BILI_OBJECT_ASSIGN = presetOptions.objectAssign
      }

      if (presetOptions.minimal) {
        process.env.BILI_MINIMAL = 'enabled'
      }

      return Object.assign(Object.assign({}, cfg.options), {
        presets: [
          ...(cfg.options.presets || []), // Include a custom preset in the options.
          presetItem,
        ],
      })
    },
  }
})

exports.a = a
exports.default = babel
