import fs from 'fs';

import regexSupplant from 'twitter-text/dist/lib/regexSupplant.js';
import validDomain from 'twitter-text/dist/regexp/validDomain.js';
import validPortNumber from 'twitter-text/dist/regexp/validPortNumber.js';
import validUrlPath from 'twitter-text/dist/regexp/validUrlPath.js';
import validUrlPrecedingChars from 'twitter-text/dist/regexp/validUrlPrecedingChars.js';
import validUrlQueryChars from 'twitter-text/dist/regexp/validUrlQueryChars.js';
import validUrlQueryEndingChars from 'twitter-text/dist/regexp/validUrlQueryEndingChars.js';

// The difference with twitter-text's extractURL is that the protocol isn't
// optional.

const urlRegex = regexSupplant(
  '(' + // $1 total match
    '(#{validUrlPrecedingChars})' + // $2 Preceeding chracter
    '(' + // $3 URL
    '(https?:\\/\\/)' + // $4 Protocol (optional) <-- THIS IS THE DIFFERENCE, MISSING '?' AFTER PROTOCOL
    '(#{validDomain})' + // $5 Domain(s)
    '(?::(#{validPortNumber}))?' + // $6 Port number (optional)
    '(\\/#{validUrlPath}*)?' + // $7 URL Path
    '(\\?#{validUrlQueryChars}*#{validUrlQueryEndingChars})?' + // $8 Query String
    ')' +
    ')',
  {
    validUrlPrecedingChars,
    validDomain,
    validPortNumber,
    validUrlPath,
    validUrlQueryChars,
    validUrlQueryEndingChars,
  },
  'gi',
);

const filePath = 'src/data/url-regex.json';
fs.writeFile(
  filePath,
  JSON.stringify({
    source: urlRegex.source,
    flags: urlRegex.flags,
  }),
  (err) => {
    if (err) {
      console.error(err);
    }
    console.log(`Wrote ${filePath}`);
  },
);
