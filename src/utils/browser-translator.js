const supportsLanguageDetector = 'LanguageDetector' in self;
export const supportsBrowserTranslator =
  supportsLanguageDetector && 'Translator' in self;

// https://developer.chrome.com/docs/ai/language-detection
// Lazily created on first use, as downloading the model needs a user gesture
let langDetectorPromise;

const createLangDetector = async () => {
  const availability = await LanguageDetector.availability();
  if (availability === 'unavailable') {
    console.log('🎺 Language detector is unavailable');
    return null;
  }
  if (availability !== 'available' && !navigator.userActivation?.isActive) {
    console.log('🎺 Language detector needs user activation to download');
    return null;
  }
  console.log(`🎺 Language detector is ${availability}`);
  return await LanguageDetector.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        console.log(`🎺 Language detector: Downloaded ${e.loaded * 100}%`);
      });
    },
  });
};

export const getLangDetector = async () => {
  if (!supportsLanguageDetector) return null;
  langDetectorPromise ||= createLangDetector().catch((e) => {
    console.error(e);
    return null;
  });
  const langDetector = await langDetectorPromise;
  // Retry later if not created yet, e.g. needs user activation to download
  if (!langDetector) langDetectorPromise = null;
  return langDetector;
};

// https://developer.chrome.com/docs/ai/translator-api
export const translate = async (text, source, target) => {
  let detectedSourceLanguage;
  const originalSource = source;
  if (source === 'auto') {
    const detector = await getLangDetector();
    if (!detector?.detect) {
      return {
        error: 'No language detector',
      };
    }
    try {
      const results = await detector.detect(text);
      source = results[0].detectedLanguage;
      detectedSourceLanguage = source;
    } catch (e) {
      console.warn(e);
      return {
        error: e,
      };
    }
  }
  const groupLabel = `💬 BROWSER TRANSLATE ${text}`;
  console.groupCollapsed(groupLabel);
  console.log(originalSource, detectedSourceLanguage, target);
  try {
    const translatorCapabilities = await Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
    // Note: Translator.availability() returns 'unavailable', 'downloadable', 'downloading', or 'available'.
    if (translatorCapabilities === 'unavailable') {
      console.groupEnd(groupLabel);
      return {
        error: `Unsupported language pair: ${source} -> ${target}`,
      };
    }
    // Downloading a language pack needs a user gesture, so bail out and let
    // the caller fall back to the server-side translator
    if (
      translatorCapabilities !== 'available' &&
      !navigator.userActivation?.isActive
    ) {
      console.groupEnd(groupLabel);
      return {
        error: `Translation model for ${source} -> ${target} needs a user gesture to download`,
      };
    }

    const translator = await Translator.create({
      sourceLanguage: source,
      targetLanguage: target,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          console.log(
            `Translate ${source} -> ${target}: Downloaded ${e.loaded * 100}%`,
          );
        });
      },
    });

    const content = await translator.translate(text);
    console.log(content);
    console.groupEnd(groupLabel);

    return {
      content,
      detectedSourceLanguage,
      provider: 'browser',
    };
  } catch (e) {
    console.groupEnd(groupLabel);
    console.error(e);
    return {
      error: e,
    };
  }
};
