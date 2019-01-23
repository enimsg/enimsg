var express    = require('express');
var Webtask    = require('webtask-tools');
var bodyParser = require('body-parser');
const rp = require('request-promise');
var app = express();

const const URL_GENKEY = 'YOUR_URL_GENKEY';

app.use(bodyParser.json());

class Enigma {
  static rotors() {
    return {
      I: {wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', turnover: 'Q', curr: 'A', ring: 'A'},
      II: {wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', turnover: 'E', curr: 'A', ring: 'A'},
      III: {wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', turnover: 'V', curr: 'A', ring: 'A'},
      IV: {wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', turnover: 'J', curr: 'A', ring: 'A'},
      V: {wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', turnover: 'Z', curr: 'A', ring: 'A'},
      VI: {wiring: 'JPGVOUMFYQBENHZRDKASXLICTW', turnover: 'ZM', curr: 'A', ring: 'A'},
      VII: {wiring: 'NZJHGRCXMYSWBOUFAIVLPEKQDT', turnover: 'ZM', curr: 'A', ring: 'A'},
      VIII: {wiring: 'FKQHTLXOCBJSPDZRAMEWNIUYGV', turnover: 'ZM', curr: 'A', ring: 'A'}
    };
  }

  static reflectors() {
    return {
      B: {wiring: 'YRUHQSLDPXNGOKMIEBFZCWVJAT'},
      C: {wiring: 'FVPJIAOYEDRZXWGCTKUQSBNMHL'}
    };
  }

  _offsetLetter(char, offset = 1) {
    let charAscii = char.charCodeAt(0);
    // offsetMod range from -25 to 25
    let offsetMod = offset % 26;
    // calc the output char index (0-25)
    let charIndex = (charAscii - 65 + offsetMod + 2 * 26) % 26;
    return String.fromCharCode(charIndex + 65);
  }

  _rotorsPosition() {
    var s = [];
    this.rotors.forEach((v) => {
      s.push(v.curr);
    });
    return s.join('');
  }

  constructor(keys) {
    //pick the rotors according to keys
    this.rotors = [];
    keys.rotors.split('').forEach( (v) => {
      let toRoman = {
        0: 'I', 1: 'II', 2: 'III', 3: 'IV',
        4: 'V', 5: 'VI', 6: 'VII', 7: 'VIII'
      };
      this.rotors.push(Enigma.rotors()[toRoman[v]]);
    });

    for (var rotor of this.rotors) {
      for (var k in rotor) {
        rotor[k] = rotor[k].split('');
      }
    }

    //pick the reflector according to keys
    this.reflector = Enigma.reflectors()[keys.reflector];
    for (var k in this.reflector) {
        this.reflector[k] = this.reflector[k].split('');
    }

    //set the positions of the rotors
    this.rotors.forEach( (rtr, index) => {
      rtr.curr = keys.positions[index];
    });

    //set the rings of the rotors
    this.rotors.forEach( (rtr, index) => {
      rtr.ring = keys.rings[index];
    });

    //set the plugboard
    this.plugboard = {};
    this.plugboard.wiring = keys.plugboard.split('');
  }

  step() {
    var rightRotorPosition = this.rotors[2].curr;
    var middleRotorPosition = this.rotors[1].curr;

    //step the rightmost rotor
    this.rotors[2].curr = this._offsetLetter(this.rotors[2].curr);
    //carry to middle rotor if passed the "turnover" letter
    if (this.rotors[2].turnover.includes(rightRotorPosition)) {
      this.rotors[1].curr = this._offsetLetter(this.rotors[1].curr);

    }
    //double stepping of the middle rotor and carry to the left rotor
    if (this.rotors[1].turnover.includes(middleRotorPosition)) {
      this.rotors[1].curr = this._offsetLetter(this.rotors[1].curr);
      this.rotors[0].curr = this._offsetLetter(this.rotors[0].curr);
    }
  }

  alterLetter(char) {
    //   ┌- rotor[0] <-- rotor[1] <-- rotor[2] <-- plugboard <-- a (IN)
    // reflector
    //   └> rotor[0] --> rotor[1] --> rotor[2] --> plugboard --> x (OUT)
    function rightIn (charIn, rotor) {
      // encryption of plugboard, rotors before reflector as well as the reflector itself
      var offsetStep;
      var offsetRing;
      // calc the offsetStep - how many steps the rotor has rotated (0-25)
      if (rotor.curr) {
        offsetStep = rotor.curr.charCodeAt(0) - 65;
      } else {
        offsetStep = 0;
      }
      // calc the offsetRing - offset caused by the ring setting (0-25)
      if (rotor.ring) {
        offsetRing = rotor.ring.charCodeAt(0) - 65;
      } else {
        offsetRing = 0;
      }
      // calc the letter (index 0-25) on the rotor at the charIn location
      let letterIn = (charIn.charCodeAt(0) - 65 + offsetStep - offsetRing + 26) % 26;
      // map the input letter to output letter (index 0-25) thru the rotor
      let letterOut = rotor.wiring[letterIn].charCodeAt(0) - 65;
      // compensate the offset
      letterOut = (letterOut + offsetRing - offsetStep + 26) % 26;

      return String.fromCharCode(letterOut + 65);
    }
    function leftIn (charIn, rotor) {
      // encryption of plugboard, rotors after reflector
      var offsetStep;
      var offsetRing;
      // calc the offsetStep - how many steps the rotor has rotated (0-25)
      if (rotor.curr) {
        offsetStep = rotor.curr.charCodeAt(0) - 65;
      } else {
        offsetStep = 0;
      }
      // calc the offsetRing - offset caused by the ring setting (0-25)
      if (rotor.ring) {
        offsetRing = rotor.ring.charCodeAt(0) - 65;
      } else {
        offsetRing = 0;
      }
      // calc the letter (index 0-25) on the rotor at the charIn location
      let letterIn = (charIn.charCodeAt(0) - 65 + offsetStep - offsetRing + 26) % 26;
      // map the input letter to output letter (index 0-25) thru the rotor
      let letterOut = rotor.wiring.indexOf(String.fromCharCode(letterIn + 65));
      // compensate the offset
      letterOut = (letterOut + offsetRing - offsetStep + 26) % 26;

      return String.fromCharCode(letterOut + 65);
    }

    var halfAlteredChar, alteredChar;
    const beforeReflector = [this.reflector, this.rotors[0], this.rotors[1], this.rotors[2], this.plugboard];
    const afterReflector = [this.rotors[0], this.rotors[1], this.rotors[2], this.plugboard];
    halfAlteredChar = beforeReflector.reduceRight(rightIn, char);
    alteredChar = afterReflector.reduce(leftIn, halfAlteredChar);
    return alteredChar;
  }

  encrypt(text) {
    //   ┌- rotor[0] <-- rotor[1] <-- rotor[2] <-- plugboard <-- a (IN)
    // reflector
    //   └> rotor[0] --> rotor[1] --> rotor[2] --> plugboard --> x (OUT)
    var cipher = [];
    text = text.toUpperCase().replace(/[^A-Z]+/g, '');
    cipher = text.split('').map(char => {
      this.step();
      return this.alterLetter(char);
    });
    return cipher.join('');
  }
}

app.get('/test', function (req, res) {
  var keys = {
        rotors: '254',
        positions: 'IDF',
        rings: 'UPM',
        reflector: 'B',
        plugboard: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      };
  var eng = new Enigma(keys);
  console.log(eng.encrypt('KZYCUF'));
  res.sendStatus(200);
});

app.post('/', function (req, res) {
  if ( !req.body.key_hash || !req.body.text ) {
    res.status(400).send('Encrypt request format invalid.');
  }
  var text = req.body.text;
  text = text.toUpperCase().replace(/[^A-Z]+/g, '');
  const options = {
      url: URL_GENKEY,
      qs: {
        key_hash: req.body.key_hash
      }
  };
  rp(options)
  .then(data => {
    let keys = JSON.parse(data);
    console.log('keys:');
    console.log(keys);
    let enigma = new Enigma(keys);
    let ciphertext = enigma.encrypt(text);
    res.status(200).send(ciphertext);
  })
  .catch(err => {console.log('err: ' + err); res.status(500).send(err);});
});

module.exports = Webtask.fromExpress(app);
