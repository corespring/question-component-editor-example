var ObjectID = require('mongodb').ObjectID;
var debug = require('debug')('items');

function Items(collection){
  this.listByUsername = function(username, done){
    debug('listByUsername: ' , username);

    collection.find({username: username}, function(err, items){
      items.toArray(function(err, arr){
        done(err, arr);
      });
    });
  };

  this.load = function(id, done) {
    collection.findOne({_id: ObjectID.createFromHexString(id)}, function(err, item){
      done(err, item);
    });
  };

  this.create = function(username, name, done){
    collection.insertOne({username: username, name: name}, function(err, result){
      done(err, result.insertedId.toHexString());
    });
  };

  this.update = function(id, data, done){

    var update = {
      $set: {
        xhtml: data.xhtml,
        componentModel: data.componentModel
      }
    };

    collection.update({_id: ObjectID.createFromHexString(id)}, update, function(err, res){
      debug('err: %s', err);
      debug('res: %s', res);
      done(err);
    });
  };
}

module.exports = Items;

