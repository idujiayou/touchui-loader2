var compiler = require('touchui-template-compiler')
var cache = require('lru-cache')(100)
var hash = require('hash-sum')
var fs = require('fs')
var path = require('path')
var SourceMapGenerator = require('source-map').SourceMapGenerator

var splitRE = /\r?\n/g
var emptyRE = /^(?:\/\/)?\s*$/

/**
 * @{content}  {String}  文件内容
 * @{filename} {String}  文件名称
 * @{needMap}  {Boolean} 是否需要sourceMap
 * @{filePath} {String}  文件路径
 * filePath参数是追加的参数，原方法不含此参数
 */
module.exports = function (content, filename, needMap, filePath) {

  var cacheKey = hash(filename + content)
  // source-map cache busting for hot-reloadded modules
  var filenameWithHash = filename + '?' + cacheKey
  var output = cache.get(cacheKey)
  if (output) return output
  output = compiler.parseComponent(content, { pad: 'line' })

  if (needMap) {
    if (output.script && !output.script.src) {
      output.script.map = generateSourceMap(
        filenameWithHash,
        content,
        output.script.content
      )
    }
    if (output.styles) {
      output.styles.forEach(style => {
        if (!style.src) {
          style.map = generateSourceMap(
            filenameWithHash,
            content,
            style.content
          )
        }
      })
    }
  }
  cache.set(cacheKey, output)
  return output
}

function generateSourceMap (filename, source, generated) {
  var map = new SourceMapGenerator()
  map.setSourceContent(filename, source)
  generated.split(splitRE).forEach((line, index) => {
    if (!emptyRE.test(line)) {
      map.addMapping({
        source: filename,
        original: {
          line: index + 1,
          column: 0
        },
        generated: {
          line: index + 1,
          column: 0
        }
      })
    }
  })
  return map.toJSON()
}
