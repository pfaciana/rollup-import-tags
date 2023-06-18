import fs from 'fs';
import path from 'path';
import {normalizePath, createFilter} from '@rollup/pluginutils';
import {globSync} from 'glob'

function getOutputFile() {
	const file = [...arguments].find(Boolean);
	return file ? path.basename(file) : false;
}

function iifeCode(content, cond = true) {
	return cond ? `(function () { \n ${content} \n })();` : content;
}

export default function importTags(options = {}) {
	const filter = createFilter(options.include, options.exclude);

	let inputs = [];

	let {tags = 'script', modifyOutputFile, modifyContent, iife: fileIife = true, labelContent = false} = options;
	tags = (Array.isArray(tags) ? tags : [tags]).join('|');

	const regex = {
		contents: new RegExp(`<(?:${tags})\\b[^>]*>([\\s\\S]*?)<\\/(?:${tags})>`, 'gi'),
		startTag: new RegExp(`(<(?:${tags})\\b[^>]*>)`, 'g'),
		attrs: /(\S+)=['"]?((?:(?!\/>|>|"|').)+)/g,
	};

	let chunks = {};

	return {
		name: 'rollup-plugin-import-tags',

		async options(opts) {
			opts.input ||= []
			opts.input = Array.isArray(opts.input) ? opts.input : [opts.input];
			inputs = [...opts.input];
			opts.input = false;
			return opts;
		},

		async buildStart(opts) {
			let blocks = {};
			inputs.forEach(input => {
				const files = globSync(input);
				files.forEach(file => {
					if (!filter(file)) {
						return;
					}

					this.addWatchFile(file);

					const source = fs.readFileSync(file, 'utf-8');

					let matchTag;
					while ((matchTag = regex.contents.exec(source)) !== null) {
						const [outerHTML, innerHTML] = matchTag;
						const startTag = outerHTML.match(regex.startTag)[0];
						let matchAttrs, attrs = {};
						while ((matchAttrs = regex.attrs.exec(startTag)) != null) {
							const [ignore, attrKey, attrVal] = matchAttrs;
							attrs[attrKey] = attrVal;
						}
						const iife = typeof attrs['data-iife'] === 'undefined' || !['0', 'false', 'no'].includes(attrs['data-iife'].toLowerCase());
						let outputFiles = typeof attrs['data-file'] !== 'undefined' && attrs['data-file'] ? attrs['data-file'] : '';
						outputFiles = [...new Set(outputFiles.split(',').map(part => part.trim()))];
						outputFiles.forEach(outputFile => {
							let content = labelContent ? `\t/** ${normalizePath(file)} **/\n${innerHTML}` : innerHTML;
							if (typeof modifyOutputFile === 'function') {
								outputFile = modifyOutputFile(outputFile, content, attrs, {inputFile: file, inputFiles: files, inputPattern: input, outputFiles, outerHTML, startTag, source, normalizePath});
							}
							if (!outputFile) {
								return;
							}
							if (typeof modifyContent === 'function') {
								content = modifyContent(content, attrs, {inputFile: file, inputFiles: files, inputPattern: input, outputFile, outputFiles, outerHTML, startTag, source, normalizePath});
							}
							if (content === false) {
								return;
							}
							(blocks[outputFile] ||= []).push({file, iife, content, attrs});
						});
					}
				});
			});
			Object.entries(blocks).forEach(([outputFile, inputFiles]) => {
				const fileName = getOutputFile(outputFile);
				chunks[fileName] = inputFiles.map(({iife, content}) => iifeCode(content, iife)).join("\n");
				this.emitFile({type: 'chunk', id: fileName});
			});
		},

		async resolveId(source, importer, options) {
			return source in chunks ? source : null;
		},

		async load(id) {
			return id in chunks ? chunks[id] : null;
		},

		outputOptions(outputOptions) {
			if (!outputOptions.chunkFileNames) {
				outputOptions.chunkFileNames = '[name].js';
			}
			return outputOptions;
		},

		async generateBundle(outputOptions, bundle) {
			if (!fileIife) {
				return;
			}

			const jsFiles = Object.values(bundle).filter(({type}) => type === 'chunk');

			for (const file of jsFiles) {
				file.code = iifeCode(file.code, fileIife);
			}
		},
	};
};
