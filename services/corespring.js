var request = require('superagent');
var debug = require('debug')('corespring');

function AccessToken(host, clientId, clientSecret){

  var existingToken = null;

  this.create = () => {
    return new Promise((resolve, reject) => {
      var url = host + '/auth/access_token';
      
      debug('create: url: ', url, 'clientId: ', clientId, 'clientSecret: ', clientSecret);

      request
        .post(url)
        .type('form')
        .send({
          client_id: clientId,
          client_secret: clientSecret
        })
        .set('Accept', 'application/json')
        .end(function(err, res) {
          if (err) {
            debug('create, err: ', err);
            debug('create, err: ', err.response.text);
            reject(err.response.text);
          } else {
            debug('create, body: ', res.body);
            if (res.body.access_token) {
              existingToken = res.body.access_token;
              resolve(res.body.access_token);
            } else {
              reject('err: ' + res.body);
            }
          }
        });
    });
  };
}

function PlayerToken(host){
  
  this.createAccessAnythingToken = (accessToken) => {
    return new Promise((resolve, reject) => {

      var url = host + '/api/v2/player-token?access_token=' + accessToken;
      
      debug('createAccessAnythingToken, url: ', url);

      request
        .post(url)
        .send({
          expires: 0
        })
        .set('Accept', 'application/json')
        .end((err, res) => {
          if (err) {
            debug('createAccessAnythingToken, err: ', err);
            reject(err);
          } else {
            debug('createAccessAnythingToken, res.body: ', res.body);
            if (res.body.playerToken && res.body.apiClient) {
              resolve(res.body);
            } else {
              reject('err: ' + res.body);
            }
          }
        });
    });
  };
}

function CoreSpring(host, clientId, clientSecret){
  this.accessToken = new AccessToken(host, clientId, clientSecret);
  this.playerToken = new PlayerToken(host);
}

exports.createPlayerTokenFromUser = (host, user) => {

  if(!user.clientId || !user.clientSecret){
    return new Promise((resolve, reject) => {
      reject('User must have clientId and clientSecret defined');
    });
  } else {
    var corespring = new CoreSpring(host, user.clientId, user.clientSecret);
    return corespring.accessToken.create()
      .then(corespring.playerToken.createAccessAnythingToken);
  }
};
