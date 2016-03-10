var express = require('express');
var passport = require('passport');
var config = require('config');
var router = express.Router();
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var knox = require('knox');
var mime = require('mime');
var streamingS3 = require('streaming-s3');
var properties = require ('properties');
var debug = require('debug')('app:routes');
var fs = require('fs');

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

function loadKeySecret(){
  var bucket = process.env.LAUNCH_EXAMPLE_BUCKET || 'component-editor-launch-examples';
  var propsString;
  var props;
  try{ 
    propsString = fs.readFileSync( getUserHome() + '/.aws/credentials', {encoding: 'utf8'}); 
    debug(propsString);
    props = properties.parse(propsString);
  } catch(e){
    debug(e);
    props = {};
  }

  debug(props);
  return {
    bucket: bucket,
    key: process.env.AWS_ACCESS_KEY_ID || props.aws_access_key_id,
    secret: process.env.AWS_SECRET_ACCESS_KEY || props.aws_secret_access_key
  };
}

var s3Opts = loadKeySecret();

var bucket = s3Opts.bucket;
var key = s3Opts.key;
var secret = s3Opts.secret;

debug(s3Opts);

var client = knox.createClient({
  key: key,
  secret: secret,
  bucket: bucket
});

  
var url = require('url');

function mkUrl(req, path){
  var protocol = req.get('X-Forwarded-Protocol') ? req.get('X-Forwarded-Protocol') : 'http';
  var host = req.get('host');
  return url.format({
    protocol: protocol,
    host: host,
    pathname: path
  });
}

function addFullUrl(req, res, next){
  req.fullUrl = mkUrl(req, req.originalUrl);
  next();
}

router.get('/', function(req, res){
  res.redirect('/login');
});


function restrict(onFail, req, res, next) {
  console.log('Session:', req.session);
  if (req.session.user) {
    next();
  } else {
    onFail(req, res);
  }
}

var backToLogin = restrict.bind(this, function(req, res){
  req.session.error = 'Access denied!';
  res.redirect('/login');
});

var returnUnauthorized = restrict.bind(this, function(req, res){
  res.status(401).send('Not allowed');
});

router.get('/component-editor', backToLogin, function(req, res){

  var url = config.get('COMPONENT_EDITOR_URL');

  res.render('component-editor', {
    componentEditorUrl: url,
    uploadUrl: mkUrl(req, '/image/:filename'),
    uploadMethod: 'POST'
  });
});

router.get('/login', function(req, res){
  res.render('login');
});

router.post('/login', function(req, res){
  if(req.param('username') === config.get('USERNAME') && 
    req.param('password') === config.get('PASSWORD')){
    req.session.regenerate(function(){
        req.session.user = {username: 'ed'};
        res.redirect('/component-editor');
      });
  } else {
    res.redirect('/login');
  }
});

router.get('/ping', returnUnauthorized, function(req, res, next){
  res.send('pong');
});

router.post('/image/:filename', returnUnauthorized, addFullUrl, function(req, res, next) {

  var mimeType = mime.lookup(req.params.filename);     

  var key = encodeURIComponent(req.params.filename);
  var s3Params = {Bucket: bucket, Key: key, ContentType: mimeType, ContentLength: req.body.length};
  
  debug('s3Params: ', s3Params);
  
  var s3obj = new AWS.S3({params: s3Params});

  s3obj
    .upload({Body: req.body})
    .on('httpUploadProgress', function(evt) { 
      debug(evt); 
    })
    .send(function(err, data) { 
      debug(err, data);
      res.send(req.fullUrl); 
    });
});

router.get('/image/:filename', returnUnauthorized, function(req, res, next) {
  var key = encodeURIComponent(req.params.filename);
  debug('get key:', key);
  client.getFile( '/' + key, function(err, s3res){
    debug(err, s3res);
    if(err){
      res.status(404).send();
    } else {
      s3res.pipe(res);
    }
  });
});

router.delete('/image/:filename', returnUnauthorized, function(req, res, next) {

  var key = encodeURIComponent(req.params.filename);
  debug('delete key:', key);
  client.deleteFile('/' + key, function(err){
    debug(err);
    if(err){
      res.status(404).send();
    } else {
      res.status(200).send();
    }
  });

});

module.exports = router;
