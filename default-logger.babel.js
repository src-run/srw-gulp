
/*
 * This file is part of the `src-run/srw-gulp` project.
 *
 * (c) Rob Frawley 2nd <rmf@src.run>
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this vinylSourceStream code.
 */

'use strict';

import path from 'path';
import fs from 'fs';

var colors = require('colour');
var dateFormat = require('dateformat');
var sprintf = require('sprintf-js').sprintf;

/**
 * Logger class.
 */
export default class DefaultLogger
{
  /**
   * Configure verbose behavior of logger.
   *
   * @param {String} logFile
   */
  constructor (verbosity = 0, logFile = "/tmp/gulp-runner.log") {
    this.setVerbosity(verbosity);

    this.writer = new WriterProxy(
      new WriterStdIO(),
      new WriterFile(logFile)
    );
  }

  setVerbosity(level) {
    this.verbosity = level;
  }

  isSilent() {
    return this.verbosity < -2;
  }

  isVeryQuiet() {
    return this.verbosity < -1;
  }

  isQuiet() {
    return this.verbosity < 0;
  }

  isVerbose () {
    return this.verbosity > 0;
  }

  isVeryVerbose() {
    return this.verbosity > 1;
  }

  isDebug() {
    return this.verbosity > 2;
  }

  /**
   * Write message lines with info severity.
   *
   * @param {String...} lines
   */
  debug(message, ...replacements) {
    if (this.isVerbose()) {
      this.writer.write(message, -1, ...replacements);
    }

    return this;
  }

  /**
   * Write message lines with info severity.
   *
   * @param {String...} lines
   */
  info(message, ...replacements) {
    if (!this.isQuiet()) {
      this.writer.write(message, 0, ...replacements);
    }

    return this;
  }

  /**
   * Write message lines with info severity.
   *
   * @param {String...} lines
   */
  warning(message, ...replacements) {
    if (!this.isQuiet()) {
      this.writer.write(message, 1, ...replacements);
    }

    return this;
  }

  /**
   * Write message lines with info severity.
   *
   * @param {String...} lines
   */
  error(message, ...replacements) {
    if (!this.isSilent()) {
      this.writer.write(message, 2, ...replacements);
    }

    return this;
  }

  /**
   * Write message lines with info severity.
   *
   * @param {String...} lines
   */
  critical(message, ...replacements) {
    if (!this.isSilent()) {
      this.writer.write(message, 3, ...replacements);
    }

    return this;
  }

  /**
   * Write message lines with info severity.
   *
   * @param {String...} lines
   */
  emergency(message, ...replacements) {
    this.writer.write(message, 4, ...replacements);

    return this;
  }
}

/**
 * Output formatter.
 */
class Formatter {
  /**
   * Constructor configured colors in output.
   *
   * @param {Boolean} color
   */
  constructor (color = true) {
    this.color = color;
  }

  /**
   * @param {String}    message
   * @param {Number}    level
   * @param {String...} replacements
   *
   * @return {String}
   */
  format(message, level, ...replacements) {
    return sprintf('[%s] %s %s', this::formatTime(), this::formatLevel(level), this::formatMessage(message, ...replacements));
  }
}

/**
 * Returns true if colors are enabled.
 *
 * @return {Boolean}
 */
function isColorEnabled() {
  return this.color === true;
}

/**
 * @param {String}         message
 * @param {String|Integer} replacements
 *
 * @return {String}
 */
function formatMessage (message, ...replacements) {
  if (replacements !== undefined) {
    message = sprintf(message, ...replacements);
  }

  return this::isColorEnabled() ? colors.white(message) : message;
}

/**
 * Format message time.
 *
 * @param  {String} [format='HHMMss']
 *
 * @return {String}
 */
function formatTime(format = 'HH\:MM\:ss') {
  let date = new Date();
  let time = dateFormat(date, format);

  return this::isColorEnabled() ? colors.gray(time) : time;
}

/**
 * Maps a level integer to its string representation.
 *
 * @param {Number} level
 *
 * @return {Array}
 */
function formatLevel(level) {
  let strings = [
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR',
    'CRIT',
    'EMERGENCY',
  ];

  let symbols = [
    '---',
    '---',
    '-!-',
    '!!!',
    '-#-',
    '###',
  ];

  let out = sprintf('%s %s', symbols[level + 1], ("     " + strings[level + 1]).slice(-5));

  return this::isColorEnabled() ? this::colorizeLevel(out, level) : out;
}

/**
 * Colorize string based on level integer.
 *
 * @param  {String}  text
 * @param  {integer} level
 *
 * @return {String}
 */
function colorizeLevel(text, level) {
  switch (level) {
    case -1:
      return colors.magenta(text);

    case 0:
      return colors.blue(text);

    case 1:
      return colors.yellow(text);

    case 2:
      return colors.red(text);

    case 3:
      return colors.red.bold(text);

    case 4:
      return colors.yellow.bold(text);

    default:
      return colors.gray(text);
  }
}

/**
 * Proxies write calls to array of registered writers.
 */
class WriterProxy {
  /**
   * Constructor allows enabling/disabling and setting a level cut off.
   *
   * @param {Boolean} enableStdIO
   * @param {Boolean} enableFile
   * @param {String}  logFile
   * @param {Integer} levelCutOff
   */
  constructor (...writers) {
    this.writers = writers;
    this.formatter = new Formatter();
  }

  /**
   * Write log message of severity level with optional replacements.
   *
   * @param {String}           message
   * @param {Number}           level
   * @param {String|Number} replacements
   *
   * @return this
   */
  write (message, level = 0, ...replacements) {
    for (let i = 0, len = this.writers.length; i < len; i++) {
      this.writers[i].write(this.formatter.format(message, level, ...replacements), level);
    }

    return this;
  }

  /**
   * Close log writer.
   *
   * @return {FileWriter}
   */
  close () {
    for (let i = 0, len = this.writers.length; i < len; i++) {
      this.writers[i].close();
    }

    return this;
  }
}

/**
 * Writer to disk.
 */
class WriterFile {
  /**
   * Constructor allows enabling/disabling and setting a level cut off.
   *
   * @param {Integer} levelRequired
   * @param {String}  filePath
   */
  constructor (levelRequired = -1, filePath = "/tmp/gulp-runner.log") {
    this::setRequirement(levelRequired);
    this::openFile(filePath);
  }

  /**
   * Write log message to configured file.
   *
   * @param {String} message
   *
   * @return {FileWriter}
   */
  write (message, level = 0) {
    if (!this::isOpen()) {
      return this;
    }

    if (!this::meetsRequirement(level)) {
      return this;
    }

    return this::writeLine(message);
  }

  /**
   * Close log writer.
   *
   * @return {FileWriter}
   */
  close () {
    return this::closeFile();
  }
}

/**
 * Write line to file handle.
 *
 * @param  {String} text
 *
 * @return {WriterFile|WriterStdIO|Writer}
 */
function writeLine(text) {
  fs.write(this.handle, text + "\n");

  return this;
}

/**
 * Setup log file by creating the path and opening file handle (truncating mode).
 *
 * @param {String} filePath
 *
 * @return {FileWriter}
 */
function openFile (file) {
  let filePath = path.resolve(path.dirname(file));
  let fileName = path.basename(filePath);
  let pathName = path.join(filePath, fileName);

  if (!fs.statSync(filePath)) {
    fs.mkdirSync(filePath);
  }

  this.handle = fs.openSync(pathName, 'w');
  this::setLogOpen();

  return this;
}

/**
 * Close file
 *
 * @return {WriterStdIO|WriterFile|Writer}
 */
function closeFile () {
  fs.closeSync(this.handle);

  return this;
}

/**
 * Writer to standard IO.
 */
class WriterStdIO {
  /**
   * Constructor allows enabling/disabling and setting a level cut off.
   *
   * @param {Integer} levelRequired
   */
  constructor (levelRequired = -1) {
    this::setRequirement(levelRequired);
    this::setLogOpen();
  }

  /**
   * Write log message to configured file.
   *
   * @param {String} message
   *
   * @return {StdOutWriter}
   */
  write (message, level = 0) {
    if (!this::isOpen()) {
      return this;
    }

    if (!this::meetsRequirement(level)) {
      return this;
    }

    console.log(message);

    return this;
  }

  /**
   * Close log writer.
   *
   * @return {StdOutWriter}
   */
  close () {
    this::setLogClosed();

    return this;
  }
}

/**
 * Returns true if log is open.
 *
 * @return {Boolean
 */
function isOpen() {
  return ! this.closed;
}

/**
 * Returns true if log is closed.
 *
 * @return {Boolean
 */
function isClosed() {
  return this.closed;
}

/**
 * Open log writer.
 *
 * @return {WriterStdIO|WriterFile|Writer}
 */
function setLogOpen() {
  this.closed = false;
}

/**
 * Close log writer.
 *
 * @return {WriterStdIO|WriterFile|Writer}
 */
function setLogClosed() {
  this.closed = true;
}

/**
 * Ensures passed level is greater than class defined minimum level.
 *
 * @param  {Integer} level
 *
 * @return {Boolean}
 */
function meetsRequirement(level) {
  return level >= this.levelRequired;
}

/**
 * Sets level requirement.
 *
 * @param  {Integer} level
 *
 * @return {WriterStdIO|WriterFile|Writer}
 */
function setRequirement(level) {
  this.levelRequired = level;
}
