import { LiveBlocked } from './live-runner'

export function validateContract(schema: any, value: any, direction = 'request', depth = 0): void {
  const bad = () => { throw new Error('Operation contract mismatch') }
  if (depth > 40 || schema === false) return bad()
  if (schema === true || schema == null) return
  for (const key of ['if', 'then', 'else', 'dependentRequired', 'dependentSchemas', 'patternProperties', 'contains', 'unevaluatedProperties', 'unevaluatedItems']) {
    if (schema[key] !== undefined) throw new LiveBlocked('Unsupported contract constraint: ' + key)
  }
  if (schema.$ref) throw new LiveBlocked('Unresolved contract reference')
  if (value === null && (schema.nullable || schema.type === 'null' || schema.type?.includes?.('null'))) return
  for (const sub of schema.allOf || []) validateContract(sub, value, direction, depth + 1)
  for (const key of ['oneOf', 'anyOf']) if (schema[key]) {
    let matches = 0
    for (const sub of schema[key]) { try { validateContract(sub, value, direction, depth + 1); matches++ } catch {} }
    if (key === 'oneOf' ? matches !== 1 : matches === 0) bad()
  }
  if (schema.not) { let matched = true; try { validateContract(schema.not, value, direction, depth + 1) } catch { matched = false }; if (matched) bad() }
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) bad()
  if (schema.enum && !schema.enum.some((v: any) => JSON.stringify(v) === JSON.stringify(value))) bad()
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : []
  if (types.length && !types.some((t: string) => t === kind || t === 'integer' && Number.isInteger(value))) bad()
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) bad()
    if (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum) bad()
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum || schema.exclusiveMinimum === true && value <= schema.minimum) bad()
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum || schema.exclusiveMaximum === true && value >= schema.maximum) bad()
    if (schema.multipleOf && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-8) bad()
  }
  if (typeof value === 'string') {
    if (value.length < (schema.minLength || 0) || value.length > (schema.maxLength ?? Infinity)) bad()
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) bad()
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) bad()
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) bad()
    if (schema.format === 'uuid' && !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) bad()
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) bad()
  }
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity)) bad()
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) bad()
    value.forEach((v, i) => validateContract(schema.prefixItems?.[i] ?? schema.items, v, direction, depth + 1))
  } else if (value !== null && typeof value === 'object') {
    for (const key of schema.required || []) {
      const prop = schema.properties?.[key]
      if (direction === 'request' && prop?.readOnly || direction === 'response' && prop?.writeOnly) continue
      if (value[key] === undefined) bad()
    }
    for (const [key, v] of Object.entries(value)) {
      const prop = schema.properties?.[key]
      if (direction === 'request' && prop?.readOnly || direction === 'response' && prop?.writeOnly) bad()
      if (prop === undefined && schema.additionalProperties === false) bad()
      validateContract(prop ?? schema.additionalProperties, v, direction, depth + 1)
    }
  }
}

export function synthesizeInput(schema: any, explicit?: any, depth = 0): any {
  if (depth > 30) throw new LiveBlocked('Request schema nesting exceeds limit')
  if (schema?.$ref) throw new LiveBlocked('Unresolved request reference')
  if (explicit !== undefined) { validateContract(schema, explicit); return explicit }
  if (!schema || schema === true) throw new LiveBlocked('No request contract or input recipe')
  for (const key of ['example', 'default', 'const']) if (schema[key] !== undefined) {
    try { validateContract(schema, schema[key]); return schema[key] } catch {}
  }
  for (const value of schema.examples || schema.enum || []) {
    try { validateContract(schema, value); return value } catch {}
  }
  for (const choice of schema.oneOf || schema.anyOf || []) {
    try { const v = synthesizeInput(choice, undefined, depth + 1); validateContract(schema, v); return v } catch {}
  }
  let value: any
  if (schema.allOf) value = Object.assign({}, ...schema.allOf.map((s: any) => synthesizeInput(s, undefined, depth + 1)))
  else if (schema.type === 'object' || schema.properties) {
    value = {}
    for (const key of schema.required || []) if (!schema.properties?.[key]?.readOnly) {
      value[key] = synthesizeInput(schema.properties?.[key], undefined, depth + 1)
    }
  } else if (schema.type === 'array') {
    const count = Math.max(1, schema.minItems || 0)
    if (count > 16) throw new LiveBlocked('Required input array exceeds test payload limit')
    value = Array.from({ length: count }, () => synthesizeInput(schema.items, undefined, depth + 1))
  } else if (schema.type === 'integer' || schema.type === 'number') {
    value = Math.max(1, schema.minimum ?? 1)
    if (typeof schema.exclusiveMinimum === 'number') value = Math.max(value, schema.exclusiveMinimum + 1)
    if (schema.multipleOf) value = Math.ceil(value / schema.multipleOf) * schema.multipleOf
  } else if (schema.type === 'boolean') value = true
  else throw new LiveBlocked('Required input needs a guide recipe or validated example')
  validateContract(schema, value)
  return value
}

export function requestContract(facts: any): { schema?: any, example?: any, required?: boolean } {
  const body = facts?.requestBody
  if (body) {
    const media = body.content?.['application/json'] ?? body.content?.['application/*+json']
    if (!media) throw new LiveBlocked('Unsupported request media type')
    return { schema: media.schema, example: media.example ?? Object.values(media.examples || {}).map((v: any) => v.value)[0], required: body.required }
  }
  const arg = facts?.parameters?.find((p: any) => p.in === 'body')
  return arg ? { schema: arg.schema, example: arg.example, required: arg.required } : {}
}
