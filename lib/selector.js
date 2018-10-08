// this is a utility loader that takes a *.vue file, parses it and returns
// the requested language block, e.g. the content inside <template>, for
// further processing.

var path = require('path')
var fs = require('fs')
var parse = require('./parser')
var loaderUtils = require('loader-utils')
var dynamicImport = require('./utils/dynamic-import')

module.exports = function (content) {

  // 动态导入同目录下的同名less和js文件
  content = dynamicImport.call(this, content)

  this.cacheable()
  var query = loaderUtils.getOptions(this) || {}
  var filename = path.basename(this.resourcePath)
  var parts = parse(content, filename, this.sourceMap, this.resourcePath)
  var part = parts[query.type]
  if (Array.isArray(part)) {
    part = part[query.index]
  }
  this.callback(null, part.content, part.map)
}
