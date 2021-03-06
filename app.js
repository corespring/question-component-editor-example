var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var Index = require('./routes/index');
var Users = require('./services/users');
var Items = require('./services/items');
var app = express();
var session = require('express-session');
var config = require('config');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

//CORS middleware
var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', config.get('COMPONENT_EDITOR_HOST'));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
};


var uri = config.get('MONGO_URI');

MongoClient.connect(uri, function(err, db) {

  assert.equal(null, err);
  console.log('Connected correctly to server');

  var users = new Users(db.collection('users'));
  var items = new Items(db.collection('items'));

  var indexRoutes = new Index(users, items);

  app.use(logger('dev'));
  app.use(bodyParser.json({limit: '10mb'}));
  app.use(bodyParser.raw({limit: '10mb'}));
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(session({secret:'keyboard cat', resave: false, saveUninitialized: false}));
  app.use(allowCrossDomain);
  app.set('view engine', 'jade');
  app.use('/', indexRoutes);

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  app.use(function(err, req, res, next) {
    console.log('Error: ',err);
    res.status(err.status || 500);
    res.json(err);
  });
});

module.exports = app;
