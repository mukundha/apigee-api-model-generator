var proxy = require('./apiproxy_apigee_lo.js');
var q = require('q');
var fs= require('fs');
var config = require('./config.js');
var org = config.org;
var xmlbuilder = require('xmlbuilder');
var app = xmlbuilder.create('application');


exports.startLoading = function(){
	var promise = proxy.listProxies(org);
	promise
	.then(function(ctx){
		var dp = q.defer();
		getLatestRevisions(ctx,dp);
		return dp.promise ;
	})
	.then (function(ctx){
		console.log(ctx.message);
		var proxies = ctx.message.proxies;
	});

}
exports.loadProxies = function(proxies){
	var dp = q.defer();
	getLatestRevisions({message:proxies},dp);
	return dp.promise ;
}
//exports.startLoading();
var tests = [] ;
var params = [] ;
var policyParams = {} ;
var app = xmlbuilder.create('application');

app.att('xmlns','http://wadl.dev.java.net/2009/02');
app.att('xmlns:apigee','http://api.apigee.com/wadl/2010/07/');
app.att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
app.att('xmlns:xsd',"http://www.w3.org/2001/XMLSchema");
app.att('xsi:schemaLocation',"http://wadl.dev.java.net/2009/02 http://apigee.com/schemas/wadl-schema.xsd http://api.apigee.com/wadl/2010/07/ http://apigee.com/schemas/apigee-wadl-extensions.xsd");

var resources = app.ele('resources');
resources.att('base', config.baseurl);


function getLatestRevisions(oldctx,odp){
	if ( !oldctx.index)
		oldctx.index=0;
	var p = proxy.getRevisions (org,oldctx.message[oldctx.index]);
	p.then (function(ctx){
		console.log(ctx);
		var dp = q.defer();
		dp.promise.then(function(ctx){
			oldctx.index++;
			if ( oldctx.index < oldctx.message.length)
				getLatestRevisions(oldctx,odp);
			else{
				odp.resolve({message: 'All Revisions Loaded'});
				app.end({ pretty: true});
				console.log(app.toString());
				fs.writeFile(org + '.wadl' , app.toString(), function(err){
					if(err) console.log('writing to wadl failed');
				});
			}
		});
		download ( oldctx.message[oldctx.index], ctx.message[ctx.message.length-1],dp);
		return dp.promise;
	});
}


function download (api, rev, dp){
	var p = proxy.download(org,api,rev);
	p.then (function(ctx){

		var policyDp = q.defer();
		policyDp.promise.then(function(){
			getProxyEndpoints (api,dp);
		});
		loadPolicies(api,policyDp);
	});
}


exports.loadProxy = function(o,api){
	tests=[];
	params=[];
	policyParams={};
	org = o;
	var policyDp = q.defer();
	var proxyDp = q.defer();
	policyDp.promise.then(function(){
		getProxyEndpoints (api, proxyDp);
	});
	loadPolicies(api,policyDp);
	return proxyDp.promise;
}

//exports.loadProxy('mukundha1','weather');

function getProxyEndpoints (api, dp){
	var p = proxy.getProxyEndpoints(org,api);
	p.then (function(ctx){

		var proxyEndpointDp = q.defer();
		var proxyEndpoints = ctx.message ;
		//console.log(proxyEndpoints);
		getProxyEndpoint (0,api,proxyEndpoints,proxyEndpointDp);

		//All Proxy Endpoints Loaded
		proxyEndpointDp.promise.then(function(){
			console.log(tests.length);
			//saveentity.save(tests);
			dp.resolve(ctx);
		});

	});
}

function getProxyEndpoint (index,api,proxyEndpoints,dp){

	var p = proxy.getProxyEndpoint (org,api,proxyEndpoints[index]);
	p.then(function(ctx){
		try{
		listPoliciesForFlows(ctx.message,api);
		}catch(err){
			console.log(err);
		}
		index ++ ;
		if ( index < proxyEndpoints.length)
			getProxyEndpoint(index,api,rev,proxyEndpoints,dp);
		else
			dp.resolve({message: 'All Proxy Endpoints for ' + api +'Read'});
	});
}


function listPoliciesForFlows (proxyEndpoint,api){
	console.log('list policies for flow');
	var basepath = proxyEndpoint.HTTPProxyConnection.BasePath;
	var str = JSON.stringify(proxyEndpoint);
	loadParam(api,str);

	var query = [] ;
	var header = [] ;
	if ( policyParams[api] ){
				var par = policyParams[api];
				for( var k=0;k<par.length;k++){
					var val = par[k].split('.')[2] ;
					if ( par[k].indexOf('queryparam') >0 && query.indexOf(val) <0 ) {
						query.push( val);
					}else if (par[k].indexOf('header') >0 && header.indexOf(val)<0){
						header.push(val);
					}
				}
	}

		var steps = [] ;
		if ( proxyEndpoint.PreFlow.Request && proxyEndpoint.PreFlow.Request.Step )
			steps = steps.concat (proxyEndpoint.PreFlow.Request.Step);
		if (proxyEndpoint.PreFlow.Response && proxyEndpoint.PreFlow.Response.Step)
			steps = steps.concat (proxyEndpoint.PreFlow.Response.Step);
		if(proxyEndpoint.PostFlow.Request && proxyEndpoint.PostFlow.Request.Step)
			steps = steps.concat (proxyEndpoint.PostFlow.Request.Step);
		if ( proxyEndpoint.PostFlow.Response && proxyEndpoint.PostFlow.Response.Step)
			steps = steps.concat (proxyEndpoint.PostFlow.Response.Step);


	verb = "GET";
	if ( proxyEndpoint.Flows.Flow.length == 0 ){
		//only one resource for this proxyendpoint
		var resource = resources.ele('resource' , {path: basepath});

		var methodElement = resource.ele('method', {name: verb , 'apigee:displayName':api}) ;

		methodElement.ele('apigee:tags').ele('apigee:tag',{primary:true},api);

		if ( verb == 'POST' || verb == 'PUT')
		{
			var reqElement = methodElement.ele('request');
			reqElement.ele('param' , { name: 'Content-Type' , required: 'true' , style : 'header'});
			reqElement.ele('representation').ele('apigee:payload').ele('apigee:content','Message Body');
		}

		for(var k=0;k<query.length;k++){
			resource.ele('param' , {name: query[k] , style:'query'} );
		}
		for(var k=0;k<header.length;k++){
			resource.ele('param' , {name: header[k] , style:'header'} );
		}
		for(var j = 0 ; j < steps.length ; j ++ ){

			if ( policyParams[steps[j].Name] ){
				var par = policyParams[steps[j].Name];
				for( var k=0;k<par.length;k++){
					var val = par[k].split('.')[2] ;
					if ( par[k].indexOf('queryparam') >0 && query.indexOf(val) <0 ) {
						query.push( val);
					}else if ( par[k].indexOf('header')>0 && header.indexOf(val)<0){
						header.push(val);
					}
				}
			}
		}
		var jmx = { org:org , api:api, name: api+basepath, host: org+'-test.apigee.net' , port: 80 , path : basepath, scheme: config.scheme, verb: verb , queryParams: query , pathParams : [], headers : header} ;
		tests.push(jmx);
		//jmeter.generateJmx(jmx);
		//apib.generateApibModel(jmx);
	}
	console.log(str);
	for(var i = 0; i < proxyEndpoint.Flows.Flow.length ; i ++ ){

		var flowQuery = [] ;
		var flowHeader = [] ;
		flowQuery = flowQuery.concat(query);
		flowHeader = flowHeader.concat(header);

		//This is one resource
		var flowSteps = [] ;
		flowSteps = flowSteps.concat(steps);
		var flow = proxyEndpoint.Flows.Flow[i];
		var flowName = flow.$.name;
		if ( flow.Request && flow.Request.Step)
		flowSteps = flowSteps.concat (flow.Request.Step);
		if ( flow.Response && flow.Response.Step)
		flowSteps = flowSteps.concat (flow.Response.Step);

		for(var j = 0 ; j < flowSteps.length ; j ++ ){

			if ( policyParams[flowSteps[j].Name] ){
				var par = policyParams[flowSteps[j].Name];
				for( var k=0;k<par.length;k++){
					var val = par[k].split('.')[2] ;
					if ( par[k].indexOf('queryparam') >0 && flowQuery.indexOf(val) <0 ) {
						flowQuery.push( val);
					}else if ( par[k].indexOf('header')>0 && flowHeader.indexOf(val)<0){
						flowHeader.push(val);
					}
				}
			}
		}
		console.log(flowQuery);
		console.log(query);
		var pathsuffix = '';var verb = '' ;
		if ( flow.Condition){
			if ( flow.Condition.indexOf('proxy.pathsuffix') >=0 ){
				var x1 =  flow.Condition.split("proxy.pathsuffix MatchesPath")[1];
				pathsuffix = x1.split("\"")[1];
			}
			if ( flow.Condition.indexOf('request.verb') >=0 ){
				var x1 =  flow.Condition.split("request.verb")[1];
				verb = x1.split("\"")[1];
			}
		}
		var testpath = basepath + pathsuffix ;
		var splits = testpath.split('*');
		var finalPath = '' ;
		var wadlFinalPath = '' ;
		var pathParams = [] ;
		console.log(testpath + " " + splits.length);
		if ( splits.length == 1 ){
			finalPath = testpath;
			wadlFinalPath=testpath;
		}
		else
		{
			for(var w=0;w<splits.length-1 ; w ++ ){
				var par = '${param' + w + '}';
				finalPath += splits[w] + par;
				wadlFinalPath += splits[w] + '{param' + w + '}';
				pathParams.push('param' + w);
			}
			finalPath += splits[splits.length-1] ;
			wadlFinalPath += splits[splits.length-1] ;
		}

		var resource = resources.ele('resource' , {path: wadlFinalPath});
		var methodElement = resource.ele('method', {name: verb , 'apigee:displayName':flowName}) ;

		methodElement.ele('apigee:tags').ele('apigee:tag',{primary:true},api);

		if ( verb == 'POST' || verb == 'PUT')
		{
			var reqElement = methodElement.ele('request');
			reqElement.ele('param' , { name: 'Content-Type' , required: 'true' , style : 'header'});
			reqElement.ele('representation').ele('apigee:payload').ele('apigee:content').dat('Message Body');
		}
		for(var k=0;k<flowQuery.length;k++){
			resource.ele('param' , {name: flowQuery[k] , style:'query'} );
		}
		for(var k=0;k<flowHeader.length;k++){
			resource.ele('param' , {name: flowHeader[k] , style:'header'} );
		}
		for(var k=0;k<pathParams.length;k++){
			resource.ele('param' , {name: pathParams[k] , style:'template'} );
		}

		addTest(org,api,flowName,org + '-test.apigee.net',80,finalPath,config.scheme,verb,flowQuery,pathParams,flowHeader);

		//jmeter.generateJmx(jmx);
		//apib.generateApibModel(jmx);
	}


}

function addTest(org,api,name,host,port,path,scheme,verb,qparams,pparams,headers){
	var jmx = { org: org, api:api, name: name, host: host , port: port , path : path, scheme: scheme, verb: verb , queryParams: qparams , pathParams : pparams, headers : headers} ;
	tests.push(jmx);
	console.log(jmx);
}

function loadAllPolicies(index, api, policies , policyDp){
	console.log(policies);
	var p = proxy.getPolicy( org, api, policies[index] );
	p.then(function(ctx){
		loadParam(policies[index],JSON.stringify(ctx.message));
		index++;
		if (index<policies.length)
			loadAllPolicies(index,api,policies,policyDp);
		else{
			policyDp.resolve({});
		}
	});
}

function loadParam (policyName,str) {
	//console.log( "loading policy ");
	//console.log(policyName);
	//console.log(str);
	var check = ['request.queryparam.' , 'request.header.'];

	try{
		for(var i =0; i <check.length; i ++ )
		{
			var tempIndex = 0;
			while( str.indexOf(check[i],tempIndex)>=0) {
				var temp=str.indexOf(check[i],tempIndex);

				var delimiters = [' ', '=' , ')' , '>' ,'<' ,'}' , '%' ,':','"',"'"];
				var indexes = [] ;
				for(var j=0;j<delimiters.length;j++){
					indexes[j]=str.indexOf(delimiters[j],temp);
				}
				indexes.sort(function(a,b){return a-b;});
				var c=0;
				do{
					f=indexes[c];
					c++;
				}while(f<0) ;


				var queryParam = str.substring(temp, f);

				if ( !policyParams[policyName]){
					policyParams[policyName]=[];
				}

				if ( policyParams[policyName].indexOf(queryParam) < 0){
					policyParams[policyName].push(queryParam);
				}
				tempIndex=temp+1;
			}
		}


		var policyJson = JSON.parse(str)

		//Read Query and Header from Extract Variables Policy
		if(policyJson.QueryParam){

			for(i=0;i<policyJson.QueryParam.length;i++){
				var p = policyJson.QueryParam[i];
				var pname = 'request.queryparam.' + p.$.name
				if ( !policyParams[policyName]){
					policyParams[policyName]=[];
				}

				if ( policyParams[policyName].indexOf(pname) < 0){
					policyParams[policyName].push(pname);
				}
			}
		}

		if(policyJson.Header){

			for(i=0;i<policyJson.Header.length;i++){
				var p = policyJson.Header[i];
				var pname = 'request.header.' + p.$.name
				if ( !policyParams[policyName]){
					policyParams[policyName]=[];
				}

				if ( policyParams[policyName].indexOf(pname) < 0){
					policyParams[policyName].push(pname);
				}
			}
		}
	}catch(err){
		console.log(err);
	}

}


function loadPolicies (api,dp){
	console.log('loading policies');
	var p = proxy.getPolicies(org,api);
	p.then(function(policies){
		console.log(policies);
		var policyDp = q.defer();
		if ( policies.message.length == 0 ){
			policyDp.resolve();
		}else{
			loadAllPolicies(0,api,policies.message,policyDp);
		}
		policyDp.promise.then(function(){
			dp.resolve({});
		});
	});
}
