

import express from 'express';
import { fromExpress } from 'webtask-tools';
import bodyParser from 'body-parser';
const rp = require('request-promise');
const {google} = require('googleapis');
const app = express();

// app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const jwksRsa = require('jwks-rsa');
const ejwt = require('express-jwt');
const jwt = require('jsonwebtoken');
const Boom = require('boom');
const request = require('request');

const URL_GENKEY = 'YOUR_URL_GENKEY';
const URL_ENCRYPT = 'YOUR_URL_ENCRYPT';

var Auth0 = {
  __settings: {
    auth0_domain_key: 'AUTH0_DOMAIN',
    client_id_key: 'API_CLIENT_ID',
    client_secret_key: 'API_CLIENT_SECRET'
  },
  __contextStorage: undefined,
  __loadStorageContext: (req, next) => { 
    return req.webtaskContext.storage.get((err, data) => {
      if (err) return next(err);

      Auth0.__contextStorage = data;

      next(null, data);
    }); 
  },
  __storeContextStorage: (req, next) => { 
    return req.webtaskContext.storage.set(Auth0.__contextStorage, next); 
  },
  __getProfile: function(cacheIdentities, req, res, next){
    const options = {
      url: `https://${req.webtaskContext.secrets[Auth0.__settings.auth0_domain_key]}/api/v2/users/${req.user.user_id}`,
      json: true,
      headers: {
        authorization: 'Bearer ' + req.access_token
      }
    };

    return request.get(options, (err, response, body) => {
      // console.log(err, response.statusCode);
      if (err) return next(Boom.wrap(err, 400));
      if (response.statusCode !== 200) return next(Boom.badRequest('Errror calling users API'));

      function done(){
        req.user = body;
        next();
      }

      if (cacheIdentities){
        if (!Auth0.__contextStorage) Auth0.__contextStorage = {};

        Auth0.__contextStorage[req.user.user_id] = body;
        return Auth0.__storeContextStorage(req, done);
      }

      done();
    });
  },
  overrideOptions: function(options){
    options = options || {};
    Auth0.__settings.auth0_domain_key = options.auth0_domain_key || Auth0.__settings.auth0_domain_key;
    Auth0.__settings.client_id_key = options.client_id_key || Auth0.__settings.client_id_key;
    Auth0.__settings.client_secret_key = options.client_secret_key || Auth0.__settings.client_secret_key;
    return Auth0;
  },
  getAccessToken: function(req, res, next) {
    var context = req.webtaskContext;
    if (!context.secrets[Auth0.__settings.client_id_key] || 
        !context.secrets[Auth0.__settings.auth0_domain_key]) {
       return next(Boom.badRequest('Missing required properties in settings')); 
    }

    Auth0.__loadStorageContext(req, (err, data) => {
      if (err) return next(Boom.wrap(err, 400));

      data = data || {};

      if (data.access_token && jwt.decode(data.access_token).exp > Date.now()){
        req.access_token = data.access_token;
        return next();
      }

      const options = {
        url: `https://${context.secrets[Auth0.__settings.auth0_domain_key]}/oauth/token`,
        json: {
          audience: `https://${context.secrets[Auth0.__settings.auth0_domain_key]}/api/v2/`,
          grant_type: 'client_credentials',
          client_id: context.secrets[Auth0.__settings.client_id_key],
          client_secret: context.secrets[Auth0.__settings.client_secret_key]
        }
      };

      return request.post(options, (err, response, body) => {
        if (err) return next(Boom.wrap(err, 400));
        if (response.statusCode !== 200) return next(Boom.badRequest('There was an error calling /oauth/token'));

        Auth0.__contextStorage = Auth0.__contextStorage || {};
        Auth0.__contextStorage.access_token = body.access_token;

        // Store token in context
        Auth0.__storeContextStorage(req, (err) => {
          req.access_token = body.access_token;
          next();
        });
      });
    });
  },
  ensureProfile: function(cacheIdentities){
    return function(req, res, next) {
      // console.log(req.user);
      req.user.user_id = req.user.sub;
      if (!req.user || !req.user.user_id) { 
        return next(Boom.unauthorized('Unable to get user profile')); 
      }

      function getAccessTokenAndProfile(req, res, next){
        return Auth0.getAccessToken(req, res, function(err){
          // console.log("err: ", err);
          if (err) return next(Boom.wrap(err, 400));
          // console.log("access_token (profile&Token): ", req.access_token);
          if (!req.access_token){
            return next(Boom.badRequest('There was an error getting APIv2 access token'));
          }

          return Auth0.__getProfile(cacheIdentities, req, res, next);
        });
      }

      function getProfile(req, res, next){
        // console.log("access_token (profileOnly): ", req.access_token);
        if (!req.access_token){
           return getAccessTokenAndProfile(req, res, next);
        }

        return Auth0.__getProfile(cacheIdentities, req, res, next);
      }

      if (cacheIdentities) {
        return Auth0.__loadStorageContext(req, (err) => {
          Auth0.__contextStorage = Auth0.__contextStorage || {};

          if (Auth0.__contextStorage[req.user.user_id]){
            req.user = Auth0.__contextStorage[req.user.user_id];
            return next();
          }

          getProfile(req, res, next);
        });
      }

      getProfile(req, res, next);
    };
  }
};

// all routes will check the JWT
/*app.use((req, res, next) => { 
  const issuer = 'https://' + req.webtaskContext.secrets.AUTH0_DOMAIN + '/';
  ejwt({
    secret: jwksRsa.expressJwtSecret({ jwksUri: issuer + '.well-known/jwks.json' }),
    audience: req.webtaskContext.secrets.AUDIENCE,
    issuer: issuer,
    algorithms: [ 'RS256' ]
  })(req, res, next);
});
*/

function list_msgs(args) {
  console.log("list msg: " + args);
  return new Promise(function(resolve, rej) {
    var oAuth2Client = new google.auth.OAuth2();
    oAuth2Client.credentials = {access_token: args.access_token};
    const gmail = google.gmail({
      version: 'v1',
      auth: oAuth2Client,
    });
    gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
      q: 'label:inbox ref:' + args.key_hash,
    })
    .then(data => {args.msg_list = data.data;resolve(args);})
    .catch(err => {rej(err);});
  });
}

function get_msg_id(args) {
  console.log('get id: ' + JSON.stringify(args));
  return new Promise(function(resolve, rej) {
    if (!args.msg_list.resultSizeEstimate) {
      rej("no message found with the key hash: " + args.key_hash);
    } else {
      args.msg_id = args.msg_list.messages[0].id;
      delete args.msg_list;
      resolve(args);
    }
  });
}

function get_msg(args) {
  console.log('get_msg: ' + args);
  return new Promise(function(resolve, rej) {
    var oAuth2Client = new google.auth.OAuth2();
    oAuth2Client.credentials = {access_token: args.access_token};
    const gmail = google.gmail({
      version: 'v1',
      auth: oAuth2Client,
    });
    gmail.users.messages.get({
      userId: 'me',
      id: args.msg_id,
    })
    .then(data => {
      var parseMessage = require('gmail-api-parse-message');
      var parsedMessage = parseMessage(data.data);
      args.msg_text = ( parsedMessage.textPlain ? parsedMessage.textPlain : parsedMessage.textHtml);
      args.msg_from = parsedMessage.headers.from;
      delete args.access_token;
      delete args.msg_id;
      resolve(args);
    })
    .catch(err => {rej(err);});
  });
}

function validate_gmail (args) {
  console.log("validate gmail: " + args);
  return new Promise(function(resolve, rej) {
    if ( args.msg_to.split("@").length === 2 && args.msg_to.split("@")[1] === "gmail.com") {
      resolve(args);
    } else {
      rej("Invalid Gmail address.");
    }
  });
}

function gen_key_hash(args) {
  console.log("gen key_hash: " + args);
  return new Promise(function(resolve, rej) {
    const options = {
        url: URL_GENKEY,
    };
    rp(options)
    .then(data => {console.log(data); args.key_hash = data; resolve(args);})
    .catch(err => { rej(err);});
  });
}

function cipher_msg (args){
  console.log("encrypt msg: " + JSON.stringify(args));
  return new Promise(function(resolve, rej) {
    var msg_body = {
      key_hash: args.key_hash,
      text: args.msg_text
    };
    const options = {
        url: URL_ENCRYPT,
        method: "post",
        json: true,
        body: msg_body
    };
    rp(options)
    .then(data => {args.msg_text = data; resolve(args);})
    .catch(err => {rej(err);});
  });
}

function send_msg (args){
  console.log("send msg: " + JSON.stringify(args));
  return new Promise(function(resolve, rej) {
    function mailBodyBuilder (params) {
      var Base64 = require('js-base64').Base64;
      const messageParts = [
        'From: ' + ((params.from) ? params.from : ''),
        'To: ' + params.to,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        'Subject: ' + params.subject,
        '',
        params.body
      ];
      const message = messageParts.join('\n');
      return Base64.encodeURI(message);
    }

    const encodedMsgBody = mailBodyBuilder({to: args.msg_to, subject: 'EnigMSG - ref:' + args.key_hash, body: args.msg_text});
    var oAuth2Client = new google.auth.OAuth2();
    oAuth2Client.credentials = {access_token: args.access_token};
    const gmail = google.gmail({
      version: 'v1',
      auth: oAuth2Client,
    });
    gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMsgBody,
      },
    })
    .then(data => {
      if ( data.data && data.data.id ) {
        var msg = {};
        msg.key_hash = args.key_hash;
        resolve(msg);
      } else {
        rej(data.data);
      }
    })
    .catch(err => {console.log(err);rej(err);});
  });
}

function send_succ_res(req, res, msg) {
  console.log("send succ msg: " + msg);
  res.status(200).send(msg);
}

app.get('/getmsg', Auth0.ensureProfile(), (req, res) => {
  if (req.query.key_hash) {
    var key_hash = req.query.key_hash.toUpperCase();
    } else {
      res.status(401).send("Key hash cannot be empty.");
  }

  var options = {
    key_hash: key_hash,
    access_token: req.user.identities[0].access_token
  };
  var startDecrypt = new Promise(function (resolve, rej) {
      console.log('start decrypt...');
      resolve(options);
  });
  startDecrypt
  .then(list_msgs)
  .then(get_msg_id)
  .then(get_msg)
  .then(cipher_msg)
  .then(data => {send_succ_res(req, res, data);})
  .catch(reason => {console.log('reason: ' + reason);res.status(500).send(reason);});
});

app.post('/sendmsg', Auth0.ensureProfile(), (req, res) => {
  var options = {
    access_token: req.user.identities[0].access_token,
    msg_to: req.body.msg_to,
    msg_text: req.body.msg_text
  };

  var startEncrypt = new Promise(function (resolve, rej) {
      console.log('start decrypt...');
      resolve(options);
  });
  startEncrypt
  .then(validate_gmail)
  .then(gen_key_hash)
  .then(cipher_msg)
  .then(send_msg)
  .then(data => {console.log("data: " + data);send_succ_res(req, res, data);})
  .catch(reason => {console.log('reason: ' + reason);res.status(500).send(reason);});
});

app.get('/getkey', (req, res) => {
  if (req.query.key_hash) {
    var key_hash = req.query.key_hash.toUpperCase();
    } else {
      res.status(401).send("Key hash cannot be empty.");
  }
  const options = {
      url: URL_GENKEY,
      qs: {
        key_hash: key_hash
      }
  };
  rp(options)
  .then(data => {
    res.status(200).send(JSON.parse(data));
  })
  .catch(err => {res.status(500).send(err);});
});


app.get('/user', Auth0.ensureProfile(), (req, res) => {
  res.status(200).send(req.user);
});

app.get('/test', (req, res) => {
  // test endpoint, no-operation
  res.status(200);
});

module.exports = fromExpress(app).auth0();