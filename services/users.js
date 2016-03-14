var debug = require('debug')('users');

function Users(collection){

  this.find = function(username, done){
    collection.findOne({username: username}, function(err, user){
      done(err, user);
    });
  };

  this.update = (username, data, done) => {
    if(!username){
      done('new username defined');
      return;
    } else {
      collection.findAndModify(
        {username: username},
        [['_id','asc']],   
        {$set: data}, 
        {new: true}, 
        (err, doc) => {
          if(err){
            done(err);
          } else {
            debug('update, doc:', doc);
            done(null, doc.value);
          }
      });
    }
  };
}

module.exports = Users;

