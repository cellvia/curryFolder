var fs = require('fs');
var path = require('path');
var util = require('util');

var through = require('through');
var falafel = require('falafel');
var unparse = require('escodegen').generate;
var minimatch = require('minimatchify');

var bindShim = "var bind = function bind(fn){ var args = Array.prototype.slice.call(arguments, 1); return function(){ var onearg = args.shift(); var newargs = args.concat(Array.prototype.slice.call(arguments,0)); var returnme = fn.apply(onearg, newargs ); return returnme; };  };";

module.exports = function (file) {
    if (/\.json$/.test(file)) return through();
    var data = '';
    var foldNames = {};
    var vars = [ '__dirname' ];
    var dirname = path.dirname(file);
    var pending = 0;

    var tr = through(write, end);
    return tr;

    function containsUndefinedVariable (node) {
        if (node.type === 'Identifier') {
            if (vars.indexOf(node.name) === -1) {
                return true;
            }
        }
        else if (node.type === 'BinaryExpression') {
            return containsUndefinedVariable(node.left)
                || containsUndefinedVariable(node.right)
            ;
        }
        else {
            return false;
        }
    };
    
    function write (buf) { data += buf }
    function end () {
        try { var output = parse() }
        catch (err) {
            this.emit('error', new Error(
                err.toString().replace('Error: ', '') + ' (' + file + ')')
            );
        }
        
        if (pending === 0) finish(output);
    }
    
    function finish (output) {
        tr.queue(String(output));
        tr.queue(null);
    }
    
    function parse () {
        var output = falafel(data, function (node) {
            var args = node.arguments;
            var check;
            if(isRequire(node)){
                if(args[0] && args[0].value === 'foldify'){
                    check = true;
                }
                else if(args[0]){
                    try{
                        check = require.resolve(dirname + '/' + eval(unparse(args[0])));
                        check = check.split(path.sep);
                        var check2 = check.slice(check.indexOf("foldify")+1)                        
                        check = check2.length === 1;
                    }catch(e){}
                }
            }

            if (isRequire(node) && check
            && node.parent.type === 'VariableDeclarator'
            && node.parent.id.type === 'Identifier') {
                foldNames[node.parent.id.name] = true;
            }
            if (isRequire(node) && check
            && node.parent.type === 'AssignmentExpression'
            && node.parent.left.type === 'Identifier') {
                foldNames[node.parent.left.name] = true;
            }

            if (!isFold(node) || containsUndefinedVariable(args[0])) return;
                 
            var thisDir = unparse(args[0]);
            if(/^'\.\//.test(thisDir) || /^'\.\.\//.test(thisDir)){
                thisDir = thisDir
                    .replace(/^'\.\//, "__dirname +'/")
                    .replace(/^'\.\.\//, "__dirname + '/../' +'/")
                    .replace(/ \+'\/'$/, "");
            }

            var thisDirParsed = eval(thisDir),
                fpath = path.normalize( Function(vars, 'return ' + thisDir)(dirname) ),
                thisOpts = args[1] ? eval("(" + unparse(args[1]) + ")") : {},
                encoding = thisOpts.encoding || thisOpts.enc || "utf-8",
                obj = "",
                existingProps = [],
                separator,
                resolved,
                parts,
                files = [];

            if(typeof thisOpts !== "object"){
                return tr.emit('error', 'foldify (browserify) second argument must be an options object');
            }

            var toString = thisOpts.output && thisOpts.output.toLowerCase() === "string",
                toArray = thisOpts.output && thisOpts.output.toLowerCase() === "array";

            try{
                if(~thisDirParsed.indexOf("/"))
                    separator = "/";
                if(~thisDirParsed.indexOf("\\"))
                    separator = "\\";
                parts = thisDirParsed.split(separator);
                resolved = path.dirname( require.resolve( parts[0] + separator + 'package.json' ) );
                if(!~resolved.indexOf("node_modules")) throw "not a node module";
                fpath = resolved + path.sep + parts.slice(1).join(separator);                    
            }catch(err){}

            obj+= "((function(){ ";
            obj+= bindShim;
            
            if(toString){
                obj+= "var returnMe = '';";                                    
            }
            else if(toArray){
                obj+= "var returnMe = [];";
            }else{
                obj+= "var fold = require('foldify'), proxy = {}, map = false;";
                obj+= thisOpts.tree ? "map = {};" : "";
                obj+= "var returnMe = bind( fold, {foldStatus: true, map: map}, proxy);";
            }

            function recurs(dirname2){
                fs.readdirSync(dirname2).forEach(function(file){
                    var filepath = path.join( dirname2, file);
                    if(path.extname(file) === ''){
                      if(thisOpts.recursive || thisOpts.tree) recurs(filepath);
                      return  
                    } 
                    files.push(filepath);
                });
            }
            recurs(fpath);

            if(thisOpts.whitelist) files = whitelist(thisOpts.whitelist, files, path.resolve(fpath) );
            if(thisOpts.blacklist) files = blacklist(thisOpts.blacklist, files, path.resolve(fpath) );

            files.forEach(function(filepath){
                var ext = path.extname(filepath),
                    name = path.basename(filepath, ext),
                    filename = name + ext,
                    isJs = ext === ".js" || ext === ".json",
                    propname;

                if( toString ){
                    obj += "returnMe += " + JSON.stringify(fs.readFileSync(filepath, encoding)) + ";";                 
                    return
                }

                if( toArray ){
                    obj += "returnMe.push( " + JSON.stringify(fs.readFileSync(filepath, encoding)) + ");";                 
                    return
                }

                if((isJs && thisOpts.jsToString) || !isJs)
                    toRequire = JSON.stringify(fs.readFileSync(filepath, encoding));
                else
                    toRequire = "require("+JSON.stringify(filepath)+")";

                if(!thisOpts.includeExt && (isJs || thisOpts.includeExt === false) )
                    propname = JSON.stringify(name);
                else
                    propname = JSON.stringify(filename);

                if(thisOpts.fullPath || ~existingProps.indexOf(propname) )
                    propname = filepath;
                else
                    existingProps.push(propname);                            

                if(thisOpts.tree){
                    var paths = path.relative(fpath, filepath).split(path.sep);
                    obj+="var paths = " + JSON.stringify(paths) + ";";
                    obj+="var last, thismap;";
                    obj+="for(var x = 0, len = paths.length; x<len; x++){";
                        obj+="if(x===0){";
                            obj+="if(!returnMe[ paths[x] ] )";
                                obj+="returnMe[ paths[x] ] = {};";
                            obj+="last = returnMe[ paths[x] ];";
                            obj+="if(!map[ paths[x] ] )";
                                obj+="map[ paths[x] ] = {};";
                            obj+="thismap = map[ paths[x] ]";
                        obj+="}else if(x < (len-1)){";
                            obj+="if(!last[ paths[x] ] )";
                                obj+="last[ paths[x] ] = {};";
                            obj+="last = last[paths[x]];";
                            obj+="if(!thismap[ paths[x] ] )";
                                obj+="thismap[ paths[x] ] = {};";
                            obj+="thismap = thismap[ paths[x] ];";
                        obj+="}else{";
                            obj+="last[ " + propname + " ] = " + toRequire + ";";
                            obj+="thismap[ " + propname + " ] = true;";
                        obj+="}";
                    obj+="}";
                }else{
                    obj += "returnMe[" + propname + "] = " + toRequire + ";";                    
                }

            });
            
            if(!toString && !toArray)
                obj+= "for(var p in returnMe){ proxy[p] = returnMe[p]; }";
            obj += "return returnMe;})())";
            node.update(obj);
            tr.emit('file', fpath);
            
        });
        return output;
    }
    
    function isFold (node) {
        if (!node) return false;
        if (node.type !== 'CallExpression') return false;
        return node.callee.type === 'Identifier' && foldNames[node.callee.name];
    }

    function whitelist(whitelist, files, rootdir){
        if(!whitelist || !files) return
        rootdir = rootdir || "";
        var output = [];
        whitelist = util.isArray(whitelist) ? whitelist : [whitelist];
        whitelist.forEach(function(rule){
            rule = path.join( rootdir, rule );
            files.forEach( function(name){
                if(~output.indexOf(name)) return
                if( minimatch(name, rule) )
                    output.push(name);
            })
        });
        return output;
    }

    function blacklist(blacklist, files, rootdir){
        if(!blacklist || !files) return
        blacklist = util.isArray(blacklist) ? blacklist : [blacklist];
        rootdir = rootdir || "";
        files = files.filter(function(name){
            return !blacklist.some(function(rule){
                rule = path.join( rootdir, rule );
                return minimatch(name, rule);
            });
        });
        return files
    }
};

function isRequire (node) {
    var c = node.callee;
    return c
        && node.type === 'CallExpression'
        && c.type === 'Identifier'
        && c.name === 'require'
    ;
}
