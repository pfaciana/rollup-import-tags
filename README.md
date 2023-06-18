# Import Tags Rollup Plugin

`rollup-import-tags` is a Rollup.js plugin that allows you to import code blocks from arbitrary, user defined, tags in your files, similar to the functionality provided by `gulp-tags-to-files` for Gulp.js. It parses files, looking for specified tags (like `<script>`), then extracts the contents and then creates new chunks for each of these code blocks.

The plugin is highly configurable, allowing you to specify which tags to scan, include/exclude files based on a pattern, and apply additional transformations to the code blocks.

This Rollup.js plugin also provides two callback functions, allowing you to further manipulate the output file name and the contents.

Another unique feature of the plugin is the ability to wrap the extracted code in an Immediately Invoked Function Expression (IIFE) and to label the contents of the output file with the source file the code came from.

## Installation

You can install the plugin via npm or Yarn:

```shell
npm install rollup-import-tags --save-dev
```

or

```shell
yarn add rollup-import-tags --dev
```

## Example Usage

```javascript
import babel from '@rollup/plugin-babel';
import brotli from 'rollup-plugin-brotli';
import importTags from 'rollup-import-tags';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default [
	// Basic Example
	{
		input: 'modules/**/*.php',
		output: [
			{dir: 'js/dist', format: 'iife'},
			{dir: 'js/dist', chunkFileNames: '[name].min.js', format: 'iife', plugins: [terser(), brotli({options: {level: 11}})]},
		],
		plugins: [
			resolve(),
			importTags(),
			babel({presets: [['@babel/preset-env'], ['@babel/preset-react']], babelHelpers: 'bundled'}),
		],
	},
	// Advanced Example
	{
		input: ['src/**/*.html', 'templates/**/*.html'],
		output: [
			{dir: 'js/dist'},
			{dir: 'js/dist', chunkFileNames: '[name].min.js', plugins: [terser(), brotli({options: {level: 11}})]},
		],
		plugins: [
			resolve(),
			importTags({
				tags: ['script', 'module', 'template'], // defaults to `'script'`
				iife: false, // defaults to `true`
				labelContent: true, // defaults to `false`
				include: '**/*part.html',
				exclude: '**/test/**/*',
				modifyOutputFile: (outputFile, content, attrs, {inputFile, inputFiles, inputPattern, outputFiles, outerHTML, startTag, source, normalizePath}) => {
					if (outputFile.includes('dont-include-this-file.html')) {
						// Any `outputFile` that is `falsy` will be skipped/ignored in the output
						return '';
					}
					return attrs.type === 'text/babel' ? 'babel.js' : outputFile;
				},
				modifyContent: (content, attrs, {inputFile, inputFiles, inputPattern, outputFile, outputFiles, outerHTML, startTag, source, normalizePath}) => {
					if (normalizePath(inputFile).include('/test')) {
						// Any `content` that is `false` will be skipped/ignored in the output
						return false;
					}
					return content.includes('*** dont include this file !!!') ? false : content;
				},
			}),
			babel({presets: [['@babel/preset-env'], ['@babel/preset-react']], babelHelpers: 'bundled'}),
		],
	},
];
```

## Options

- `tags`: An array of strings specifying which HTML tags to look for.
    - The default is `['script']`.

- `iife`: A boolean indicating whether to wrap each extracted JavaScript code block in an IIFE.
    - The default is `true`.

- `labelContent`: A boolean indicating whether to label the output content with the source file it came from.
    - For example `/** src/dir/file.js **/` at the top of each section.
    - The default is `false`.

- `include`: A picomatch pattern, or array of patterns, specifying the files to include.
    - By default all files are included.

- `exclude`: A picomatch pattern, or array of patterns, specifying the files to exclude.
    - By default no files are excluded.

- `modifyOutputFile`: A callback that allows the user to override the output file the content goes to
    - All `falsy` response mean the current code block will be skipped/ignored in the output.

- `modifyContent`: A callback that allows the user to override or change the content of the code block.
    - A `false` response mean the current code block will be skipped/ignored in the output.

## `data-` attributes in the source file

There are two special attributes added to the matching tags, in the source code, that can be used to control the behavior of the plugin. Those are `data-file` and `data-iife`. While both of these attributes can be skipped and overwritten in the config callbacks (see below). It is often best to define these in the source code to keep the logic and intention in one place.

The `data-file` attribute is used to specify the output file name for the code block.

The `data-iife` attribute is used to specify whether the code block should be wrapped in an IIFE.

```php
<?php
# template/hello.php

function hw_js() { ?>
  <script data-file="hello-world.js" data-iife="true">
      window.HelloWorld = function () {
          console.log('Hello World!');
      }
  
      jQuery(document).ready(function ($) {
          $('.hello-world').click(function () {
              HelloWorld();
          }
      });
  </script>
<?php }

echo '<button class="hello-world">Hello</button>';
```