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
var sessionDebug = require('debug')('app:session');
var fs = require('fs');
var multer = require('multer');
var upload = multer({});

function Index(users, items){

  function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  }

  function loadKeySecret(){
    var bucket = config.get('LAUNCH_EXAMPLE_BUCKET'); 
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
    sessionDebug('Session: %s', JSON.stringify(req.session));
    if (req.session.user) {
      next();
    } else {
      sessionDebug('failed to find user in session');
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

  router.get('/login', function(req, res){
    res.render('login');
  });

  router.post('/login', function(req, res){

    users.find(req.body.username, function(err, user){
      if(err){
        res.redirect('/login');
      } else {
        if(!user){
          res.redirect('/login');
        } else {
          //plain text password - do not use in production
          if(user.password === req.body.password){
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
        var componentEditorUrl = config.get('COMPONENT_EDITOR_JS_URL');

        debug('item.xhtml', item.xhtml);
        item.xhtml = item.xhtml ? item.xhtml.replace(/(?:\r\n|\r|\n)/g, '<br />') : undefined;

        var opts =  {
          item: item, 
          uploadUrl: mkUrl(req, '/items/' + item._id.toHexString()),
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

    debug('create... user: ', req.session.user);
    items.create(req.session.user.username, req.body.name, function(err, id){
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

  router.post('/items/:id', 
    returnUnauthorized, 
    addFullUrl, 
    upload.single('file'), 
    function(req, res, next) {

    debug('params: ', req.params);
    debug('file: ', req.file);
    debug('body: ', req.body);
    var filename = req.file.originalname;

    var mimeType = mime.lookup(filename);     

    var key = assetKey(req.params.id,  new Date().getTime() + '-' + filename); 

    debug('key: ', key);
    debug('filename', filename);

    var s3Params = {Bucket: bucket, Key: key, ContentType: mimeType, ContentLength: req.file.size};
    
    debug('s3Params: ', s3Params);
    
    var s3obj = new AWS.S3({params: s3Params});

    s3obj
      .upload({Body: req.file.buffer})
      .on('httpUploadProgress', function(evt) { 
        debug(evt); 
      })
      .send(function(err, data) { 
        if(err){
          debug('s3 send complete for key: ' + key, err);
          res.status(400).send(); 
        } else {
          var returnUrl = mkUrl(req, '/items/' + key); 
          debug('returnUrl: ', returnUrl);
          res.status(201).send({ url: returnUrl}); 
        }
      });
  });

  router.get('/items/:id/:filename', returnUnauthorized, function(req, res, next) {
    var key = assetKey(req.params.id, req.params.filename); 

    /** 
     * Note: knox won't return an error of the file doesn't exist in getfile
     * so you can't just pipe from getFile or you'll get a 200 and an 
     * s3 xml error with 'No Such Key' in it.
     * So have to headFile first the getFile - a bit cumbersome.
     */

    client.headFile('/' + key, function(err, h){
      debug('headFile: ', err);
      if(err || h.statusCode === 404){
        res.status(404).send();
      } else {
        client.getFile( '/' + key, function(err, s3res){
          debug('GET: s3 key:', key);
          debug('GET: originalUrl ' + req.originalUrl + ' err: ' + err);
          if(err){
            res.status(404).send();
          } else {
            s3res.pipe(res);
          }
        });
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
