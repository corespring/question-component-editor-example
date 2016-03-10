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

function Index(users, items){

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
    debug('Session: %s', JSON.stringify(req.session));
    if (req.session.user) {
      next();
    } else {
      debug('failed to find user in session');
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

    users.find(req.param('username'), function(err, user){
      if(err){
        res.redirect('/login');
      } else {
        if(!user){
          res.redirect('/login');
        } else {
          //plain text password - do not use in production
          if(user.password === req.param('password')){
            req.session.user = user;
            res.redirect('/items');
          } else {
            res.redirect('/login');
          }
        }
      }
    });
  });

  router.get('/items/:id', backToLogin, function(req, res, next){
    debug(req.params);
    items.load(req.params.id, function(err, item){
      if(err){
        res.status(404).send('error loading: ' + err);
      } else {
        var componentEditorUrl = config.get('COMPONENT_EDITOR_URL');

        item.xhtml = item.xhtml.replace(/(?:\r\n|\r|\n)/g, '<br />');

        var opts =  {
          item: item, 
          uploadUrl: mkUrl(req, '/items/' + item._id.toHexString() + '/:filename'),
          uploadMethod: 'POST',
          componentEditorUrl:componentEditorUrl,
          saveUrl: '/items/:id' 
        };
        res.render('item', opts); 
      }
    });
  });

  router.put('/items/:id', returnUnauthorized, function(req, res, next){
    items.update(req.params.id, req.body, function(err){
      // debug('item body: %s', req.body);
      if(err){
        res.status(400).send(err);
      } else {
        res.status(200).send({});
      }
    });
  });

  router.post('/items', returnUnauthorized, function(req, res, next){
    items.create(req.session.user.username, req.param('name'), function(err, id){
      if(err){
        res.status(400).send('create failed: ', err);
      } else {
        res.redirect('/items/' + id);
      }
    });
  });

  router.get('/items', backToLogin, function(req, res, next){
    items.listByUsername(req.session.user.username, function(err, items){
      if(err){
        res.status(500).send(err);
      } else {
        res.render('my-items', {items: items});
      }
    });
  });

  function assetKey(id, name){
    return encodeURIComponent(id) + '/' + encodeURIComponent(name);
  }

  router.post('/items/:id/:filename', returnUnauthorized, addFullUrl, function(req, res, next) {

    var mimeType = mime.lookup(req.params.filename);     

    var key = assetKey(req.params.id, req.params.filename); 

    debug('key: ', key);

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

  router.get('/items/:id/:filename', returnUnauthorized, function(req, res, next) {
    var key = assetKey(req.params.id, req.params.filename); 
    debug('get key:', key);
    client.getFile( '/' + key, function(err, s3res){
      debug('get ' + req.originalUrl + ' err: ' + err);
      if(err){
        res.status(404).send();
      } else {
        s3res.pipe(res);
      }
    });
  });

  router.delete('/items/:id/:filename', returnUnauthorized, function(req, res, next) {

    var key = assetKey(req.params.id, req.params.filename); 
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

  return router;
}

module.exports = Index;
