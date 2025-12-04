const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const sourceLanguage = document.getElementById('sourceLanguage');
const targetLanguage = document.getElementById('targetLanguage');
const statusMessage = document.getElementById('statusMessage');
const resultWord = document.getElementById('resultWord');
const resultPhonetic = document.getElementById('resultPhonetic');
const resultTranslation = document.getElementById('resultTranslation');
const definitionsContainer = document.getElementById('definitionsContainer');
const audioButton = document.getElementById('audioButton');
const favoriteButton = document.getElementById('favoriteButton');
const favoritesList = document.getElementById('favoritesList');
const clearFavoritesBtn = document.getElementById('clearFavorites');
const modeSwitch = document.getElementById('modeSwitch');

let audioSrc = null;
let favorites = JSON.parse(localStorage.getItem('polyglotFavorites') || '[]');

const LANG_LABELS = {
  en: 'English',
  hi: 'Hindi',
  kn: 'Kannada',
  es: 'Spanish',
  fr: 'French',
  zh: 'Chinese (Simplified)',
};

const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const TRANSLATE_API = 'https://api.mymemory.translated.net/get';

function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.dataset.status = type;
}

async function fetchDictionaryData(word) {
  const response = await fetch(`${DICT_API_BASE}${encodeURIComponent(word)}`);
  if (!response.ok) throw new Error('Word not found in dictionary');
  return response.json();
}

async function translateWord(text, from, to) {
  const url = `${TRANSLATE_API}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Translation service unavailable');
  const data = await response.json();
  return {
    translatedText: data?.responseData?.translatedText,
    match: data?.responseData?.match || 0,
  };
}

function renderDefinitions(entries = []) {
  definitionsContainer.innerHTML = '';

  entries.forEach((entry) => {
    entry.meanings?.forEach((meaning) => {
      const card = document.createElement('article');
      card.className = 'definition-card';

      const part = document.createElement('h4');
      part.textContent = meaning.partOfSpeech || 'definition';
      card.appendChild(part);

      meaning.definitions?.slice(0, 2).forEach((def) => {
        const defText = document.createElement('p');
        defText.textContent = def.definition || 'Definition unavailable.';
        card.appendChild(defText);

        if (def.example) {
          const example = document.createElement('p');
          example.className = 'example';
          example.textContent = `“${def.example}”`;
          card.appendChild(example);
        }
      });

      if (meaning.synonyms?.length) {
        const synonyms = document.createElement('p');
        synonyms.className = 'example';
        synonyms.textContent = `Synonyms: ${meaning.synonyms.slice(0, 5).join(', ')}`;
        card.appendChild(synonyms);
      }

      definitionsContainer.appendChild(card);
    });
  });
}

function updateFavoritesUI() {
  favoritesList.innerHTML = '';
  if (!favorites.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No favorites yet.';
    favoritesList.appendChild(empty);
    return;
  }

  favorites.forEach((fav) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <span>${fav.word}</span>
      <button class="ghost-btn small" data-word="${fav.word}">View</button>
    `;
    favoritesList.appendChild(item);
  });
}

function saveFavorite(entry) {
  if (favorites.some((fav) => fav.word === entry.word)) return;
  favorites.unshift(entry);
  favorites = favorites.slice(0, 10);
  localStorage.setItem('polyglotFavorites', JSON.stringify(favorites));
  updateFavoritesUI();
}

function populateFromFavorite(word) {
  searchInput.value = word;
  handleLookup();
}

async function handleLookup() {
  const term = searchInput.value.trim();
  const from = sourceLanguage.value;
  const to = targetLanguage.value;

  if (!term) {
    setStatus('Please enter a word to search.');
    return;
  }

  setStatus('Looking up word...');
  resultWord.textContent = 'Searching...';
  resultPhonetic.textContent = '';
  resultTranslation.textContent = '';
  definitionsContainer.innerHTML = '';
  audioButton.disabled = true;
  favoriteButton.disabled = true;

  try {
    let lookupWord = term;
    let translationToEnglish = null;

    if (from !== 'en') {
      setStatus('Translating source word to English...');
      translationToEnglish = await translateWord(term, from, 'en');
      lookupWord = translationToEnglish.translatedText || term;
    }

    const [dictionaryEntries, targetTranslation] = await Promise.all([
      fetchDictionaryData(lookupWord.toLowerCase()),
      to === 'en' && from === 'en' ? Promise.resolve(null) : translateWord(lookupWord, 'en', to),
    ]);

    const primaryEntry = dictionaryEntries[0];
    resultWord.textContent = primaryEntry.word || lookupWord;
    resultPhonetic.textContent =
      primaryEntry.phonetics?.find((p) => p.text)?.text || 'Phonetic unavailable';

    if (targetTranslation?.translatedText) {
      resultTranslation.textContent = `Translation (${LANG_LABELS[to]}): ${targetTranslation.translatedText}`;
    } else if (from !== 'en' && translationToEnglish) {
      resultTranslation.textContent = `English lookup: ${translationToEnglish.translatedText}`;
    } else {
      resultTranslation.textContent = '';
    }

    audioSrc = primaryEntry.phonetics?.find((p) => p.audio)?.audio || null;
    audioButton.disabled = !audioSrc;
    favoriteButton.disabled = false;
    favoriteButton.dataset.word = primaryEntry.word;

    renderDefinitions(dictionaryEntries);
    setStatus('Word loaded successfully.', 'success');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Something went wrong. Please try again.', 'error');
    resultWord.textContent = 'No results';
  }
}

function handleAudioPlayback() {
  if (!audioSrc) return;
  const audio = new Audio(audioSrc);
  audio.play().catch((err) => console.error('Audio playback failed', err));
}

function handleFavoriteClick() {
  const word = favoriteButton.dataset.word;
  if (!word) return;
  saveFavorite({ word });
  setStatus(`${word} added to favorites.`, 'success');
}

function handleClearFavorites() {
  favorites = [];
  localStorage.removeItem('polyglotFavorites');
  updateFavoritesUI();
}

function initTheme() {
  const userPref = localStorage.getItem('polyglotTheme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const useDark = userPref ? userPref === 'dark' : prefersDark;
  document.documentElement.classList.toggle('dark', useDark);
  modeSwitch.checked = useDark;
}

function toggleTheme() {
  const useDark = modeSwitch.checked;
  document.documentElement.classList.toggle('dark', useDark);
  localStorage.setItem('polyglotTheme', useDark ? 'dark' : 'light');
}

searchButton.addEventListener('click', handleLookup);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleLookup();
});
audioButton.addEventListener('click', handleAudioPlayback);
favoriteButton.addEventListener('click', handleFavoriteClick);
favoritesList.addEventListener('click', (event) => {
  if (event.target.matches('button[data-word]')) {
    populateFromFavorite(event.target.dataset.word);
  }
});
clearFavoritesBtn.addEventListener('click', handleClearFavorites);
modeSwitch.addEventListener('change', toggleTheme);

initTheme();
updateFavoritesUI();
setStatus('Type a word to get started.');

