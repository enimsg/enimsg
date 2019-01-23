'use latest';

import express from 'express';
import { fromExpress } from 'webtask-tools';
import bodyParser from 'body-parser';
const app = express();

const request = require('request');

//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: false }));

function random_key_hash() {
  var key_hash = Math.random().toString(36).substring(2, 8).toUpperCase();
  return key_hash;
}

function random_keys() {
  var keys = {};

  //pick 3 rotors from total 8 rotors ( 0-7 represents rotor I-VIII)
  var picked_rotors = [];
  var all_rotors = '01234567'.split('');
  for (var i = 0; i < 3; i++) {
    let w = Math.floor(Math.random() * (all_rotors.length - i));
    picked_rotors.push(all_rotors[w]);
    all_rotors.splice(w, 1);
  }
  keys.rotors = picked_rotors.join('');

  //pick 1 reflector from total 2 reflectors ('B' or 'C')
  keys.reflector = ((Math.random() * 2 > 1) ? 'B' : 'C');

  //generate the initial postions of each rotor
  keys.positions = Math.random().toString(36).replace(/[0-9]+/g, '').substring(1, 4).toUpperCase();

  //generate the ring's initial location of each rotor
  keys.rings = Math.random().toString(36).replace(/[0-9]+/g, '').substring(1, 4).toUpperCase();

  //generate the plug board settings, random switch up to 6 pairs of letters
  var candidates = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var plugboard = candidates.slice();
  var pairs = Math.floor(Math.random() * 7);
  for (var rest = 26; rest > 26 - pairs * 2; rest -= 2) {
    do {
      var a = Math.floor(Math.random() * rest);
      var b = Math.floor(Math.random() * rest);
    } while ( a === b);
    //switch the letters in the plugboard
    let index_a = candidates[a].charCodeAt(0) - 65;
    let index_b = candidates[b].charCodeAt(0) - 65;
    [plugboard[index_a], plugboard[index_b]] = [plugboard[index_b], plugboard[index_a]];
    //remove switched letters from candidates
    if (a > b) {
      candidates.splice(a, 1);
      candidates.splice(b, 1);
    } else {
      candidates.splice(b, 1);
      candidates.splice(a, 1);
    }
  }

  keys.plugboard = plugboard.join('');
  return keys;
}

app.get('/genkeys', (req, res) => {
  var key_hash = random_key_hash();
  var keys = random_keys();
  req.webtaskContext.storage.get(function(err, data) {
    if (err) return res.status(500).send(err);
    data = data || { counter: 1 };
    data[key_hash] = keys;
    var attempts = 3;
    req.webtaskContext.storage.set(data, function set_cb(err) {
      if (err) {
        if (err.code === 409 && attempts--) {
          // resolve conflict and re-attempt set
          key_hash = random_key_hash();
          data[key_hash] = keys;
          data.counter = Math.max(data.counter, err.conflict.counter) + 1;
          return req.webtaskContext.storage.set(data, set_cb);
        }
        return res.status(500).send(err);
      }
    });
  });
  res.status(200).send(key_hash);
});

app.get('/getkeys', (req, res) => {
  var key_hash = req.query.key_hash;
  console.log(key_hash);
  req.webtaskContext.storage.get(function(err, data) {
    if (err) return res.status(500).send(err);
    if (data.hasOwnProperty(key_hash)) {
      res.status(200).json(data[key_hash]);
    } else {
      res.status(500).send('Key hash not available.');
    }
  });
});


app.get('/', (req, res) => {
  res.status(200);
});


module.exports = fromExpress(app);