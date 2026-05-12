import urlRegex from '../data/url-regex.json';

const urlRegexObj = new RegExp(urlRegex.source, urlRegex.flags);

export default urlRegexObj;
