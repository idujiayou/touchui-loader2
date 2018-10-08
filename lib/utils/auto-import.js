const babylon = require('babylon')
const Generator = require('babel-generator').CodeGenerator
const htmlparser2 = require('htmlparser2')
const beautify = require('js-beautify').js_beautify
const _ = require('lodash')
const path = require('path')
const stringUtils = require('./string-utils')

const moduleName = 'touchui'
const projectRoot = process.cwd()
const nodeEnv = process.env.NODE_ENV

let componentsMap = require('touchui/dist/map.json')
let componentsPath = 'touchui/'

let astUtil = {
	/**
	 * 是否定义了指定名称的节点
	 */
	hasDeclaredNode: function (declaration, name) {
		let properties = declaration.properties
		for (let i = 0; i < properties.length; i++) {
			if (properties[i].type === 'ObjectProperty' && properties[i].key.name === name) {
				return true
			}
		}
	},
	/**
	 * 查找指定名称的节点
	 */
	findDeclaredNode: function (declaration, name) {
		let properties = declaration.properties
		for (let i = 0; i < properties.length; i++) {
			if (properties[i].type === 'ObjectProperty' && properties[i].key.name === name) {
				return properties[i]
			}
		}
	},
	/**
	 * 查找指定名称的节点下，已经定义的属性名称
	 */
	getDeclaredNodeProperties: function (declaration, name) {
		let node = this.findDeclaredNode(declaration, name)
		let names = []

		if (node) {
			let nodeProperties = node.value.properties
			for (let i = 0; i < nodeProperties.length; i++) {
				names.push(nodeProperties[i].key.name)
			}
		}

		return names
	},
	findImportDeclaration: function (body, value) {
		let declaration
		for (let i = 0; i < body.length; i++) {
			if (body[i].type === 'ImportDeclaration'
				&& body[i].source.type === 'Literal'
				&& body[i].source.value === moduleName) {
				return body[i]
			}
		}
	},
	/**
	 * 生成导入说明符
	 */
	generateImportSpecifiers: function (names) {
		return names.map(function (name) {
			return {
				type: 'ImportSpecifier',
				imported: {
					type: 'Identifier',
					name: name
				},
				local: {
					type: 'Identifier',
					name: name
				}
			}
		})
	},
	/**
	 * 生成属性
	 */
	generateProperties: function (names, resourcePath) {
		/*
		let relative = '..'
    // 多级目录处理
		let matches = resourcePath.match(/src(\/|\\)pages(.*)/)
    if (matches && matches[2]) {
      relative = repeat('../', matches[2].match(/(\/|\\)/g).length)
      relative = relative.substring(0, relative.length - 1)
    } else if (/src(\/|\\)[\w-_.]*\.ui/.test(resourcePath)) {
			relative = '.'
		}
		*/

		return names.map(function (name) {
			return {
				type: 'ObjectProperty',
				expression: true,
				async: false,
				generator: false,
				key: {
					type: 'Identifier',
					name: name
				},
				value: {
					type: 'Identifier',
					name: name
					// name: `() => import(/* webpackChunkName: "components" */ '${path}')`
				}
			}
		})
	},
	/**
	 * 基于babel-generator生成js代码
	 */
	generateEsCode: function (ast, script) {
		var gen = new Generator(ast, {
			quotes: 'single'
		}, script)
		const output = gen.generate()
		return output.code
	}
}

/**
 * 更新Import节点
 */
let updateImportDeclarationNode = function (body, components) {

	components.forEach(function (component) {
        let value = ''
        if (/^Ui[\w]+/.test(component)) {
            let suffixName = component.substring(2)
            if (!componentsMap[suffixName]) {
                console.warn('\x1b[33m%s\x1b[0m', `warning: component ${component} is not exists`)
                return
            }
            value = `touchui/${componentsMap[suffixName]}`
        } else {
            let str = component.replace(/([A-Z])/g,"-$1").toLowerCase().substring(1)
            value = `../components/${str}`
        }
		let declaration = {
			type: 'ImportDeclaration',
			specifiers: [{
				type: 'ImportDefaultSpecifier',
				imported: {
					type: 'Identifier',
					name: component
				},
				local: {
					type: 'Identifier',
					name: component
				}
			}],
			source: {
				type: 'StringLiteral',
				value: value,
				raw: `'${value}'`
			}
		}
		// 将import节点添加到最前面
		body.unshift(declaration)
	})
	/*
	let declaration = astUtil.findImportDeclaration(body, moduleName)
	let specifiers = astUtil.generateImportSpecifiers(components)

	if (declaration) {
		declaration.specifiers = declaration.specifiers.concat(specifiers)
	} else {
		declaration = {
	    type: 'ImportDeclaration',
	    specifiers: astUtil.generateImportSpecifiers(components),
	    source: {
	      type: 'StringLiteral',
	      value: moduleName,
	      raw: `'${moduleName}'`
	    }
	  }
	  // 将import节点添加到最前面
	  body.unshift(declaration)
	}
	*/
}
/**
 *添加双向绑定方法
 */
let addSyncAttrUpdate = function (declaration) {
    let methodsNode = astUtil.findDeclaredNode(declaration, 'methods')
    let methodsProperties = babylon.parse(`export default {
        methods: {
            onSyncAttrUpdate (evt) {
                this.setData(evt)
            }
      }
    }`, {
        sourceType: 'module',
        plugins: [
            // 支持动态import
            'dynamicImport',
            // 支持rest和spread运算符
            'objectRestSpread'
        ]
    }).program.body[0].declaration.properties[0].value.properties

    if (methodsNode) {
        methodsNode.value.properties = methodsNode.value.properties.concat(methodsProperties)
    } else {
        declaration.properties.push({
            type: 'ObjectProperty',
            method: false,
            shorthand: false,
            computed: false,
            key: {
               type: 'Identifier',
               name: 'methods' 
            },
            value: {
               type: 'ObjectExpression',
               properties: methodsProperties
            }
        })
    }
}

/**
 * 更新export default {}下的components节点
 */
let updateComponentsNode = function (declaration, components, resourcePath) {
	let properties = declaration.properties
	let componentsNode = astUtil.findDeclaredNode(declaration, 'components')
	let componentsProperties = astUtil.generateProperties(components, resourcePath)

    
	if (componentsNode) {
		// 更新components节点
		componentsNode.value.properties = componentsNode.value.properties.concat(componentsProperties)
	} else {
		// 新增components节点
		properties.unshift({
			type: 'ObjectProperty',
			key: {
				type: 'Identifier',
				name: 'components'
			},
			value: {
				type: 'ObjectExpression',
				properties: componentsProperties
			}
		})
	}
}

/**
 * 解析脚本，并动态更新import和export代码
 */
let parseScript = function (script, components, resourcePath, source) {

	// ast online explorer: https://astexplorer.net/
	if (script) {
		/**
		 * 1. 获得js代码的AST树
		 * 2. 获取import和export节点
		 * 3. 计算在模板中使用的components和export节点中的components差异值
		 * 4. 当差异值存在时，则更新import和export节点
		 * 5. 使用babel-generator将AST树生成js代码
		 */
		let ast = babylon.parse(script, {
			sourceType: 'module',
			plugins: [
				// 支持动态import
				'dynamicImport',
				// 支持rest和spread运算符
				'objectRestSpread'
			]
		})

		let body = ast.program.body
		let importDeclaration, exportDeclaration
		for (let i = 0; i < body.length; i++) {
			if (body[i].type === 'ImportDeclaration' && body[i].source.value === moduleName) {
				importDeclaration = body[i]
			}

			if (body[i].type === 'ExportDefaultDeclaration') {
				exportDeclaration = body[i]
			}
		}

		if (!exportDeclaration) {
			exportDeclaration = {
				type: 'ExportDefaultDeclaration',
				declaration: {
					type: 'ObjectExpression',
					properties: []
				}
			}
			body.push(exportDeclaration)
		}

		let declaredComponents = astUtil.getDeclaredNodeProperties(exportDeclaration.declaration, 'components')
		let differenceComponents = _.difference(components, declaredComponents)

		if (differenceComponents.length > 0) {
            updateImportDeclarationNode(body, differenceComponents)
			updateComponentsNode(exportDeclaration.declaration, differenceComponents, resourcePath)
        }

        if (source && source.match(/<[^>]*(\.sync)+[^>]*>/g)) {
            addSyncAttrUpdate(exportDeclaration.declaration)
        }

		return astUtil.generateEsCode(ast)
	} else {
		// 处理无script的情况，动态生成一段script
        let componentsStr = components.join(',')
        
		let source = `
			import { ${componentsStr} } from '${moduleName}'
			export default {
				components: {
					${componentsStr}
				}
			}
		`
		return beautify(source, {
			indent_size: 2
		})
	}
}

let parseSource = function (source, components, resourcePath) {
	if (components.length === 0) {
		return source
	}

	let htmlAst = htmlparser2.parseDOM(source)

	// 确定script和模板是否定义在一个文件
	// 确定是否存在script代码
	let htmlTemplate = _.find(htmlAst, { type: 'tag', name: 'template' })
	let htmlScript = _.find(htmlAst, { type: 'script', name: 'script' })
	let scriptSource

	if (htmlTemplate) {
		if (htmlScript) {
			scriptSource = htmlScript.children[0].data
		}
	} else {
		scriptSource = source
    }

	let parsedScript = parseScript(scriptSource, components, resourcePath, source)

	if (htmlTemplate) {
		if (htmlScript) {
			htmlScript.children[0].data = parsedScript
		} else {
			htmlAst.push({
				type: 'script',
				name: 'script',
				children: [{
					data: parsedScript
				}]
			})
		}
		// refer: https://stackoverflow.com/questions/24913706/htmlparser2-convert-xml-object-into-string
		return htmlparser2.DomUtils.getOuterHTML(htmlAst, { xmlMode: true })
	} else {
		return parsedScript
	}
}

module.exports = function (source, components, resourcePath) {
	return parseSource(source, components, resourcePath)
}
