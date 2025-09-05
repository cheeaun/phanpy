import urlRegex from '../data/url-regex';

const urlRegexObj = new RegExp(urlRegex.source, urlRegex.flags);

export default urlRegexObj;
