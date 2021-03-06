# foldify
Fold your folders, any way you like.

Import / require folders of any filetypes; evaluate / curry the results.

[![build status](https://secure.travis-ci.org/cellvia/foldify.png)](http://travis-ci.org/cellvia/foldify)

```javascript
var foldify = require("foldify");
var routes = foldify(__dirname + "/lib/routes", {tree: true});

// routes.errors.500:  function(app){ app.get(...) }
// routes.errors.501:  function(app){ app.get(...) }
// routes.index: 	   function(app){ app.get(...) }
// routes.user.login:  function(app){ app.get(...) }
// routes.user.logout: function(app){ app.get(...) }

routes(app, {whitelist: "errors/**"});
//just errors are now attached!

routes(app);
//all routes are now attached!
```
Clientside folding supported as well :-)

## Uses
* attach a folder of routes/controllers/etc easily (stop updating those pesky index.js files, who needs them??)
* create a simple object hash of content, optionally filtered (for ex: grab all templates into a hash)
* add a module w/ styles or templates (like bootstrap) to your project, then fold the style/etc folders you want from it.  (helpful for including non-js dependencies in your project and keeping them clean.)
* functional fun, curry as much as you like before / during evaluation
* get creative!

## Install

`npm install foldify`

## Usage

There are two steps to usage.  First you must *initialize the hash*, by running foldify upon a directory name, an object, or an array of these.  The provided object is useful in itself, but you can then *evaluate the hash* with provided arguments, or just curry them in.  These steps take slightly different options, but both allow whitelisting/blacklisting of filenames/properties.

## Initializing the hash

When the hash is initialized the result is a function object with properties whose content is taken from the respective files and names are taken from the filenames.

Note: `.js` and `.json` files are `require()`'d into the hash, while all other files are `fs.readFileSync()`'d.

Hash is something like:
```javascript
{ 	filename: require("./filename.js"),
	filename2: fs.readFileSync("./filename.html") }
```

### foldify( dirname, [options] );

**dirname** may be a path to a folder, node module, node module subdir path (ex: "foldify/test"), object, or array of any of these.  In the case of an object, it is simply returned wrapped with the foldify functionality.

**NOTE:** in the browser, **dirname** may not be dynamic, except for **__dirname** which does get parsed. ex: `foldify(__dirname + '/files')` will work while `foldify(path.join(__dirname, 'files'))` will not.

```javascript
var foldify = require("foldify");

var errorControllers = foldify(__dirname + "/lib/controllers/errors");
```

Even just this object can be useful:
```javascript
//with a folder structure like:
// ~/lib/controllers/errors/
//                      .../500.js
//                      .../403.js
//                      .../402.js

app.get( '/500', errorControllers.500 );
app.get( '/403', errorControllers.403 );
app.get( '/402', errorControllers.402 );
```

also `for...in` compatible:
```javascript
for(var controllerName in errorControllers){
	app.get( '/' + controllerName, errorControllers[controllerName] );
}
```

## Initialization Options

**NOTE:** due to browserify limitations, clientside initialization option properties may NOT be dynamically assigned, and must occur inline.

### recursive (default: false)

Include subfolders.

### tree (default: false)

Include subfolders, and return hierarchical structure based on filepath.

### output (default: "object")

**output** can be set to string, array, or object.  If string or array, all files will be `fs.readFileSync()`'d.

### whitelist

Accepts string or array.
Uses [minimatch](https://github.com/isaacs/minimatch) upon filepaths using supplied whitelist patterns, supplied rules are prefixed with the curried directory. Reference [minimatch](https://github.com/isaacs/minimatch) documentation for matching behavior.

```javascript
var foldify = require("foldify");
var stylesAndHtml = foldify(__dirname + "/client", {whitelist: ["*.less, *.html"], recursive: true});
//will grab all .less and .html files into hash, as strings
```

### blacklist

Accepts string or array.
Uses [minimatch](https://github.com/isaacs/minimatch) upon filepaths using supplied blacklist patterns.  Supplied rules are prefixed by the curried directory. Reference [minimatch](https://github.com/isaacs/minimatch) documentation for matching behavior.

```javascript
var foldify = require("foldify");
var templates = foldify(__dirname + "/templates", {blacklist: ".json", recursive: true});
//will grab all files EXCEPT .json files
```

### includeExt

When generating the property names for the hash, this determines whether to include extensions.  Default is false for .js and .json, and true for all others.  Manually setting this option will apply it to all filetypes.

### fullPath (default: false)

When generating the property names for the hash, this determines whether to use the full filepath as the property name.  This is defaulted to for cases of duplicate property names.

A benefit of **fullPath** is more flexibility with minimatch white/black listing at evaluation.

### jsToString (default: false)

Import `.js` / `.json` files as strings rather than require them.

### encoding (default: 'utf-8')

Change the encoding of files that are readFileSync'ed

## Evaluating the hash

Once the hash is initialized, it becomes a function that can be evaluated.  It is also an object whose properties make up the hash.  Everytime the function is evaluated, it returns another function-object that can also be evaluated.

Evaluation is very useful when keeping folders of like files that export functions taking similar arguments.

For example a folder of express routes a la:
```javascript
module.exports = function(app){
	app.get('/', function(req, res){ res.end("hello world"); });
}
```

### functionObject( [args], [options] );

This represents the returned function object that is created after initialization.

**args** is optional, and may be a single argument, or an array of arguments (if you would like to pass in an actual array as an argument itself, you must encapsulate it with another array, or it will be parsed as if the values within that array represent arguments.)

Following from the example above, to attach all routes to the same express app:
```javascript
var app = express();
var foldify = require("foldify");

var routes = foldify(__dirname + "/routes");

routes(app);
//all routes are attached!
```

## Evaluation options

### whitelist

Accepts string or array.
Uses [minimatch](https://github.com/isaacs/minimatch) upon property names using supplied whitelist patterns. Reference [minimatch](https://github.com/isaacs/minimatch) documentation for matching behavior.

```javascript
var foldify = require("foldify");
var routes = foldify(__dirname + "/routes");
routes(app, {whitelist: "a*"} );
//only connects routes beginning with "a"
```
If **trim** option is set, returned function object will have non-whitelisted properties removed.

If hash is **tree** structure, whitelist rules should use `/` as a delimiter for properties.  for ex: `{whitelist: "path/to/property/**"}`

### blacklist

Accepts string or array.
Uses [minimatch](https://github.com/isaacs/minimatch) upon property names using supplied blacklist patterns. Reference [minimatch](https://github.com/isaacs/minimatch) documentation for matching behavior.

```javascript
var foldify = require("foldify");
var routes = foldify(__dirname + "/routes");
routes(app, {blacklist: "a*"} );
//connects routes except those beginning with "a"
```
If **trim** option is set, returned function object will have blacklisted properties removed.

If hash is **tree** structure, blacklist rules should use `/` as a delimiter for properties.  for ex: `{blacklist: "path/to/property/**"}`

### evaluate (default: true)

Set to false if you only want to curry the hash's functions, not evaluate them.

With a folder 'mathFuncs' with files like:
```javascript
module.exports = sum;
function sum(){
	var sum = [].slice.call(arguments, 0)
				.reduce(function(prev, current){ return (+prev || 0) + (+current || 0); });
	console.log("sum = " + sum);
}
```

```javascript
var foldify = require("foldify");
var mathFuncs = foldify(__dirname + "/lib/mathFuncs");

//To curry only, set 'evaluate' to false:
var curried = mathFuncs(1, {evaluate: false});

var curried2 = curried([2,3], {evaluate: false});

curried()
//sum = 1

curried2()
//sum = 6
```

### trim (default: false)

If a function or property evaluates to undefined, or is blacklisted / outside of whitelist, then remove it.

### allowUndefined (default: false)

Normally, when evaluated function returns undefined (as in the math example above), the function itself will be placed back into the hash but with the supplied arguments curried:

```javascript
//reference evaluate option code

var curried3 = curried2(10);
//sum = 16

typeof curried3.mathFunc // function

curried3()
//sum = 16

var curried4 = curried3(20)
//sum = 36

curried4()
//sum = 46
```

But if **allowUndefined** is true, functions may return undefined into the hash instead of a curried version of itself:

```javascript
var curried3 = curried2(10, {allowUndefined: true});
//sum = 16

typeof curried3.mathFunc // undefined

curried3()
//folding further will continue to produce `undefined`
```

## Features

###completed:
* server side and client side support (via supplied browserify transform)
* can return a tree structure, keeps track where in the structure to evaluate without polluting object itself
* can include npm modules or subfolders of npm modules (if you want to grab specific folder of css/less files from a module for example)
* can be folded endlessly
* whitelist / blacklist files or properties at each iteration (using [minimatch](https://github.com/isaacs/minimatch))
* compatible with for...in (no prototype properties to sort through)
* tests in both server and browser
* ie8 compatiblity thank the lawd
* base64 encoding

###yet to be completed:
* ability to wrap a function to transform individual results (needed?)
* add tests for inputting arrays
* add test for inputting and currying existing objects
* add test for curry even upon evaluation (if undefined returned)
* combine curry objects (a la extend)

## Testing

Run `npm install` then `npm test` to test server code.

To test in browser please install [browserify](https://github.com/substack/browserify) globally and [testling](https://github.com/substack/testling) globally, and then run `testling -u`