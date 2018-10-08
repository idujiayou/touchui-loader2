const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const autoImport = require('./auto-import')
const stringUtils = require('./string-utils')

const nodeEnv = process.env.NODE_ENV
let styleDir = '../../node_modules/touchui/dist'
let styleRootPath = '~touchui/dist/styles/touchui'

const projectRoot = process.cwd()
const styleFilesPath = path.join(`../../node_modules/touchui/dist/styles/touchui`)
const files = fs.readdirSync(styleFilesPath)

let lessMap = {}

for (let i = 0; i < files.length; i++) {
  if (/\.less$/.test(files[i])) {
    lessMap[files[i].substring(0, files[i].length - 5)] = files[i]
  }
}

/**
 * 是否为app.ui
 */
function isRootApp(resourcePath) {
  let relativePath = path.relative(projectRoot, resourcePath)
  return /app\.ui/.test(relativePath)
}

/**
 * 将组件标签名转换为组件名称
 * 例如：'ui-page'转换成'UiPage'
 */
function tag2Component(str) {
  return str.toLowerCase().split('-').map(function (word) {
    return (word.charAt(0).toUpperCase() + word.slice(1))
  }).join('')
}

/**
 * 内容转换为字符串数组，并去除空行
 */
function content2Lines(content) {
  let lines = content.split(/\r?\n/)
  return _.filter(lines, function (line) { return !!line })
}

/**
 * 生成less import
 */
function genImportLess(components) {
  let imports = ['/* TouchUI Components Styles */']

  components.forEach(function (item) {
    let key = stringUtils.toDash(item.substring(2))
    if (lessMap[key]) {
      imports.push(`@import '${styleRootPath}/${lessMap[key]}';`)
    }
  })
  imports.push('/* TouchUI Scoped Styles */')
  return imports.join('\n')
}

/**
 * 解析.ui文件中使用的组件
 */
function parseComponents(content) {
  const reg = /<((ui|my)(-[\w]+)+)(.*?)/i
  let lines = content2Lines(content)
  let components = []

  lines.forEach(function (line) {
    let matches = line.match(reg)
    if (matches && matches[1]) {
      let name = tag2Component(matches[1])
      if (components.indexOf(name) < 0) {
        components.push(name)
      }
    }
  })
  return components
}

/**
 * 通过首行注释来识别是否为scoped style
 * 例如：// style="scoped"
 */
function isStyleScoped(content) {
  const reg = /^\s*[/]{2}\s*style=["']?scoped["']?\s*$/
  let lines = content2Lines(content)
  return lines[0] && reg.test(lines[0])
}

/**
 * 在.ui文件中动态导入less和js
 */
module.exports = function (content) {
  if (this.resourcePath.indexOf('.ui') > -1) {
    var name = path.parse(this.resourcePath).name
    var dir = path.dirname(this.resourcePath)

    var lessPath = path.join(dir, name + '.less')
    var jsPath = path.join(dir, name + '.js')
    var jsonPath = path.join(dir, name + '.json')

    // 获取模板使用的组件
    var components = parseComponents(content)
    var root = isRootApp(this.resourcePath)

    let genedLess = genImportLess(components)

    if (root) {
      genedLess = `@import '${styleRootPath}/common.less';\n` + genedLess
    }

    if (fs.existsSync(lessPath)) {
      var less = fs.readFileSync(lessPath, 'utf8')
      content = content + `
        <style lang="less">
          ${genedLess}
          ${less}
        </style>
      `
      this.addDependency(lessPath)
    } else {
      content = content + `
        <style lang="less">
          ${genedLess}
        </style>
      `
    }

    if (fs.existsSync(jsPath)) {
      var js = fs.readFileSync(jsPath, 'utf8')
 
      js = autoImport(js, components, this.resourcePath)
      content = content + `
        <script>
          ${js}
        </script>
      `
      this.addDependency(jsPath)
    } else {
      content = autoImport(content, components, this.resourcePath)
    }

    if (fs.existsSync(jsonPath)) {
      this.addDependency(jsonPath)
    }
  }
  return content
}
