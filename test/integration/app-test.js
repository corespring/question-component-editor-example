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

var server, app;

var uri = config.get('MONGO_URI');

var user = {username: 'test', password: 'test'};

describe('app', function(){

  function clearDB(done){
    MongoClient.connect(uri, function(err, db) {

      db.collection('users').drop();
      db.collection('items').drop();
      db.close();
      done();
    });
  }

  function addTestUser(done){
    clearDB(function(){
      MongoClient.connect(uri, function(err, db) {
        db.collection('users').insertOne(user, function(err, r){
          db.close();
          done(err);
        });
      });
    });
  }
  
  function removeTestUser(done){
    MongoClient.connect(uri, function(err, db) {
      db.collection('users').remove({username: user.username}, function(err, r){
        db.close();
        done(err);
      });
    });
  }

  before(function(done){

    this.timeout(5000);

    function onError(error) {
      throw error;
    }

    function onListening() {
      var addr = server.address();
      var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
      console.log('Listening on ' + bind);
      debug('Listening on ' + bind);
      //Give the app some time to boot up...
      setTimeout(done, 1000);
    }

    if(process.env.NODE_ENV !== 'test'){
      done(new Error('You have to run the tests with NODE_ENV set to \'test\''));
    } else {
      addTestUser(function(err){
        if(err){
          done(err);
        } else {
          app = require('../../app');
          server = http.createServer(app);
          server.on('error', onError);
          server.on('listening', onListening);
          server.listen(5412);
        }
      });
    }
  });

  describe('GET /', function(){
    it('302 -> /login', function(done){
      request(server)
        .get('/')
        .expect(302)
        .expect('location', '/login', done);
    });
  });

  describe('assets', function(){

    var cookie, itemId, fileData;

    before(function(done){

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

    
    function upload(){
      return request(server)
        .post('/items/' + itemId)
        .set('cookie', cookie)
        .type('form')
        .attach('file', path.resolve(__dirname + '/puppy.png'))
        .field('filename', 'puppy.png');
    } 

    function get(fullUrl){
      debug('load new asset: ', fullUrl);
      var trimmed = fullUrl.replace(/^http:\/\/.*?\//, '/');
      debug('trimmed: ', trimmed);
      return request(server)
        .get(trimmed)
        .set('cookie', cookie);
    }

    function deleteAsset(fullUrl){
      debug('delete asset: ', fullUrl);
      var trimmed = fullUrl.replace(/^http:\/\/.*?\//, '/');
      debug('trimmed: ', trimmed);
      return request(server)
        .del(trimmed)
        .set('cookie', cookie);
    }
    
    it('has an item', function(){
      debug('itemId: %s', itemId);
      should.exist(itemId);
    });

    it('POST /items/:id allows image upload', function(done){
      upload().expect(201, done);
    });

    it('GET /items/:id allows image retrieval', function(done){
      upload()
        .end(function(err, res){
          get(res.body.url)
            .expect(200, done);
        });
    });
    
    it('DELETE /items/:id deletes image', function(done){

      this.timeout(4000);
      
      upload()
        .end(function(err, res){
          var newUrl = res.body.url;
          deleteAsset(newUrl)
            .end(function(err, res){
              get(newUrl).expect(404, done);
            });
        });
    });

  });

});
