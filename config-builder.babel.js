
/*
 * This file is part of the `src-run/srw-gulp` project.
 *
 * (c) Rob Frawley 2nd <rmf@src.run>
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

'use strict';

import fs from 'fs';

export default class ConfigBuilder {
  /**
   * Construct our configObject object instance.
   *
   * @param {String} configFile
   */
  constructor (configFile, logger) {
    this.logger = logger;
    this.configObject = {};
    this.configCached = {};
    this.configFileDefault = './.gulp/default-config.json';

    this::loadConfig(configFile);
  }

  /**
   * Build a variable by combining the result of any number of indexes.
   *
   * @param {String}    ctx
   * @param {String...} indexes
   *
   * @returns {String}
   */
  build (ctx, ...indexes) {
    let value;

    for (let idx of indexes) {
      value = value + this.value(ctx, idx);
    }

    return value;
  }

  /**
   * Get requested value from config.
   *
   * @param {string} ctx
   * @param {string} idx
   * @param {Array}  opt
   *
   * @returns {*}
   */
  value (ctx, idx, opt) {
    let val;

    idx = this::buildIndex(ctx, idx);
    val = this::lookupCachedValue(idx, opt);

    if (val) {
      return val;
    }

    val = this::lookup(idx);
    val = this::applyOptions(val, opt);

    this::assignCachedValue(idx, opt, val);

    return val;
  }
}

/**
 * Load configObject file.
 *
 * @return {Boolean}
 */
function loadConfig (file = false) {
  let context;

  if (file === false || ! fs.statSync(file).isFile()) {
    file = './.gulp.json';
  }

  if (this::loadConfigFile(file, 'user')) {
    return;
  }

  if (this::loadConfigFile(this.configFileDefault, 'default')) {
    return;
  }

  this.logger.emergency('Could not load user config or default config files.');
}

/**
 * Load configuration object given passed file and context.
 *
 * @param  {String} file
 * @param  {String} context
 *
 * @return {Boolean}
 */
function loadConfigFile(file, context) {
  try {
    this.configObject = this::readAndParseConfig(file);
    this.logger.info('Loaded %s configuration file: "%s"', context, file);
    return true;
  } catch (e) {
    this.logger.error('Unable to load %s config file "%s": [%s] %s', context, file, e.name, e.message);
    return false;
  }
}

/**
 * Read the configObject file.
 *
 * @param {String} file
 *
 * @returns {*}
 */
function readAndParseConfig (file) {
  return JSON.parse(fs.readFileSync(file, {
    encoding: 'utf8'
  }));
}

/**
 * Return value from cache if already resolved.
 *
 * @param {string} idx
 * @param {Array}  opt
 *
 * @return {string|Array|null}
 */
function lookupCachedValue (idx, opt) {
  let key = this::buildCacheIndex(idx, opt);

  if (this.configCached[key]) {
    return this.configCached[key];
  }

  return null;
}

/**
 * Add value to cache for later retrieval.
 *
 * @param {string}       idx
 * @param {Array}        opt
 * @param {Array|string} val
 */
function assignCachedValue (idx, opt, val) {
  let key = this::buildCacheIndex(idx, opt);

  this.configCached[key] = val;
}

/**
 * Lookup the config value by index.
 *
 * @param {string} idx
 *
 * @returns {string|Array|Object}
 */
function lookup (idx) {
  this.logger.debug('Resolving "%s"', idx);

  return this::resolveReplacements(this::resolveValue(idx));
}

/**
 * Find a value through a lookup against it's index.
 *
 * @param {string} idx
 *
 * @returns {string|Array|Object}
 */
function resolveValue (idx) {
  let val = this.configObject;

  idx.split('.').forEach(function (i) {
    val = val[i];

    if (!val) {
      throw new Error('Resolution error for index (' + idx + ') at fragment ' + i);
    }
  });

  return val;
}

/**
 * Resolve value placeholders.
 *
 * @param {Array|Object|string} val
 *
 * @returns {Array|Object|string}
 */
function resolveReplacements (val) {
  if (val instanceof Object) {
    return this::resolveReplacementsForObject(val);
  }

  if (val instanceof Array) {
    return this::resolveReplacementsForArray(val);
  }

  return this::resolveReplacementsForScalar(val);
}

/**
 * Resolve value placeholders in value string.
 *
 * @param {string} val
 *
 * @returns {string}
 */
function resolveReplacementsForScalar (val) {
  let search;
  let replace;
  let i = 0;
  let maxIterations = 20;
  let parsed = val.toString();

  while (true) {
    search = new RegExp('\\$\{([a-z\.-]+)\}', 'i').exec(parsed);

    if (!search || search.length < 2 || i++ > maxIterations) {
      break;
    }

    replace = this::lookup(search[1]);

    if (replace) {
      parsed = parsed.replace(new RegExp(this::regexQuote(search[0]), 'g'), replace);
    }
  }

  return parsed;
}

/**
 * Resolve value placeholders on each array element.
 *
 * @param {Array} val
 *
 * @returns {Array}
 */
function resolveReplacementsForArray (val) {
  return val.map(function (v) {
    return this::resolveReplacementsForScalar(v);
  }.bind(this));
}

/**
 * Resolve value placeholders on each object element.
 *
 * @param {Object} val
 *
 * @returns {Object}
 */
function resolveReplacementsForObject (val) {
  Array.prototype.concat(Object.getOwnPropertyNames(val)).forEach(function (property) {
    let v = val[property];

    if (v instanceof Object) {
      val[property] = this::resolveReplacementsForObject(v);
    } else if (v instanceof Array) {
      val[property] = this::resolveReplacementsForArray(v);
    } else if (typeof v === 'string') {
      val[property] = this::resolveReplacementsForScalar(v);
    }
  }.bind(this));

  return val;
}

/**
 * Resolve full index if context is specified.
 *
 * @param {string|null} ctx
 * @param {string}      idx
 *
 * @returns {string}
 */
function buildIndex (ctx, idx) {
  if (ctx) {
    idx = ctx + '.' + idx;
  }

  return idx;
}

/**
 * Create a key for the given context, index, and options.
 *
 * @returns {string}
 */
function buildCacheIndex () {
  let key = 'cache';

  Array.from(arguments).forEach(function (k, i) {
    key += '__' + i + '_' + JSON.stringify(k);
  });

  return key.replace(/\W/g, '');
}

/**
 * Apply options to resolved config value.
 *
 * @param {string|Array} val
 * @param {Array}        opt
 *
 * @returns {*}
 */
function applyOptions (val, opt) {
  if (val instanceof Array) {
    return this::applyOptionsOnArray(val, opt);
  }

  return this::applyOptionsOnScalar(val, opt);
}

/**
 * Generate final config value by applying passed options to resolved string.
 *
 * @param {string} val
 * @param {Array}  opt
 *
 * @returns {*}
 */
function applyOptionsOnScalar (val, opt) {
  if (opt && opt.pre) {
    val = opt.pre + val;
  }

  if (opt && opt.post) {
    val = val + opt.post;
  }

  return val;
}

/**
 * Generate final config value by applying passed options to each array element.
 *
 * @param {string} val
 * @param {Array}  opt
 *
 * @returns {*}
 */
function applyOptionsOnArray (val, opt) {
  return val.map(function (v) {
    return this::applyOptionsOnScalar(v.toString(), opt);
  });
}

/**
 * Prepare value for regex by performing a "regex quote" on it.
 *
 * @param {string} val
 *
 * @returns {*}
 */
function regexQuote (val) {
  return val.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
}
