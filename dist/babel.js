'use strict'

var babelPluginAlterObjectAssign = ({ types: t }) => {
  const parseIdentifier = (id) =>
    id
      .split('.')
      .map((name) => t.identifier(name))
      .reduce((object, property) => t.memberExpression(object, property))

  return {
    visitor: {
      MemberExpression(path, { opts: { objectAssign } }) {
        if (
          objectAssign &&
          path.node.object.name === 'Object' &&
          path.node.property.name === 'assign'
        ) {
          path.replaceWith(parseIdentifier(objectAssign))
        }
      },
    },
  }
}

const ENV = process.env.BABEL_ENV || process.env.NODE_ENV
var preset = (
  context,
  {
    asyncToPromises = process.env.BILI_ASYNC_TO_PROMISES,
    jsx = process.env.BILI_JSX,
    objectAssign = process.env.BILI_OBJECT_ASSIGN,
    minimal = process.env.BILI_MINIMAL,
  } = {}
) => {
  const presets = [
    !minimal && [
      require('@babel/preset-env').default,
      {
        modules: ENV === 'test' ? 'auto' : false,
        exclude: [
          'transform-regenerator',
          'transform-async-to-generator',
          'proposal-object-rest-spread',
        ],
      },
    ],
    require('@babel/preset-typescript'),
  ].filter(Boolean)
  const plugins = [
    [
      require('@babel/plugin-transform-react-jsx'),
      {
        pragma: jsx === 'react' ? 'React.createElement' : jsx,
      },
    ],
    [
      require('@babel/plugin-proposal-object-rest-spread'),
      {
        useBuiltIns: true,
        loose: true,
      },
    ],
    [require('@babel/plugin-proposal-optional-chaining')],
    [require('@babel/plugin-proposal-nullish-coalescing-operator')],
    [
      babelPluginAlterObjectAssign,
      {
        objectAssign,
      },
    ],
    asyncToPromises && require('babel-plugin-transform-async-to-promises'),
  ].filter(Boolean)
  return {
    presets,
    plugins,
  }
}

module.exports = preset