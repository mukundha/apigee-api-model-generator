var q =require('q');
var config = require('./config.js');
var fs = require('fs');
var mkpath = require('mkpath');
var xml2js = require('xml2js');
var AdmZip = require('adm-zip');

var httpobj = (config.scheme == "https") ? require('https') : require('http');

var authheader = 'Basic ' + new Buffer(config.user + ':' + config.pass).toString('base64') ;
exports.listProxies = function(org){
	var dp = q.defer();
	var path = '/' + config.version + '/o/' + org +'/apis';
	makeRequest( path , dp);
	return dp.promise ;
}

exports.getRevisions = function(org,api){
	var dp = q.defer();
	var path = '/' + config.version + '/o/' + org +'/apis/' + api + '/revisions';
	makeRequest( path , dp);
	return dp.promise ;
}

exports.download = function(org,api,revision){
	var dp = q.defer ();
	var path = '/' + config.version + '/o/' + org +'/apis/' + api + '/revisions/' + revision + '?format=bundle';
	var options = {
		  hostname: config.host,
		  port: config.port,
		  path: path,
		  method: 'GET',
		  headers : { 
		  				'Authorization' : authheader ,
		  				'Accept' : 'application/json'
		  			 }
		};
	console.log('Making request to ' + config.host + ":" + config.port + path);
	
	var req = httpobj.request(options, function (res){
		console.log('response received');
		res.on('data',function(d){
			try{
				fs.appendFileSync( org + '/' + api +'/' + api + '.zip' , d);
			}catch(err){
				console.log(err);
				dp.resolve(err);
			}
		});
		res.on('end',function(){
			//console.log(data);
			var zip = new AdmZip(org + '/' + api +'/' + api + '.zip');
   			zip.extractAllTo(org + '/' + api +'/', true);
			dp.resolve({});
		});
	});
	req.on('error',function(e){
		console.log('error occured');
		console.log(e);
		dp.resolve({message: 'error occured'});
	});
	var dirs = org + '/' + api + '/';
	
	console.log('creating dirs ' + dirs);
	mkpath(dirs,function(err){
		console.log('done creating dirs');
		//console.log(err);	
		req.end();
	});
	return dp.promise ;
}

exports.getProxyEndpoints = function(org, api){
	console.log('getting proxy endpoints');
	var path = org + '/' + api + '/apiproxy/proxies/' ;
	console.log(path);
	var dp = q.defer();

	fs.readdir(path, function(err, files) {
		if (err) console.log(err);
		//console.log(files);
		var ret = [];
		for(var i in files){
			if ( files[i].indexOf('.xml') > 0 ){
				//console.log(files[i]);
				ret.push(files[i].split('.xml')[0]);
			}
		}
	    dp.resolve({message:ret});
	});
	return dp.promise ;
}

exports.getProxyEndpoint = function(org, api, proxyEndpoint ){
	console.log('getting proxy endpoint ' + proxyEndpoint);
	var dp = q.defer();
	var path =  org +'/' + api + '/apiproxy/proxies/' +  proxyEndpoint +'.xml' ;
	console.log(path);
	var parser = new xml2js.Parser({explicitRoot:false, explicitArray:false});
	fs.readFile(path,function(err,data){
		if (err) { console.log(err); dp.resolve({error:data})};
		parser.parseString(data.toString(),function(err,result){
			if ( err) console.log(err);
			if ( typeof result.Flows == 'string') result.Flows = {Flow:[]};
			else if ( typeof result.Flows.Flow == 'object' && ! (result.Flows.Flow instanceof Array) ) { var temp = [result.Flows.Flow] ; result.Flows.Flow=temp};
			dp.resolve({message:result});
			console.log(JSON.stringify(result));
		});
	    
	});
	return dp.promise ;
}

exports.getPolicy = function(org, api, policy ){
	//console.log(policy);
	var dp = q.defer();
	var path =  org +'/' + api + '/apiproxy/policies/' + policy + '.xml';
	var parser = new xml2js.Parser({explicitRoot:false, explicitArray:false});
	fs.readFile(path,function(err,data){
		if (err) { console.log(err); dp.resolve({error:data})};
		parser.parseString(data.toString(),function(err,result){
			//console.log(JSON.stringify(result));
			dp.resolve({message:result});
		});
	});
	return dp.promise ;
}

exports.getPolicies = function(org,api){
	//console.log('get policies');
	var dp = q.defer();
	var path =  org +'/' + api + '/apiproxy/policies/'  ;

	fs.readdir(path,function(err,files){
		var arr = [] ;
		for ( var i in files){
			if ( files[i].indexOf('.xml') > 0 ){
				
				arr.push(files[i].replace('.xml',''));

				// var parser = new xml2js.Parser({explicitRoot:false, explicitArray:false});
				// fs.readFile(path  + files[i],function(err,data){
				// 	if (err) { console.log(err); dp.resolve({error:data})};
				// 	parser.parseString(data.toString(),function(err,result){
				// 		console.log(JSON.stringify(result));
				// 		var arr = [] ;
				// 		if ( result.Policies.Policy instanceof Array)
				// 			arr = result.Policies.Policy;
				// 		else if ( typeof result.Policies.Policy == "string" )
				// 			arr.push(result.Policies.Policy);
				// 		dp.resolve({message:arr});
				// 	});
				// });
			}
		}
		dp.resolve({message:arr});
	});
	//console.log(path);
	
	return dp.promise;
}	


function makeRequest (path,dp){
	var options = {
		  hostname: config.host,
		  port: config.port,
		  path: path,
		  method: 'GET',
		  headers : { 
		  				'Authorization' : authheader ,
		  			  	'Accept' : 'application/json' 
		  			 }
		};
	console.log('Making request to ' + config.host + ":" + config.port + path);
	var data = '';
	var req = httpobj.request(options, function (res){
		res.on('data',function(d){
			data+=d.toString();
		});
		res.on('end',function(){
			//console.log(data);
			dp.resolve({message: JSON.parse(data)});
		});
	});
	req.on('error',function(e){
		console.log('error occured');
		console.log(e);
		dp.resolve({message: 'error occured'});
	});
	req.end();
}