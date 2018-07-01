
/*
 * This file is part of the `src-run/srw-gulp` project.
 *
 * (c) Rob Frawley 2nd <rmf@src.run>
 *
 * For the full copyright and license information, please view the LICENSE.md
 * file that was distributed with this source code.
 */

"use strict";

import gulp from 'gulp';
import del from 'del';
import source from 'vinyl-source-stream';
import buffer from 'vinyl-buffer';
import loader from 'gulp-load-plugins';
import pkg  from './../package.json';
import browserify from 'browserify';
import babelify from 'babelify';
import shell from 'gulp-shell';

import ConfigBuilder from './config-builder.babel.js';
import ConfigFetcher from './config-fetcher.babel.js';
import DefaultLogger from './default-logger.babel.js';

/* setup our global variables */

const plugins = loader();
const logger  = new DefaultLogger(0, './gulp.log');
const builder = new ConfigBuilder('./.gulp.json', logger);
const configs = new ConfigFetcher(builder);

/* define cleaning tasks */

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

/* define testing tasks */

gulp.task('tests-styles', () => {
  return gulp
    .src(configs.globs('tests.styles'))
    .pipe(plugins.postcss([
      require('stylelint')({
        configFile: configs.option('rc.style-lint')
      }),
      require("postcss-reporter")({
        clearMessages: true
      }),
    ], {
      parser: require('postcss-scss')
    }));
});

gulp.task('tests-scripts', () => {
  return gulp
    .src(configs.globs('tests.scripts'))
    .pipe(plugins.jscs({
      fix: true,
      configPath: configs.option('rc.js-cs')
    }))
    .pipe(plugins.jscs.reporter())
    .pipe(plugins.jscs.reporter('fail'));
});

gulp.task('tests', gulp.parallel(
  'tests-styles',
  'tests-scripts'
));

/* define asset tasks */

gulp.task('assets-images', () => {
  return gulp
    .src(configs.files('plugins.images', 'app.images'))
    .pipe(gulp.dest(configs.path('public.images')));
});

gulp.task('assets-fonts', () => {
  return gulp
    .src(configs.files('plugins.fonts', 'app.fonts'))
    .pipe(gulp.dest(configs.path('public.fonts')));
});

gulp.task('assets', gulp.parallel(
  'assets-images',
  'assets-fonts'
));

/* define build tasks */

let pluginBuildDescs = configs.plugin('builds');
let pluginBuildNames = Object.keys(pluginBuildDescs);

for(let p of pluginBuildNames){
    gulp.task('make-dependency-'+p, shell.task(pluginBuildDescs[p].cmd, {
        cwd: pluginBuildDescs[p].cwd,
        quiet: true
    }));
}

gulp.task('make-dependency', gulp.parallel(...pluginBuildNames.map(function (p) {
    return 'make-dependency-'+p;
})));

/* define style tasks */

gulp.task('make-styles', () => {
  return gulp
    .src(configs.file('app.styles'))
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.postcss([
      require('postcss-strip-inline-comments'),
      require('postcss-short'),
      require('postcss-utilities'),
      require('postcss-custom-properties'),
      require('postcss-media-minmax'),
      require("postcss-reporter")({
        clearMessages: true
      }),
    ], {
      parser: require('postcss-scss')
    }))
    .pipe(plugins.sass({
      'includePaths': configs.paths('components')
    }))
    .pipe(plugins.postcss([
      require('postcss-cssnext')({
        browsers: configs.option('browser-support')
      }),
      require('postcss-flexbugs-fixes'),
      require('postcss-sorting')({
        "sort-order": configs.option('sort-order')
      }),
      require("postcss-reporter")({
        clearMessages: true
      }),
    ]))
    .pipe(plugins.decomment.text())
    .pipe(plugins.banner(configs.option('banner-text'), {
      pkg: pkg
    }))
    .pipe(gulp.dest(configs.path('public.styles')))
    .pipe(plugins.rename({
      suffix: '.min'
    }))
    .pipe(plugins.postcss([
      require('postcss-clean'),
      require("postcss-reporter")({
        clearMessages: true
      }),
    ]))
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest(configs.path('public.styles')));
});

/* define script tasks */

gulp.task('make-scripts-core', () => {
  return browserify({
      entries: configs.file('app.scripts'),
      debug: true
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
    .pipe(plugins.banner(configs.option('banner-text'), {
      pkg: pkg
    }))
    .pipe(gulp.dest(configs.path('public.scripts')));
});

gulp.task('make-scripts-plugins', () => {
  return gulp
    .src(configs.files('plugins.scripts'))
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.concat('app-plugins.js'))
    .pipe(plugins.decomment())
    .pipe(plugins.banner(configs.option('banner-text'), {
      pkg: pkg
    }))
    .pipe(gulp.dest(configs.path('public.scripts')));
});

gulp.task('make-scripts-all', () => {
  return gulp
    .src([
      configs.path('public.scripts', {
        post: 'app-plugins.js'
      }),
      configs.path('public.scripts', {
        post: 'app-core.js'
      })
    ])
    .pipe(plugins.sourcemaps.init())
    .pipe(plugins.concatSourcemap('app.js', {
      sourcesContent: true
    }))
    .pipe(plugins.decomment())
    .pipe(plugins.banner(configs.option('banner-text'), {
      pkg: pkg
    }))
    .pipe(gulp.dest(configs.path('public.scripts')))
    .pipe(plugins.rename({
      suffix: '.min'
    }))
    .pipe(plugins.uglify())
    .pipe(plugins.sourcemaps.write('.'))
    .pipe(gulp.dest(configs.path('public.scripts')));
});

gulp.task('make-scripts', gulp.series(
  gulp.parallel(
    'make-scripts-core',
    'make-scripts-plugins'
  ),
  'make-scripts-all'
));

gulp.task('make', gulp.parallel(
  'make-styles',
  'make-scripts'
));

/* define top-level build tasks */

gulp.task('build', gulp.series(
  gulp.parallel(
    'tests',
    'clean',
  ),
  'make-dependency',
  gulp.parallel(
    'make',
    'assets'
  )
));

/* define top-level watch tasks */

gulp.task('watch', () => {
  gulp.watch(configs.globs('tests.styles'), gulp.series(
    'tests-styles',
    'make-styles'
  ));
  gulp.watch(configs.globs('tests.scripts'), gulp.series(
    'tests-scripts',
    'make-scripts'
  ));
});

/* define top-level default tasks */

gulp.task('default', gulp.series(
  'build',
  'watch'
));
