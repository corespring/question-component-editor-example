function Items(collection){
  this.listByUsername = function(username, done){
    collection.find({username: username}, function(err, items){
      items.toArray(function(err, arr){
        done(err, arr);
      });
    });
  };
}

module.exports = Items;

