const sqlParser = require('pg-query-native')
const { id, parameterize } = require('./query_utils')
function parseSqlNode (params, node) {
  const boolOperatorMap = {
    0: 'AND',
    1: 'OR'
  }

  if (node.BoolExpr) {
    if (node.BoolExpr.boolop === 2) {
      return `(NOT (${parseSqlNode(params, node.BoolExpr.args[0])}))`
    }
    return `(${parseSqlNode(params, node.BoolExpr.args[0])} ${boolOperatorMap[node.BoolExpr.boolop]} ${parseSqlNode(
      params,
      node.BoolExpr.args[1]
    )})`
  }

  if (node.FuncCall) {
    return `${node.FuncCall.funcname[0].String.str}(${node.FuncCall.args.map(a => parseSqlNode(params, a)).join(', ')})`
  }

  if (node.TypeCast) {
    return `${parseSqlNode(params, node.TypeCast.arg)}::${node.TypeCast.typeName.TypeName.names
      .map(n => n.String.str)
      .join('.')}`
  }

  if (node.A_Const) {
    return parseSqlNode(params, node.A_Const.val)
  }

  if (node.String) {
    return parameterize(params, node.String.str)
  }

  if (node.Integer) {
    return parameterize(params, node.Integer.ival)
  }

  if (node.ColumnRef) {
    return `${node.ColumnRef.fields.map(f => f.String.str).join('.')}`
  }

  if (node.A_Expr) {
    if (node.A_Expr.kind === 0) {
      return `(${parseSqlNode(params, node.A_Expr.lexpr)} ${node.A_Expr.name[0].String.str} ${parseSqlNode(
        params,
        node.A_Expr.rexpr
      )})`
    }
    if (node.A_Expr.kind === 10) {
      return `(${parseSqlNode(params, node.A_Expr.lexpr)} BETWEEN ${parseSqlNode(
        params,
        node.A_Expr.rexpr[0]
      )} AND ${parseSqlNode(params, node.A_Expr.rexpr[1])})`
    }
  }

  if (node.ParamRef) {
    return `$${node.ParamRef.number}`
  }

  throw new Error('not implemented sql node parser')
}

function getWhereSql (params, json, variableName) {
  if (json._sqlWhere) {
    const ast = sqlParser.parse(
      `SELECT * FROM placeholder WHERE ${json._sqlWhere.filter
        .replace(/\{this\}/g, variableName)
        .replace(/\s+:(\w+)\b/g, (a, b) => `$${params.push(json._sqlWhere.params[b])}`)}`
    )
    return parseSqlNode(params, ast.query[0].SelectStmt.whereClause)
  }
  return ''
}

function sqlInsert (options, node, sqlParams) {
  if (options.sqlMappings && options.sqlMappings[node._label]) {
    const sqlMappings = options.sqlMappings
    const sqlColumns = ['_id']
    const sqlValues = [`$${sqlParams.push(node[id])}`]

    for (const k of Object.keys(sqlMappings[node._label].mappings)) {
      const value = node[k]
      delete node[k]
      sqlColumns.push(sqlMappings[node._label].mappings[k])
      const param = sqlParams.push(value)
      if (options.projections && options.projections[node._label][k]) {
        const projection = options.projections[node._label][k].replace(/\{this\}/g, `$${param}`)
        sqlValues.push(projection)
      } else {
        sqlValues.push(`$${param}`)
      }
    }
    return `INSERT INTO ${sqlMappings[node._label].table} (${sqlColumns.join(', ')}) VALUES (${sqlValues.join(', ')})`
  }
}

function sqlUpdate (options, node, sqlParams) {
  if (options.sqlMappings && options.sqlMappings[node._label]) {
    const sqlMappings = options.sqlMappings
    const sqlColumns = []
    const idParamIndex = sqlParams.push(node._id)
    for (const mapping of sqlMappings[node._label].mappings) {
      const value = node[mapping.key]
      delete node[mapping.key]
      const param = sqlParams.push(value)
      if (options.projections && options.projections[node._label][mapping.key]) {
        const projection = options.projections[node._label][mapping.key].replace(/\{this\}/g, `$${param}`)
        sqlColumns.push(`${mapping.column} = ${projection}`)
      } else {
        sqlColumns.push(`${mapping.column} = $${param}`)
      }
    }
    return `UPDATE ${sqlMappings[node._label].table} (${sqlColumns.join(', ')}) WHERE _id = $${idParamIndex}`
  }
}

function handleSql (options, node, sqlQuery, sqlParams) {
  let sqlPartialQuery
  if (!node._id) {
    sqlPartialQuery = sqlInsert(options, node, sqlParams)
  } else {
    sqlPartialQuery = sqlUpdate(options, node, sqlParams)
  }
  if (sqlPartialQuery) {
    sqlQuery.push(sqlPartialQuery)
  }
}

module.exports = {
  getWhereSql,
  handleSql
}
