
function Users(collection){

  this.find = function(username, done){
    collection.findOne({username: username}, function(err, user){
      done(err, user);
    });
  };
}

module.exports = Users;

