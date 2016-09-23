
/*
 * This file is part of the `src-run/srw-gulp` project.
 *
 * (c) Rob Frawley 2nd <rmf@src.run>
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

'use strict';

export default class ConfigFetcher {
  /**
   * Construct our instance by passing a ConfigBuilder object.
   *
   * @param {ConfigBuilder} reader
   */
  constructor (reader) {
    this.reader = reader;
  }

  /**
   * Get file globs from config.
   *
   * @param {string} index
   * @param {Array}  options
   *
   * @returns {*}
   */
  glob (index, options) {
    return this.reader.value('globs', index, options);
  }

  /**
   * Get directory path from config.
   *
   * @param {string} index
   * @param {Array}  options
   *
   * @returns {*}
   */
  path (index, options) {
    return this.reader.value('paths', index, options);
  }

  /**
   * Get file path from config.
   *
   * @param {string} index
   * @param {Array}  options
   *
   * @returns {*}
   */
  file (index, options) {
    return this.reader.value('files', index, options);
  }

  /**
   * Get option value from config.
   *
   * @param {string} index
   * @param {Array}  options
   *
   * @returns {*}
   */
  option (index, options) {
    return this.reader.value('options', index, options);
  }

  /**
   * Get collection of file globs from config.
   *
   * @param {String...} indexes
   *
   * @returns {Array}
   */
  globs (...indexes) {
    return Array.prototype.concat(...indexes.map(this.glob.bind(this)));
  }

  /**
   * Get collection of file paths from config.
   *
   * @param {String...} indexes
   *
   * @returns {Array}
   */
  paths (...indexes) {
    return Array.prototype.concat(...indexes.map(this.path.bind(this)));
  }

  /**
   * Get collection of file paths from config.
   *
   * @param {String...} indexes
   *
   * @returns {Array}
   */
  files (...indexes) {
    return Array.prototype.concat(...indexes.map(this.file.bind(this)));
  }

  /**
   * Get option value from config.
   *
   * @param {string} idx
   * @param {Array}  opt
   *
   * @returns {Array}
   */
  options (idx, opt) {
    return Array.prototype.concat(...idxs.map(this.option.bind(this)))
  }

  /**
   * Build a value by concatenating multiple glob results.
   *
   * @param {String...} indexes
   *
   * @returns {String}
   */
  buildGlob (...indexes) {
    return this.reader.build('globs', ...indexes);
  }

  /**
   * Build a value by concatenating multiple path results.
   *
   * @param {String...} indexes
   *
   * @returns {String}
   */
  buildPath (...indexes) {
    return this.reader.build('paths', ...indexes);
  }

  /**
   * Build a value by concatenating multiple file results.
   *
   * @param {String...} indexes
   *
   * @returns {String}
   */
  buildFile (...indexes) {
    return this.reader.build('files', ...indexes);
  }

  /**
   * Build a value by concatenating multiple option results.
   *
   * @param {String...} indexes
   *
   * @returns {String}
   */
  buildOption (...indexes) {
    return this.reader.build('options', ...indexes);
  }
}
