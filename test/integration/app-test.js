var st = require('supertest');
var should = require('should');
var _ = require('lodash');
var http = require('http');
var debug = require('debug')('integration-test');
var request = require('supertest');
var MongoClient = require('mongodb').MongoClient;
var config = require('config');
var fs = require('fs');
var path = require('path');
var Promise = require('bluebird');
var AWS = require('aws-sdk');
AWS.config.region = config.has('AWS_REGION') ? config.get('AWS_REGION') : 'us-east-1';
var connect = Promise.promisify(MongoClient.connect);
var uri = config.get('MONGO_URI');
var user = {username: 'test', password: 'test'};
var server, app;

describe('app', () => { 
  
  "use strict";

  let dropCollections = (db) => {
    return new Promise(function(resolve, reject){
      debug('dropCollections....');
      db.collection('users').drop();
      db.collection('items').drop();
      resolve(db);
    });
  };

  let addTestUser = (db) => {
    return new Promise(function(resolve, reject){
      debug('add test user...');
      db.collection('users').insertOne(user, function(err, r){
        if(err){
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  };

  let createBucket = () => {
    return new Promise( function(resolve, reject) {
      debug('create bucket...');
      var bucket = config.get('LAUNCH_EXAMPLE_BUCKET');
      debug('bucket: ', config.get('LAUNCH_EXAMPLE_BUCKET'));
      var s3 = new AWS.S3({params: {Bucket: bucket}});
      s3.createBucket(function(err) {
        if (err) { reject(err); }
        else {
          resolve();
        }
      });
    });
  };

  let deleteBucket = () => {
      debug('delete bucket...');
      var bucket = config.get('LAUNCH_EXAMPLE_BUCKET');
      var params = {Bucket: bucket};
      debug('bucket: ', config.get('LAUNCH_EXAMPLE_BUCKET'));
      var s3 = new AWS.S3({params: params}); 
      Promise.promisifyAll(Object.getPrototypeOf(s3));

      function list(params) { 
        return new Promise(function(resolve, reject){ 
          s3.listObjects(params, function(err, result){
            if(err){
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      }

      var deletePromise = Promise.promisify(s3.deleteBucket);

      let deleteAll = (listResult) => {
        return new Promise(function(resolve, reject){

          if(listResult.Contents.length === 0){
            resolve();
          } else {
            var deleteParams = {Bucket: bucket, Delete : {Objects:[]}};

            listResult.Contents.forEach(function(content) {
              deleteParams.Delete.Objects.push({Key: content.Key});
            });
            debug('delete objects...', JSON.stringify(deleteParams));

            s3.deleteObjects(deleteParams, function(err, data) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          }
        });
      };

      return list({Bucket: bucket})
        .then(deleteAll)
        .then(function() { return s3.deleteBucketAsync(params); });
  };

  let disconnect = (db) => {
    return new Promise(function(resolve){
      debug('disconnect...');
      db.close();
      resolve();
    });
  };

  let bootServer = () => {
    return new Promise((resolve, reject) => {
      debug('boot server...');
      app = require('../../app');
      server = http.createServer(app);
      server.on('error', reject);
      server.on('listening', function(){
        debug('server listening...');
        var addr = server.address();
        var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
        debug('Listening on ' + bind);
        //Give the app some time to boot up...
        setTimeout(resolve, 1000); 
      });
      server.listen(5412);
    });
  };

  before((done) => {

    if(process.env.NODE_ENV !== 'test'){
      done(new Error('You have to run the tests with NODE_ENV set to \'test\''));
    } else {
      connect(uri)
        .then(dropCollections)
        .then(addTestUser)
        .then(disconnect)
        .then(createBucket)
        .then(bootServer)
        .then(done)
        .catch(function(err){
          debug('error: ', err);
          done(err);
        });
    }
  });

  after((done) => {
    deleteBucket()
      .then(() => { done(); })
      .catch((e) => { done(new Error(e)); });
  });

  describe('GET /', () => {
    it('302 -> /login', (done) => {
      request(server)
        .get('/')
        .expect(302)
        .expect('location', '/login', done);
    });
  });

  describe('assets', () => {

    var cookie, itemId, fileData;

    before((done) => {

      fileData = fs.readFileSync(path.resolve(__dirname + '/puppy.png'));

      request(server)
        .post('/login')
        .type('form')
        .send(user) 
        .expect('location', '/items')
        .end(function(err, res){
          if(err){
            done(err);
          } else {
            debug(res.headers);
            cookie = res.headers['set-cookie'];
            debug('cookie: %s', cookie);
            request(server)
              .post('/items')
              .set('cookie', cookie)
              .send({name: 'test-item'})
              .expect(302)
              .end(function(err, res){
                itemId = res.headers.location.replace('/items/', '');
                debug('itemId: ', itemId);
                done(err);
              });
          }
        });
    });

    
    let upload = () => {
      return request(server)
        .post('/items/' + itemId)
        .set('cookie', cookie)
        .type('form')
        .attach('file', path.resolve(__dirname + '/puppy.png'))
        .field('filename', 'puppy.png');
    };

    let  get= (fullUrl) => {
      debug('load new asset: ', fullUrl);
      var trimmed = fullUrl.replace(/^http:\/\/.*?\//, '/');
      debug('trimmed: ', trimmed);
      return request(server)
        .get(trimmed)
        .set('cookie', cookie);
    };

    let deleteAsset = (fullUrl) => {
      debug('delete asset: ', fullUrl);
      var trimmed = fullUrl.replace(/^http:\/\/.*?\//, '/');
      debug('trimmed: ', trimmed);
      return request(server)
        .del(trimmed)
        .set('cookie', cookie);
    };
    
    it('has an item', () => {
      debug('itemId: %s', itemId);
      should.exist(itemId);
    });

    it('POST /items/:id allows image upload', (done) => {
      upload().expect(201, done);
    });

    it('GET /items/:id/:filename allows image retrieval', (done) => {

      upload()
        .expect(201)
        .end((err, res) => {
          if(err || !res.body.url){
            done(err);
          } else {
            get(res.body.url)
              .expect(200)
              .end(function(err, res){
                debug(res.body);
                debug(res.headers);
                done();
              });
          }
        });
    });
    
    it('DELETE /items/:id deletes image', (done) => {

      upload()
        .expect(201)
        .end((err, res) => {
          var newUrl = res.body.url;
          deleteAsset(newUrl)
            .end((err, res) => {
              get(newUrl).expect(404, done);
            });
        });
    });

  });

});
