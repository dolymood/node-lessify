// v0.0.9a

var path = require("path");
var through = require('through2');
var less = require('less');
var assign = require('object-assign');

var textMode = false,
	func_start = "(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';",
	func_end = "if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())"; 

/*
you can pass options to the transform from your package.json file like so: 
    "browserify": {
        "transform-options": {
        	"node-lessify": "textMode"
        }
    }
	NOTE: This is deprecated since it is now possible to do this like so:

    "browserify": {
		"transform": [
			[ "node-lessify", { "textMode": true } ]
		]
	}
*/

try {
	var options = require(process.cwd() + "/package.json");
} catch (e) {
	var options = {};
};

/*
textMode simply compiles the LESS into a single string of CSS and passes it back without adding the code that automatically appends that CSS to the page
*/

if (options.browserify && options.browserify["transform-options"] && options.browserify["transform-options"]["node-lessify"] == "textMode") {
	textMode = true;
}

module.exports = function(file, package_options) {
	if (!/\.css$|\.less$/.test(file)) {
		return through();
	}

	// supplement options with those from package
	for (var key in package_options) {
		if (package_options.hasOwnProperty(key) && key !== "_flags") {
			options[key] = package_options[key];
		}
	}

	var buffer = "", mydirName = path.dirname(file);

	return through(write, end);

    function write(chunk, enc, next) {
        buffer += chunk.toString();
        next();
    }

	function end(done) {
        var self = this;

  		// CSS is LESS so no need to check extension
		less.render(buffer, assign({ 
			paths: [".", mydirName],
			compress: true
		}, {
            plugins: package_options.plugins ? package_options.plugins : undefined
        }), function(e, output) { 		
			if (e) {
				var msg = e.message;
				if (e.line) {
					msg += ", line " + e.line;
				}
				if (e.column) {
					msg += ", column " + e.column;
				}
				if (e.extract) {
					msg += ": \"" + e.extract + "\"";
				}

				return done(new Error(msg, file, e.line));
			}

			compiled = output.css;
			compiled = compiled.replace(/url\((['"]?)(.+?)\1\)/gi, function (m, s, src) {
				var prefix = package_options.prefix || '/';
				if (src.charAt(0) === '/' || src.match(/^(data|http|https):/)) {
					if (prefix.charAt(0) === '/' && prefix.charAt(1) !== '/') {
						return m;
					} else {
						return m.replace(src, path.join(prefix, src).replace(/\\/g, '/'));
					}
				}
				var a = path.join(mydirName, src);
				var b = package_options.root || mydirName;
				var c = path.relative(b, a);
				if (c !== src) {
					c = path.join(prefix, c);
				}
				c = c.replace(/\\/g, '/');
				return m.replace(src, c);
			});
			if (textMode || package_options.textMode) {
	            compiled = "module.exports = " + JSON.stringify(compiled) + ";";
			} else {
				compiled = func_start + "var css = " + JSON.stringify(compiled) + ";" + func_end;
			}

			self.push(compiled);
            self.push(null);

			output.imports.forEach(function(f) {
				self.emit('file', f);
			});

			done();
		}); 
	}
};
