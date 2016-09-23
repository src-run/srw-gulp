
/*
 * This file is part of the `src-run/srw-gulp` project.
 *
 * (c) Rob Frawley 2nd <rmf@src.run>
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

"use strict";

import del  from 'del';
import gulp from 'gulp';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import loader from 'gulp-load-plugins';
import project  from './../package.json';

import browserify from 'browserify';
import babelify from 'babelify';
import processFlexBoxBugs from 'postcss-flexbugs-fixes';
import processCleanCss from 'postcss-clean';
import processCssComb from 'csscomb';
import processPrefixer from 'autoprefixer';
import processCssNext from 'postcss-cssnext';
import procesStripComments from 'postcss-strip-inline-comments';
import syntaxScss from 'postcss-scss';

import ConfigBuilder from './config-builder.babel.js';
import ConfigFetcher from './config-fetcher.babel.js';
import DefaultLogger from './default-logger.babel.js';

let plugins = loader();
let logger  = new DefaultLogger(0, './gulp.log');
let builder = new ConfigBuilder('./.gulp.json', logger);
let configs = new ConfigFetcher(builder);

gulp.task('clean-scripts', () => {
  return del(configs.paths('public.scripts'));
});

gulp.task('clean-styles', () => {
  return del(configs.paths('public.styles'));
});

gulp.task('clean-images', () => {
  return del(configs.paths('public.images'));
});

gulp.task('clean-fonts', () => {
  return del(configs.paths('public.fonts'));
});

gulp.task('clean', gulp.parallel(
  'clean-styles',
  'clean-scripts',
  'clean-images',
  'clean-fonts'
));

gulp.task('tests-styles', () => {
  let inputs = configs.globs('tests.styles');

  return gulp
    .src(inputs)
    .pipe(plugins.debug())
    .pipe(plugins.sassLint());
});

gulp.task('tests-scripts', () => {
  let inputs = configs.globs('tests.scripts');
  let jscsConf = configs.option('rc.js-cs');

  return gulp
    .src(inputs)
    .pipe(plugins.debug())
    .pipe(plugins.jscs({
      fix: true, configPath: jscsConf
    }))
    .pipe(plugins.jscs.reporter())
    .pipe(plugins.jscs.reporter('fail'));
});

gulp.task('tests', gulp.parallel(
  'tests-styles',
  'tests-scripts'
));

gulp.task('assets-images', () => {
  let inputs = configs.files('plugins.images', 'app.images');
  let output = configs.path('public.images');

  return gulp
    .src(inputs)
    .pipe(plugins.debug())
    .pipe(gulp.dest(output));
});

gulp.task('assets-fonts', () => {
  let inputs = configs.files('plugins.fonts', 'app.fonts');
  let output = configs.path('public.fonts');

  return gulp
    .src(inputs)
    .pipe(plugins.debug())
    .pipe(gulp.dest(output));
});

gulp.task('assets', gulp.parallel(
  'assets-images',
  'assets-fonts'
));

gulp.task('make-styles', () => {
  let banner = configs.option('banner-text');
  let inputs = configs.file('app.styles');
  let includes = configs.paths('components');
  let browsers = configs.option('prefix-rule-set');
  let cssCombConf = configs.option('rc.css-comb');
  let output = configs.path('public.styles');

  return gulp
    .src(inputs)
    .pipe(plugins.debug())
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.postcss([
      processFlexBoxBugs(),
      processCssNext({
        browsers: browsers
      }),
      procesStripComments(),
    ], {
      syntax: syntaxScss
    }))
    .pipe(plugins.sass({
      'includePaths': includes
    }))
    .pipe(plugins.csscomb({
      config: cssCombConf
    }))
    .pipe(plugins.decomment.text())
    .pipe(plugins.banner(banner, {
      pkg: project
    }))
    .pipe(gulp.dest(output))
    .pipe(plugins.rename({
      suffix: '.min'
    }))
    .pipe(plugins.postcss([
      processCleanCss()
    ]))
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest(output));
});

gulp.task('make-scripts-app-core', () => {
  let input = configs.file('app.scripts');
  let banner = configs.option('banner-text');
  let output = configs.path('public.scripts');

  return browserify({
      entries: input,
      debug:   true
    })
    .transform(babelify, {
      presets: [
        'es2015'
      ]
    })
    .bundle()
    .pipe(source('app-core.js'))
    .pipe(buffer())
    .pipe(plugins.decomment())
    .pipe(plugins.banner(banner, {
      pkg: project
    }))
    .pipe(gulp.dest(output));
});

gulp.task('make-scripts-app-plugins', () => {
  let input = configs.files('plugins.scripts');
  let banner = configs.option('banner-text');
  let output = configs.path('public.scripts');

  return gulp
    .src(input)
    .pipe(plugins.debug())
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.concat('app-plugins.js'))
    .pipe(plugins.decomment())
    .pipe(plugins.banner(banner, {
      pkg: project
    }))
    .pipe(gulp.dest(output));
});

gulp.task('make-scripts-app', () => {
  let inputs = [
    configs.path('public.scripts', {
      post: 'app-plugins.js'
    }),
    configs.path('public.scripts', {
      post: 'app-core.js'
    })
  ];
  let banner = configs.option('banner-text');
  let output = configs.path('public.scripts');

  return gulp
    .src(inputs)
    .pipe(plugins.debug())
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.concatSourcemap('app.js', {
      sourcesContent: true
    }))
    .pipe(plugins.decomment())
    .pipe(plugins.banner(banner, {
      pkg: project
    }))
    .pipe(gulp.dest(output))
    .pipe(plugins.rename({
      suffix: '.min'
    }))
    .pipe(plugins.uglify())
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest(output));
});

gulp.task('make-scripts', gulp.series(gulp.parallel(
  'make-scripts-app-core',
  'make-scripts-app-plugins'),
  'make-scripts-app'
));

gulp.task('make', gulp.parallel(
  'make-styles',
  'make-scripts'
));

gulp.task('build', gulp.series(
  gulp.parallel(
    'tests',
    'clean'
  ),
  gulp.parallel(
    'make',
    'assets'
  )
));

gulp.task('watch', () => {
  let styleGlobs = configs.globs('tests.styles');
  let scriptGlobs = configs.globs('tests.scripts');

  gulp.watch(styleGlobs, gulp.series(
    'tests-styles',
    'make-styles'
  ));

  gulp.watch(scriptGlobs, gulp.series(
    'tests-scripts',
    'make-scripts'
  ));
});

gulp.task('default', gulp.series(
  'build',
  'watch'
));
