import isObservable from 'is-observable'
import {propArray, propArrayInObj, propObj, customPropObj} from './props'

/**
 * Map values by given prop.
 *
 * @param {Array} array of values
 * @param {String} original property
 * @param {String} original rule
 * @return {String} mapped values
 */
function mapValuesByProp(value, prop, rule) {
  return value.map((item) => objectToString(item, prop, rule))
}

/**
 * Convert array to string.
 *
 * @param {Array} array of values
 * @param {String} original property
 * @param {Object} sheme, for converting arrays in strings
 * @param {Object} original rule
 * @return {String} converted string
 */
function arrayToString(value, prop, scheme, rule) {
  if (scheme[prop] == null) return value.join(',')
  if (value.length === 0) return ''
  if (Array.isArray(value[0])) return arrayToString(value[0], prop, scheme)
  if (typeof value[0] === 'object' && !isObservable(value[0])) {
    return mapValuesByProp(value, prop, rule)
  }
  return value.join(' ')
}

/**
 * Convert object to string.
 *
 * @param {Object} object of values
 * @param {String} original property
 * @param {Object} original rule
 * @param {Boolean} is fallback prop
 * @return {String} converted string
 */
function objectToString(value, prop, rule, isFallback) {
  if (!(propObj[prop] || customPropObj[prop])) return ''

  const result = []

  // Check if exists any non-standart property
  if (customPropObj[prop]) {
    value = customPropsToStyle(value, rule, customPropObj[prop], isFallback)
  }

  // Pass throught all standart props
  if (Object.keys(value).length) {
    for (const baseProp in propObj[prop]) {
      if (value[baseProp]) {
        if (Array.isArray(value[baseProp])) {
          result.push(arrayToString(value[baseProp], baseProp, propArrayInObj))
        }
        else result.push(value[baseProp])
        continue
      }

      // Add default value from props config.
      if (propObj[prop][baseProp] != null) {
        result.push(propObj[prop][baseProp])
      }
    }
  }

  return result.join(' ')
}

/**
 * Convert custom properties values to styles adding them to rule directly
 *
 * @param {Object} object of values
 * @param {Object} original rule
 * @param {String} property, that contain partial custom properties
 * @param {Boolean} is fallback prop
 * @return {Object} value without custom properties, that was already added to rule
 */
function customPropsToStyle(value, rule, customProps, isFallback) {
  for (const prop in customProps) {
    const propName = customProps[prop]

    // If current property doesn't exist already in rule - add new one
    if (typeof value[prop] !== 'undefined' && (isFallback || !rule.prop(propName))) {
      const appendedValue = styleDetector({
        [propName]: value[prop]
      }, rule)[propName]

      // Add style directly in rule
      if (isFallback) rule.style.fallbacks[propName] = appendedValue
      else rule.style[propName] = appendedValue
    }
    // Delete converted property to avoid double converting
    delete value[prop]
  }

  return value
}

/**
 * Detect if a style needs to be converted.
 *
 * @param {Object} style
 * @param {Object} rule
 * @param {Boolean} is fallback prop
 * @return {Object} convertedStyle
 */
function styleDetector(style, rule, isFallback) {
  for (const prop in style) {
    const value = style[prop]

    if (Array.isArray(value)) {
      // Check double arrays to avoid recursion.
      if (!Array.isArray(value[0])) {
        if (prop === 'fallbacks') {
          for (let index = 0; index < style.fallbacks.length; index ++) {
            style.fallbacks[index] = styleDetector(style.fallbacks[index], rule, true)
          }
          continue
        }

        style[prop] = arrayToString(value, prop, propArray)
        // Avoid creating properties with empty values
        if (!style[prop]) delete style[prop]
      }
    }
    else if (typeof value === 'object' && !isObservable(value)) {
      if (prop === 'fallbacks') {
        style.fallbacks = styleDetector(style.fallbacks, rule, true)
        continue
      }

      style[prop] = objectToString(value, prop, rule, isFallback)
      // Avoid creating properties with empty values
      if (!style[prop]) delete style[prop]
    }

    // Maybe a computed value resulting in an empty string
    else if (style[prop] === '') delete style[prop]
  }

  return style
}

/**
 * Adds possibility to write expanded styles.
 *
 * @param {Rule} rule
 * @api public
 */
export default function jssExpand() {
  function onProcessStyle(style, rule) {
    if (!style || rule.type !== 'style') return style

    if (Array.isArray(style)) {
      // Pass rules one by one and reformat them
      for (let index = 0; index < style.length; index++) {
        style[index] = styleDetector(style[index], rule)
      }
      return style
    }

    return styleDetector(style, rule)
  }

  return {onProcessStyle}
}
