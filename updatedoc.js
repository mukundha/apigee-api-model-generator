var config = require('./config.js');
var testlocal = require('./testlocal.js');
var authheader = 'Basic ' + new Buffer(config.user + ':' + config.pass).toString('base64') ;
var q = require('q');
var fs = require('fs');

var org = config.org;
var product = config.apiproduct ;
var model =  config.apimodel;

var httpobj = (config.scheme == "https") ? require('https') : require('http');

var dp = q.defer();

//Fetch API Product

makeRequest('/v1/o/' + org+'/apiproducts/' + product,dp,'GET');
dp.promise.then(buildModel);


function buildModel (ctx) {

	console.log(ctx.message);
	//Build WADL for relevant API Products
	var p = testlocal.loadProxies(ctx.message.proxies);
	p.then(updateModel);

}
function updateModel(){

		console.log('build done');
		//Update the Model
		var url  = '/v1/o/' + org +'/apimodels/' + model+'/revisions?action=import&format=WADL';
		fs.readFile( org + '.wadl','UTF-8',function(err,content){
			console.log(content);
			console.log(err);
			var dpmodel = q.defer();
			makeRequest1(url,dpmodel, 'POST',content);
			dpmodel.promise.then(function(){
			console.log('all done');
		});
	});
}

function makeRequest (path,dp,method,body){
	var options = {
		  hostname: config.host,
		  port: config.port,
		  path: path,
		  method: method,
		  headers : { 
		  				'Authorization' : authheader ,
		  			  	'Accept' : 'application/json' ,
		  			 }
		};
	console.log('Making request to ' + config.host + ":" + config.port + path);
	var data = '';
	var req = httpobj.request(options, function (res){
		console.log(res.statusCode);
		res.on('data',function(d){
			data+=d.toString();
		});
		res.on('end',function(){
			console.log(data);
			dp.resolve({message: JSON.parse(data)});
		});
	});
	req.on('error',function(e){
		console.log('error occured');
		console.log(e);
		dp.resolve({message: 'error occured'});
	});
	if(body && method=='POST')
	{
		req.write(body);
		console.log('writing request body');
		console.log(body);
	}
	req.end();
}

function makeRequest1 (path,dp,method,body){
	var options = {
		  hostname: config.host,
		  port: config.port,
		  path: path,
		  method: method,
		  headers : { 
		  				'Authorization' : authheader ,
		  			  	'Accept' : 'application/json' ,
		  			  	'Content-Type' : 'application/xml'
		  			 }
		};
	console.log('Making request to ' + config.host + ":" + config.port + path);
	var data = '';
	var req = httpobj.request(options, function (res){
		console.log(res.statusCode);
		res.on('data',function(d){
			data+=d.toString();
		});
		res.on('end',function(){
			console.log(data);
			dp.resolve({message: JSON.parse(data)});
		});
	});
	req.on('error',function(e){
		console.log('error occured');
		console.log(e);
		dp.resolve({message: 'error occured'});
	});
	if(body && method=='POST')
	{
		req.write(body);
		console.log('writing request body');
		console.log(body);
	}
	req.end();
}