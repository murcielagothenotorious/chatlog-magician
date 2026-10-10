interface Window {
  ChatlogParser?: any;
  i18n?: any;
  ChatlogGuidance?: any;
}

declare var $: any;
declare var ChatlogParser: any;

window.ChatlogParser = window.ChatlogParser || {};

$(document).ready(function () {
  // Debug mode - set to false for production
  const DEBUG_MODE = false;

  let applyBackground = localStorage.getItem('backgroundEnabled') === 'true';
  let backgroundColor = '#000000';
  let backgroundOpacity = 1;
  let disableCharacterNameColoring = false;
  let hideSystemMessages = localStorage.getItem('chatlogHideSystemMessages') !== 'false';

  // Censor style: 'remove' (hidden) or 'blur' (pixelated blur)
  let censorStyle = localStorage.getItem('chatlogCensorStyle') || 'remove';

  const fontOptions = [
    { name: 'Arial', family: 'Arial, Helvetica, sans-serif' },
    { name: 'Trebuchet MS', family: '"Trebuchet MS", Helvetica, sans-serif' },
    { name: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
    { name: 'Tahoma', family: 'Tahoma, Geneva, sans-serif' },
    { name: 'Georgia', family: 'Georgia, serif' },
    { name: 'Palatino', family: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
    { name: 'Times New Roman', family: '"Times New Roman", Times, serif' },
    { name: 'Arial Black', family: '"Arial Black", Gadget, sans-serif' },
    { name: 'Comic Sans MS', family: '"Comic Sans MS", cursive, sans-serif' },
    { name: 'Impact', family: 'Impact, Charcoal, sans-serif' },
    { name: 'Lucida Sans', family: '"Lucida Sans Unicode", "Lucida Grande", sans-serif' },
    { name: 'Courier New', family: '"Courier New", Courier, monospace' },
    { name: 'Lucida Console', family: '"Lucida Console", Monaco, monospace' },
    { name: 'Calibri', family: 'Calibri, sans-serif' },
    { name: 'Raleway', family: '"Raleway", sans-serif' },
    { name: 'Roboto', family: '"Roboto", sans-serif' },
    { name: 'Ubuntu', family: '"Ubuntu", sans-serif' },
    { name: 'Mukta', family: '"Mukta", sans-serif' },
    { name: 'Open Sans', family: '"Open Sans", sans-serif' },
    { name: 'Nunito Sans', family: '"Nunito Sans", sans-serif' },
    { name: 'Inter', family: '"Inter", sans-serif' },
  ];

  // Font style: index in fontOptions array or legacy name
  let fontStyle = localStorage.getItem('chatlogFontStyle') || '0';
  // Handle legacy values ('arial', 'trebuchet')
  if (fontStyle === 'arial') fontStyle = '0';
  if (fontStyle === 'trebuchet') fontStyle = '1';

  let contrastStyle = localStorage.getItem('chatlogContrastStyle') || 'off';
  let enableItalicParsing = localStorage.getItem('chatlogItalicParsing') !== 'false';
  let enableWhisperColoring = localStorage.getItem('chatlogWhisperColoring') !== 'false';
  // Store user color overrides: Map<wordId, colorClass>
  // This preserves user-applied colors across re-renders
  const colorOverrides = new Map();

  const getI18nText = (key, fallback) => {
    return window.i18n?.t(key) || window.ChatlogGuidance?.i18n?.t(key) || fallback;
  };

  const $textarea = $('#chatlogInput');
  const $output = $('#output');
  const $toggleBackgroundBtn = $('#toggleBackground');
  const $toggleCharacterNameColoringBtn = $('#toggleCharacterNameColoring');
  const $censorCharButton = $('#censorCharButton');
  const $toggleCensorStyleBtn = $('#toggleCensorStyle');
  const $toggleFontBtn = $('#toggleFont');
  const $toggleContrastBtn = $('#toggleContrast');
  const $toggleItalicParsingBtn = $('#toggleItalicParsing');
  const $toggleWhisperColoringBtn = $('#toggleWhisperColoring');
  const $lineLengthInput = $('#lineLengthInput');
  const $characterNameInput = $('#characterNameInput');
  const $toggleSystemMessagesBtn = $('#floatingSysMsgToggle');
  const $opsecBtn = $('#opsecBtn');
  const $openFilterModalBtn = $('#openFilterModalBtn');
  const $toggleGtawLookBtn = $('#toggleGtawLook');
  let gtawLookActive = localStorage.getItem('chatlogGtawLook') === 'true';

  $toggleBackgroundBtn.on('click', toggleBackground);
  $toggleCharacterNameColoringBtn.on('click', toggleCharacterNameColoring);
  if ($toggleSystemMessagesBtn.length) {
    $toggleSystemMessagesBtn.on('click', toggleSystemMessages);
  }
  $censorCharButton.on('click', copyCensorChar);
  $toggleCensorStyleBtn.on('click', toggleCensorStyle);
  if ($opsecBtn.length) {
    $opsecBtn.on('click', handleOpsecClick);
  }
  if ($openFilterModalBtn.length) {
    $openFilterModalBtn.on('click', openFilterModal);
  }
  if ($toggleGtawLookBtn.length) {
    $toggleGtawLookBtn.on('click', toggleGtawLook);
  }
  $toggleFontBtn.on('click', toggleFontStyle);
  $toggleContrastBtn.on('click', toggleContrastStyle);
  $toggleItalicParsingBtn.on('click', toggleItalicParsing);
  if ($toggleWhisperColoringBtn.length) {
    $toggleWhisperColoringBtn.on('click', toggleWhisperColoring);
  }

  $lineLengthInput.on('input', processOutput);
  $characterNameInput.on('input', applyFilter);
  const throttleDelay = (typeof CONFIG !== 'undefined' && CONFIG.INPUT_THROTTLE_MS) || 200;
  $textarea.off('input').on('input', throttle(processOutput, throttleDelay));

  updateCensorStyleUI();
  updateFontStyleUI();
  applyFontStyle();
  updateContrastStyleUI();
  applyContrastStyle();
  updateBackgroundUI();
  updateSystemMessagesUI();
  updateGtawLookUI();

  // ===== TXT File Upload =====
  const $txtUploadArea = $('#txtUploadArea');
  const $chatlogFileInput = $('#chatlogFileInput');
  const $txtUploadContent = $txtUploadArea.find('.txt-upload-content');
  const $txtFileInfo = $('#txtFileInfo');
  const $txtFileName = $('#txtFileName');
  const $txtFileSize = $('#txtFileSize');
  const $txtFileClear = $('#txtFileClear');

  $txtUploadArea.on('click', function (e) {
    if ($(e.target).closest('.txt-file-clear').length) return;
    $chatlogFileInput[0].click();
  });

  // Keyboard accessibility
  $txtUploadArea.on('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $chatlogFileInput[0].click();
    }
  });

  $chatlogFileInput.on('change', function () {
    const file = this.files[0];
    if (file) loadTxtFile(file);
  });

  $txtUploadArea.on('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    $txtUploadArea.addClass('dragover');
  });

  $txtUploadArea.on('dragleave drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    $txtUploadArea.removeClass('dragover');
  });

  $txtUploadArea.on('drop', function (e) {
    const files = e.originalEvent?.dataTransfer?.files || e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.match(/\.(txt|log)$/i)) {
        loadTxtFile(file);
      } else if (file.name.match(/\.bcmag$/i)) {
        const input = document.getElementById('projectFileInput') as HTMLInputElement | null;
        if (input) {
          try {
            if (typeof DataTransfer !== 'undefined') {
              const dt = new DataTransfer();
              dt.items.add(file);
              input.files = dt.files;
            }
          } catch (_err) {
            // Ignore: input stays empty, the change event below still fires.
          }
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  });

  $txtFileClear.on('click', function (e) {
    e.stopPropagation();
    clearTxtFile();
  });

  function loadTxtFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      $textarea.val(e.target.result);
      processOutput();
      showFileInfo(file);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function showFileInfo(file) {
    $txtUploadContent.hide();
    $txtFileName.text(file.name);
    $txtFileSize.text(formatFileSize(file.size));
    $txtFileInfo.css('display', 'flex');
    $txtUploadArea.addClass('has-file');
  }

  function clearTxtFile() {
    $textarea.val('');
    $chatlogFileInput.val('');
    $txtFileInfo.hide();
    $txtUploadContent.show();
    $txtUploadArea.removeClass('has-file');
    processOutput();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function updateBackgroundUI() {
    $output.toggleClass('background-active', applyBackground);
    ChatlogParser.backgroundActive = applyBackground;

    $toggleBackgroundBtn.toggleClass('active', applyBackground);
    $toggleBackgroundBtn
      .find('.bg-text')
      .text(
        applyBackground
          ? getI18nText('ui.bgOn', 'Arka Plan: Açık')
          : getI18nText('ui.bgOff', 'Arka Plan: Kapalı')
      );
  }

  function toggleBackground() {
    applyBackground = !applyBackground;
    $output.toggleClass('background-active', applyBackground);

    // Store background state for other modules (canvas renderer, export)
    ChatlogParser.backgroundActive = applyBackground;

    localStorage.setItem('backgroundEnabled', applyBackground ? 'true' : 'false');

    updateBackgroundUI();
    processOutput();
  }

  function updateCharacterNameColoringUI() {
    // When disabled, button is NOT active (coloring is off)
    // When enabled (not disabled), button IS active (coloring is on)
    $toggleCharacterNameColoringBtn.toggleClass('active', !disableCharacterNameColoring);
    $toggleCharacterNameColoringBtn
      .find('.name-color-text')
      .text(
        disableCharacterNameColoring
          ? getI18nText('ui.namesOff', 'İsimler: Kapalı')
          : getI18nText('ui.namesOn', 'İsimler: Açık')
      );
  }

  function toggleCharacterNameColoring() {
    disableCharacterNameColoring = !disableCharacterNameColoring;
    updateCharacterNameColoringUI();
    processOutput();
  }

  function toggleItalicParsing() {
    enableItalicParsing = !enableItalicParsing;
    localStorage.setItem('chatlogItalicParsing', enableItalicParsing ? 'true' : 'false');
    updateItalicParsingUI();
    processOutput();
  }

  function updateItalicParsingUI() {
    $toggleItalicParsingBtn.toggleClass('active', enableItalicParsing);
    $toggleItalicParsingBtn
      .find('.italic-parsing-text')
      .text(
        enableItalicParsing
          ? getI18nText('ui.italicOn', 'İtalik: Açık')
          : getI18nText('ui.italicOff', 'İtalik: Kapalı')
      );
  }

  function toggleWhisperColoring() {
    enableWhisperColoring = !enableWhisperColoring;
    localStorage.setItem('chatlogWhisperColoring', enableWhisperColoring ? 'true' : 'false');
    updateWhisperColoringUI();
    processOutput();
  }

  function updateWhisperColoringUI() {
    if (!$toggleWhisperColoringBtn.length) return;
    $toggleWhisperColoringBtn.toggleClass('active', enableWhisperColoring);
    $toggleWhisperColoringBtn
      .find('.whisper-coloring-text')
      .text(
        enableWhisperColoring
          ? getI18nText('ui.whisperOn', 'Kısık/Alçak Ses: Açık')
          : getI18nText('ui.whisperOff', 'Kısık/Alçak Ses: Kapalı')
      );
  }

  updateItalicParsingUI();
  updateWhisperColoringUI();

  function toggleCensorStyle() {
    censorStyle = censorStyle === 'remove' ? 'blur' : 'remove';
    localStorage.setItem('chatlogCensorStyle', censorStyle);
    updateCensorStyleUI();
    processOutput();
  }

  function updateCensorStyleUI() {
    $toggleCensorStyleBtn
      .find('.censor-text')
      .text(
        censorStyle === 'blur'
          ? getI18nText('ui.censorBlur', 'Sansür: Bulanık')
          : getI18nText('ui.censorRemove', 'Sansür: Kaldır')
      );
    $toggleCensorStyleBtn.toggleClass('active', censorStyle === 'blur');
  }

  function toggleFontStyle(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    let $dropdown = $('#fontSelectDropdown');

    if ($dropdown.length === 0) {
      createFontDropdown();
      $dropdown = $('#fontSelectDropdown');
    }

    if ($dropdown.hasClass('show')) {
      $dropdown.removeClass('show');
    } else {
      $('.font-select-dropdown').removeClass('show');

      const btnRect = $toggleFontBtn[0].getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      $dropdown.css({
        top: btnRect.bottom + scrollTop + 4 + 'px',
        left: btnRect.left + scrollLeft + 'px',
      });

      $dropdown.addClass('show');

      const activeItem = $dropdown.find('.font-option.active');
      if (activeItem.length && activeItem[0]) {
        $dropdown.scrollTop(
          activeItem[0].offsetTop - $dropdown.height() / 2 + activeItem.height() / 2
        );
      }
    }
  }

  function setFontStyle(index) {
    fontStyle = String(index);
    localStorage.setItem('chatlogFontStyle', fontStyle);
    updateFontStyleUI();
    applyFontStyle();

    $('#fontSelectDropdown .font-option').removeClass('active');
    $(`#fontSelectDropdown .font-option[data-index="${index}"]`).addClass('active');
  }

  function createFontDropdown() {
    const $dropdownHTML = $('<div id="fontSelectDropdown" class="font-select-dropdown"></div>');

    fontOptions.forEach((font, index) => {
      const isActive = parseInt(fontStyle, 10) === index;
      const $option = $(`<div class="font-option ${isActive ? 'active' : ''}" data-index="${index}">
        <span>${font.name}</span>
        <span style="font-family: ${font.family}; font-size: 16px; opacity: 0.8; margin-left: 10px;">Aa</span>
      </div>`);

      $option.click(function (e) {
        e.stopPropagation();
        setFontStyle(index);
        $('#fontSelectDropdown').removeClass('show');
      });

      $dropdownHTML.append($option);
    });

    $('body').append($dropdownHTML);

    $(document).on('click', function (e) {
      if (
        !$(e.target).closest('#fontSelectDropdown').length &&
        !$(e.target).closest('#toggleFont').length
      ) {
        $('#fontSelectDropdown').removeClass('show');
      }
    });

    // Close on resize to prevent positioning issues
    $(window).on('resize', function () {
      $('#fontSelectDropdown').removeClass('show');
    });
  }

  function updateFontStyleUI() {
    const currentIndex = parseInt(fontStyle, 10);
    const fontName = fontOptions[currentIndex]?.name || 'Arial';
    $toggleFontBtn
      .find('.font-text')
      .html(fontName + ' <span style="font-size: 0.8em; margin-left: 4px;">&#9660;</span>');
    // Button is active when not on the first font (Arial)
    $toggleFontBtn.toggleClass('active', currentIndex !== 0);
  }

  function applyFontStyle() {
    const currentIndex = parseInt(fontStyle, 10);
    const fontFamily = fontOptions[currentIndex]?.family || 'Arial, Helvetica, sans-serif';
    // setProperty for !important support
    $output[0].style.setProperty('font-family', fontFamily, 'important');
    // Also set a data attribute for canvas/export modules to read
    $output.attr('data-font-family', fontFamily);
    // Store for other modules
    ChatlogParser.currentFontFamily = fontFamily;
  }

  // Toggle contrast style: off -> low -> medium -> high -> off
  function toggleContrastStyle() {
    const styles = ['off', 'low', 'medium', 'high'];
    const currentIndex = styles.indexOf(contrastStyle);
    contrastStyle = styles[(currentIndex + 1) % styles.length];
    localStorage.setItem('chatlogContrastStyle', contrastStyle);
    updateContrastStyleUI();
    applyContrastStyle();
  }

  function updateContrastStyleUI() {
    const labels = {
      off: getI18nText('ui.contrastOff', 'Kontrast: Kapalı'),
      low: getI18nText('ui.contrastLow', 'Kontrast: Düşük'),
      medium: getI18nText('ui.contrastMedium', 'Kontrast: Orta'),
      high: getI18nText('ui.contrastHigh', 'Kontrast: Yüksek'),
    };
    $toggleContrastBtn.find('.contrast-text').text(labels[contrastStyle] || labels.off);
    $toggleContrastBtn.toggleClass('active', contrastStyle !== 'off');
  }

  function applyContrastStyle() {
    $output.removeClass('contrast-low contrast-medium contrast-high');

    if (contrastStyle !== 'off') {
      $output.addClass('contrast-' + contrastStyle);
    }

    // Store for other modules
    ChatlogParser.contrastStyle = contrastStyle;
  }

  // Expose contrast style getter for other modules
  ChatlogParser.getContrastStyle = function () {
    return contrastStyle;
  };

  // Expose censor style getter for other modules
  ChatlogParser.getCensorStyle = function () {
    return censorStyle;
  };

  function applyFilter() {
    processOutput();
  }

  // Make applyFilter accessible to other modules
  ChatlogParser.applyFilter = applyFilter;

  ChatlogParser.captureProjectChatState = function () {
    const currentIndex = parseInt(fontStyle, 10);
    return {
      font: fontOptions[currentIndex]?.family || ChatlogParser.currentFontFamily || 'Arial',
      contrast: contrastStyle,
      censorStyle,
      hideSystemMessages,
      namesEnabled: !disableCharacterNameColoring,
      italicParsing: enableItalicParsing,
      whisperColoring: enableWhisperColoring,
      background: {
        enabled: applyBackground,
        color: backgroundColor,
        opacity: backgroundOpacity,
      },
    };
  };

  ChatlogParser.applyProjectChatState = function (chat) {
    const matchingFont = fontOptions.findIndex(
      (option) => option.family === chat.font || option.name === chat.font
    );
    if (matchingFont >= 0) {
      setFontStyle(matchingFont);
    } else {
      fontStyle = '-1';
      localStorage.setItem('chatlogFontStyle', fontStyle);
      $output[0].style.setProperty('font-family', chat.font, 'important');
      $output.attr('data-font-family', chat.font);
      ChatlogParser.currentFontFamily = chat.font;
      $toggleFontBtn.find('.font-text').text(chat.font);
      $toggleFontBtn.addClass('active');
    }
    contrastStyle = chat.contrast;
    censorStyle = chat.censorStyle;
    hideSystemMessages = chat.hideSystemMessages;
    disableCharacterNameColoring = !chat.namesEnabled;
    enableItalicParsing = chat.italicParsing;
    if (chat.whisperColoring !== undefined) {
      enableWhisperColoring = chat.whisperColoring;
      localStorage.setItem('chatlogWhisperColoring', enableWhisperColoring ? 'true' : 'false');
      updateWhisperColoringUI();
    }
    applyBackground = chat.background.enabled;
    backgroundColor = chat.background.color;
    backgroundOpacity = chat.background.opacity;
    localStorage.setItem('chatlogContrastStyle', contrastStyle);
    localStorage.setItem('chatlogCensorStyle', censorStyle);
    localStorage.setItem('chatlogHideSystemMessages', hideSystemMessages ? 'true' : 'false');
    localStorage.setItem('chatlogItalicParsing', enableItalicParsing ? 'true' : 'false');
    localStorage.setItem('backgroundEnabled', applyBackground ? 'true' : 'false');
    updateContrastStyleUI();
    applyContrastStyle();
    updateCensorStyleUI();
    updateSystemMessagesUI();
    updateItalicParsingUI();
    updateCharacterNameColoringUI();
    processOutput();
  };

  function throttle(func, limit) {
    let lastFunc, lastRan;
    return function (...args) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- legacy throttle: dynamic `this` must be preserved, arrow conversion would change binding
      const context = this;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(
          function () {
            if (Date.now() - lastRan >= limit) {
              func.apply(context, args);
              lastRan = Date.now();
            }
          },
          limit - (Date.now() - lastRan)
        );
      }
    };
  }

  function normalizeTurkishForSearch(str) {
    if (!str) return '';
    return str
      .replace(/İ/g, 'i')
      .replace(/i\u0307/g, 'i')
      .toLowerCase();
  }

  function makeTurkishCaseInsensitivePattern(str) {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return esc(str).replace(/[iİ]/g, '[iİ]');
  }

  function formatSaysLine(line, currentCharacterName) {
    if (!currentCharacterName || disableCharacterNameColoring) {
      return wrapSpan('white', line);
    }

    const hasExclamation = line.startsWith('[!]');
    const lineWithoutExclamation = hasExclamation ? line.substring(3).trim() : line;

    // Extract the speaker's name (before 'says' or colon, ignoring parentheticals like (kısık ses))
    const nameMatch = lineWithoutExclamation.match(/^([^:(]+?)(?:\s*\([^)]+\))*\s*:/);
    const speakerName = nameMatch ? nameMatch[1].trim() : '';

    // Check if the line contains (to CharacterName) format
    const toSectionPattern = /\(to [^)]+\)/i;
    const hasToSection = toSectionPattern.test(lineWithoutExclamation);

    const normCurrent = normalizeTurkishForSearch(currentCharacterName);
    const normSpeaker = normalizeTurkishForSearch(speakerName);

    let mainColor = 'lightgrey';
    if (hasToSection) {
      const toSectionMatch = lineWithoutExclamation.match(toSectionPattern);
      const targetName = toSectionMatch ? toSectionMatch[0].match(/\(to ([^)]+)\)/i)[1].trim() : '';
      const normTarget = normalizeTurkishForSearch(targetName);

      // If the target is the current character, color as white (directed at you)
      if (normTarget === normCurrent) {
        mainColor = 'white';
      } else if (normSpeaker === normCurrent) {
        mainColor = 'white';
      }
    } else {
      if (normSpeaker === normCurrent) {
        mainColor = 'white';
      }
    }

    if (hasExclamation) {
      // For [!] lines, we need to handle the coloring differently
      // to avoid the wrapSpan function breaking down the HTML
      const restOfLine = lineWithoutExclamation;
      // Return HTML that won't be processed by makeTextColorable
      // Sanitize user input to prevent XSS
      const sanitizedRestOfLine = restOfLine.replace(/[<>&"']/g, function (match) {
        return {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&#x27;',
        }[match];
      });
      return `<span class="toyou colorable">[!]</span> <span class="${mainColor} colorable">${sanitizedRestOfLine}</span>`;
    }

    return wrapSpan(mainColor, line);
  }

  function replaceDashes(text) {
    return text.replace(/(\.{2,3}-|-\.{2,3})/g, '—');
  }

  function replaceCurlyApostrophes(text) {
    // More comprehensive approach: replace any character in the curly apostrophe Unicode range
    let result = text;
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      if (charCode >= 8216 && charCode <= 8219 && charCode !== 39) {
        result = result.replace(text[i], "'");
      }
    }

    result = result.replace(/['''']/g, "'");

    return result;
  }

  // Extract character names from chatlog lines using reliable literal patterns.
  // Scans "Name says" lines, Turkish dialogue lines, and correctly-spaced "> Name emote" lines.
  function extractNamesFromChatlog(lines) {
    const names: any = new Set();
    for (const rawLine of lines) {
      const line = stripColorPrefixes(rawLine)
        .replace(/^\[!\]\s*/, '')
        .replace(/^!\s*/, '');
      // "Jack Russo says:" / "Jack Russo says (low):" / etc.
      const saysMatch = line.match(
        /^([A-ZÇĞİÖŞÜ][a-zçğışöü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]+)+)\s+says\b/
      );
      if (saysMatch) names.add(saysMatch[1]);

      // Dialogue match: "Jack Russo: ..." / "Jack Russo (kısık ses): ..."
      const dialogueMatch = line.match(
        /^([A-ZÇĞİÖŞÜ][a-zçğışöü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]+)+)(?:\s*\([^)]+\))*\s*:/
      );
      if (dialogueMatch) names.add(dialogueMatch[1]);

      // "> Jack Russo devam eder." (already correctly spaced ame line)
      const ameMatch = line.match(
        /^>\s+([A-ZÇĞİÖŞÜ][a-zçğışöü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]+)+)\s+/
      );
      if (ameMatch) names.add(ameMatch[1]);
    }
    return names;
  }

  // Known "merge starters": text fragments (action verbs and common ame openers)
  // that frequently get glued to a character name in raw logs. Extend as needed.
  const ameMergeStarters = [
    'güler',
    'gülümser',
    'sırıtır',
    'bakar',
    'bakınır',
    'izler',
    'döner',
    'kalkar',
    'oturur',
    'yürür',
    'koşar',
    'durur',
    'bekler',
    'gider',
    'gelir',
    'girer',
    'çıkar',
    'alır',
    'verir',
    'tutar',
    'bırakır',
    'çeker',
    'iter',
    'açar',
    'kapatır',
    'söyler',
    'sorar',
    'yanıtlar',
    'fısıldar',
    'mırıldanır',
    'homurdanır',
    'içer',
    'yer',
    'uzanır',
    'eğilir',
    'doğrulur',
    'sarılır',
    'öper',
    'sallar',
    'ovuşturur',
    'ikili',
    'içeri',
    'içeriye',
    'ilerler',
    'işaret',
    'iner',
    'ister',
    'izin',
    'işi',
    'laf',
    'elini',
    'ellerini',
    'başını',
    'gözlerini',
    'bakışlarını',
    'cebinden',
    'ceketinden',
    'masadan',
    'sandalyeden',
    'önüne',
    'arkasına',
    'yanına',
    'ayağa',
    'oturduğu',
    'konuşurken',
    'arasında',
    'hızlıca',
    'yavaşça',
    'bir',
    'iki',
    'telefonunu',
    'sigarasını',
    'kadehi',
    'şişeyi',
    'bardağı',
  ];

  // Fix the spacing on a ">" ame line so the character name is separated from the
  // action text glued to it. 1) known/detected names (short-circuit); 2) heuristic
  // fallback on the surname token only (lowercase→uppercase boundary + known merge
  // starter glued to the end); 3) leave untouched if not confident. Trailing
  // punctuation always stays attached.
  function splitAmeLine(line, names) {
    const cleanLine = stripColorPrefixes(line);
    if (!cleanLine.startsWith('>')) return line;
    const prefixMatch = line.match(/^!?\{#?[0-9A-Fa-f]{6}\}\s*/i);
    const colorPrefix = prefixMatch ? prefixMatch[0] : '';
    line = cleanLine;

    const TRAIL_PUNCT = '.,!?;:\'"…)\\]}';

    // Step 0: normalize the marker to a single space before a letter.
    line = line.replace(/^>\s*(?=\p{L})/u, '> ');

    // Step 1: known/detected name (longest first).
    let recognized = false;
    const sorted: any = [...new Set(names)].sort((a: any, b: any) => b.length - a.length);
    for (const name of sorted) {
      if (!name || !name.trim()) continue;
      const pat = makeTurkishCaseInsensitivePattern(name);
      if (!new RegExp(`^> ${pat}`, 'i').test(line)) continue;
      const split = line.replace(new RegExp(`^(> ${pat})([^\\s${TRAIL_PUNCT}])`, 'i'), '$1 $2');
      if (split !== line) return colorPrefix + split;
      recognized = true;
    }
    if (recognized) return colorPrefix + line;

    // Step 2: heuristic fallback — only the surname token (word after first name).
    const m = line.match(/^(>\s+\S+\s+)(\S+)(.*)$/);
    if (!m) return colorPrefix + line;
    const [, head, surnameToken, tail] = m;

    const pm = surnameToken.match(/^(.*?)([.,!?;:'"…)\]}]*)$/u);
    const core = pm[1];
    const trailPunct = pm[2];
    if (!core) return colorPrefix + line;

    // H1: split glued proper nouns at a lowercase→uppercase boundary.
    let result = core.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2');

    // H2: split a known merge-starter glued to the end of the last fragment.
    const segs = result.split(' ');
    const last = segs[segs.length - 1];
    let best = null;
    for (const sw of ameMergeStarters) {
      if (last.length <= sw.length) continue;
      if (normalizeTurkishForSearch(last.slice(-sw.length)) !== normalizeTurkishForSearch(sw))
        continue;
      const pfx = last.slice(0, last.length - sw.length);
      if (pfx.length >= 2 && /^\p{Lu}/u.test(pfx) && (!best || sw.length > best.len)) {
        best = { len: sw.length, pfx, starter: last.slice(pfx.length) };
      }
    }
    if (best) {
      segs[segs.length - 1] = `${best.pfx} ${best.starter}`;
      result = segs.join(' ');
    }

    if (result === core) return colorPrefix + line;
    return colorPrefix + head + result + trailPunct + tail;
  }

  // The parser sometimes emits the same ">" ame line twice in a row — once spaced,
  // once glued — differing only in whitespace. Drop the later duplicate, keeping the
  // first. Only consecutive ame lines are compared, so legit repeats are left alone.
  function dedupeAmeLines(lines) {
    const collapse = (s) => stripColorPrefixes(s).replace(/\s+/g, '');
    const out = [];
    let prevAmeKey = null;
    for (const line of lines) {
      const cleanLine = stripColorPrefixes(line);
      if (cleanLine.startsWith('>')) {
        const key = collapse(line);
        if (key && key === prevAmeKey) continue;
        prevAmeKey = key;
      } else {
        prevAmeKey = null;
      }
      out.push(line);
    }
    return out;
  }

  // ===== Opsec (Anonymization) =====
  function applyOpsec(text) {
    if (!text) return '';
    const lines = text.split('\n');
    const detectedNames = extractNamesFromChatlog(lines);

    for (const line of lines) {
      const radioMatch = line.match(
        /\[R(?:C|S|)\s*:[^\]]*\]\s*([A-ZÇĞİÖŞÜ][a-zçğışöü]+ [A-ZÇĞİÖŞÜ][a-zçğışöü]+)/i
      );
      if (radioMatch) detectedNames.add(radioMatch[1]);
    }

    const sortedNames: any = [...detectedNames].filter(Boolean).sort((a, b) => b.length - a.length);

    return lines
      .map((line) => {
        let result = line;

        // 1. Radio speaker names: [R: ...] Firstname Lastname:
        result = result.replace(
          /(\[R(?:C|S|)\s*:[^\]]*\]\s*)([A-ZÇĞİÖŞÜ][a-zçğışöü]+ [A-ZÇĞİÖŞÜ][a-zçğışöü]+)(?=:)/gi,
          (m, pfx, name) => `${pfx}÷${name}÷`
        );

        // 2. Detected character names
        for (const name of sortedNames) {
          if (!name) continue;
          const pat = makeTurkishCaseInsensitivePattern(name);
          const nameRegex = new RegExp(`(?<![÷\\w])${pat}(?![÷\\w])`, 'gi');
          result = result.replace(nameRegex, (m) => `÷${m}÷`);
        }

        // 3. Phone numbers: PH: 1234567, PH: 123-4567, or 6-8 digit standalone numbers
        result = result.replace(
          /(?<!÷)(\b(?:PH:?|Phone:?|Tel:?)\s*\d{3,8}(?:-\d{3,8})?|\b\d{3}[- ]\d{3,4}\b|\b\d{6,8}\b)(?!÷)/gi,
          '÷$1÷'
        );

        result = result.replace(/÷{2,}/g, '÷');
        return result;
      })
      .join('\n');
  }

  function removeOpsec(text) {
    if (!text) return '';
    return text.replace(/÷/g, '');
  }

  function handleOpsecClick() {
    const currentVal = $textarea.val();
    if (!currentVal || !currentVal.trim()) return;

    if (currentVal.includes('÷')) {
      const unwrapped = removeOpsec(currentVal);
      $textarea.val(unwrapped);
      $opsecBtn.removeClass('active');
      $output.removeClass('opsec-active');
      ChatlogParser.opsecActive = false;
    } else {
      const opsecVal = applyOpsec(currentVal);
      $textarea.val(opsecVal);
      $opsecBtn.addClass('active');
      $output.addClass('opsec-active');
      ChatlogParser.opsecActive = true;

      if (censorStyle === 'none') {
        censorStyle = 'remove';
        localStorage.setItem('chatlogCensorStyle', censorStyle);
        updateCensorStyleUI();
      }
    }
    processOutput();
  }

  // ===== GTAW Look =====
  function updateGtawLookUI() {
    if (!$toggleGtawLookBtn.length) return;
    if (gtawLookActive) {
      $toggleGtawLookBtn.addClass('active');
      $toggleGtawLookBtn.find('.gtaw-look-text').text('GTAW: Açık');
      $output.addClass('gtaw-look-active');
    } else {
      $toggleGtawLookBtn.removeClass('active');
      $toggleGtawLookBtn.find('.gtaw-look-text').text('GTAW: Kapalı');
      $output.removeClass('gtaw-look-active');
    }
  }

  function toggleGtawLook() {
    gtawLookActive = !gtawLookActive;
    localStorage.setItem('chatlogGtawLook', gtawLookActive ? 'true' : 'false');
    updateGtawLookUI();
    processOutput();
  }

  // ===== Chat Filter & Speaker Drop =====
  function getSpeakerFromLine(rawLine) {
    if (!rawLine) return null;
    const line = stripColorPrefixes(rawLine)
      .replace(/^\[!\]\s*/, '')
      .replace(/^!\s*/, '')
      .trim();

    const radioMatch = line.match(
      /^\[R(?:C|S|)\s*:[^\]]*\]\s*([A-ZÇĞİÖŞÜ][a-zçğışöü]+ [A-ZÇĞİÖŞÜ][a-zçğışöü]+):/i
    );
    if (radioMatch) return radioMatch[1].trim();

    const saysMatch = line.match(
      /^([A-ZÇĞİÖŞÜ][a-zçğışöü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]+)+)\s+says\b/i
    );
    if (saysMatch) return saysMatch[1].trim();

    const dialogueMatch = line.match(
      /^([A-ZÇĞİÖŞÜ][a-zçğışöü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]+)+)(?:\s*\([^)]+\))*\s*:/i
    );
    if (dialogueMatch) return dialogueMatch[1].trim();

    const ameMatch = line.match(
      /^>\s+([A-ZÇĞİÖŞÜ][a-zçğışöü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]+)+)\s+/i
    );
    if (ameMatch) return ameMatch[1].trim();

    return null;
  }

  function classifyLine(rawLine) {
    if (!rawLine) return 'other';
    const line = rawLine.trim();
    const lowerLine = normalizeTurkishForSearch(line);

    if (
      /^\(\(.*\)\)$/.test(line) ||
      lowerLine.startsWith('(( [ooc]') ||
      line.includes('PM from') ||
      line.includes('PM to') ||
      lowerLine.includes('gelen pm:') ||
      lowerLine.includes('gönderilen pm:')
    ) {
      return 'ooc';
    }

    if (
      /\[R(?:C|S|)\s*:[^\]]*\]/i.test(line) ||
      /\[CH:\s*[^\]]*\]/i.test(line) ||
      line.startsWith('[D]') ||
      line.startsWith('[DEP]') ||
      line.startsWith('[MDC]') ||
      line.startsWith('[DEPARTMAN]')
    ) {
      return 'radio';
    }

    if (
      line.startsWith('[AD]') ||
      line.startsWith('[REKLAM]') ||
      line.startsWith('[Advertisement]') ||
      lowerLine.includes('reklam:') ||
      lowerLine.includes('ilan:')
    ) {
      return 'ads';
    }

    if (
      lowerLine.includes('(telefon)') ||
      lowerLine.includes('(telefon - hoparlör)') ||
      lowerLine.includes('(phone)') ||
      lowerLine.includes('kişisinden mesaj:') ||
      lowerLine.includes('kişisine gönderilen mesaj:') ||
      lowerLine.includes('incoming call from') ||
      lowerLine.includes('adlı kişiden gelen arama') ||
      lowerLine.includes('[sms]')
    ) {
      return 'phone';
    }

    if (
      lowerLine.includes('you received $') ||
      lowerLine.includes('you have received $') ||
      lowerLine.includes('you gave $') ||
      lowerLine.includes('you paid $') ||
      lowerLine.includes('transfer başarıyla') ||
      (lowerLine.includes('hesabına') && lowerLine.includes('aktarıldı')) ||
      line.startsWith('Cüzdan:') ||
      line.startsWith('Banka:') ||
      line.startsWith('Toplam Varlık:') ||
      line.startsWith('You have withdrawn $') ||
      line.startsWith('You have deposited $')
    ) {
      return 'transactions';
    }

    if (
      line.includes('Panda Point') ||
      line.includes('[XM Radio]') ||
      line.includes('Mülkün kapısının') ||
      line.includes('/outfitname') ||
      line.includes('/pattributes') ||
      line.includes('sunucudan ayrıldı') ||
      line.includes('Use /anim stop') ||
      line.includes('Oyuncu(lar) bulunamadı') ||
      line.startsWith('==================')
    ) {
      return 'system';
    }

    return 'dialogue';
  }

  function filterChatlog(lines, options: any = {}) {
    const {
      hideOoc = false,
      hideRadio = false,
      hideAds = false,
      hidePhone = false,
      hideTransactions = false,
      hideSystem = false,
      excludedSpeakers = new Set(),
    } = options;

    const excludedSet =
      excludedSpeakers instanceof Set ? excludedSpeakers : new Set(excludedSpeakers || []);

    const normExcluded = new Set([...excludedSet].map((s) => normalizeTurkishForSearch(s)));

    return lines.filter((line) => {
      if (!line || !line.trim()) return true;

      if (normExcluded.size > 0) {
        const speaker = getSpeakerFromLine(line);
        if (speaker && normExcluded.has(normalizeTurkishForSearch(speaker))) {
          return false;
        }
      }

      const category = classifyLine(line);
      if (hideOoc && category === 'ooc') return false;
      if (hideRadio && category === 'radio') return false;
      if (hideAds && category === 'ads') return false;
      if (hidePhone && category === 'phone') return false;
      if (hideTransactions && category === 'transactions') return false;
      if (hideSystem && category === 'system') return false;

      return true;
    });
  }

  const $filterModal = $('#filterModal');
  const excludedSpeakers = new Set();

  function openFilterModal() {
    const rawText = $textarea.val();
    const lines = rawText.split('\n').filter((l) => l.trim().length > 0);

    let oocCount = 0;
    let radioCount = 0;
    let adsCount = 0;
    let phoneCount = 0;
    let transCount = 0;
    let systemCount = 0;
    const speakerCounts = new Map();

    lines.forEach((line) => {
      const cat = classifyLine(line);
      if (cat === 'ooc') oocCount++;
      else if (cat === 'radio') radioCount++;
      else if (cat === 'ads') adsCount++;
      else if (cat === 'phone') phoneCount++;
      else if (cat === 'transactions') transCount++;
      else if (cat === 'system') systemCount++;

      const speaker = getSpeakerFromLine(line);
      if (speaker) {
        speakerCounts.set(speaker, (speakerCounts.get(speaker) || 0) + 1);
      }
    });

    $('#countOoc').text(oocCount);
    $('#countRadio').text(radioCount);
    $('#countAds').text(adsCount);
    $('#countPhone').text(phoneCount);
    $('#countTransactions').text(transCount);
    $('#countSystem').text(systemCount);

    const $speakerList = $('#filterSpeakerList');
    $speakerList.empty();
    $('#speakerSummary').text(`${speakerCounts.size} konuşmacı bulundu`);

    if (speakerCounts.size === 0) {
      $speakerList.html(
        '<p style="color: #64748b; font-size: 12px; margin: 8px 0; text-align: center;">Konuşmacı bulunamadı veya henüz log girilmedi.</p>'
      );
    } else {
      const sortedSpeakers = [...speakerCounts.entries()].sort((a, b) => b[1] - a[1]);
      sortedSpeakers.forEach(([speaker, count]) => {
        const isExcluded = excludedSpeakers.has(speaker);
        const $row = $(`
          <div class="filter-speaker-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.04); padding: 6px 10px; border-radius: 4px; ${isExcluded ? 'opacity: 0.5; text-decoration: line-through;' : ''}">
            <span style="font-size: 12.5px; color: #e2e8f0; font-weight: 500;">
              ${escapeHTML(speaker)} <span style="font-size: 11px; color: #94a3b8;">(${count} satır)</span>
            </span>
            <button type="button" class="button small ${isExcluded ? 'secondary' : 'alert'} filter-drop-speaker-btn" data-speaker="${escapeHTML(speaker)}" style="margin: 0; padding: 3px 8px; font-size: 11px;">
              ${isExcluded ? 'Geri Al' : 'Çıkar'}
            </button>
          </div>
        `);
        $speakerList.append($row);
      });

      $speakerList.find('.filter-drop-speaker-btn').on('click', function () {
        const spk = $(this).attr('data-speaker');
        if (excludedSpeakers.has(spk)) {
          excludedSpeakers.delete(spk);
        } else {
          excludedSpeakers.add(spk);
        }
        openFilterModal();
      });
    }

    $filterModal.fadeIn(150);
  }

  function closeFilterModal() {
    $filterModal.fadeOut(150);
  }

  $('#closeFilterModal, #cancelFilterBtn, #filterModalBackdrop').on('click', closeFilterModal);

  $('#filterResetAllBtn').on('click', function () {
    $(
      '#filterOoc, #filterRadio, #filterAds, #filterPhone, #filterTransactions, #filterSystem'
    ).prop('checked', true);
    excludedSpeakers.clear();
    openFilterModal();
  });

  $('#applyFilterModalBtn').on('click', function () {
    const rawText = $textarea.val();
    const lines = rawText.split('\n');

    const hideOoc = !$('#filterOoc').is(':checked');
    const hideRadio = !$('#filterRadio').is(':checked');
    const hideAds = !$('#filterAds').is(':checked');
    const hidePhone = !$('#filterPhone').is(':checked');
    const hideTransactions = !$('#filterTransactions').is(':checked');
    const hideSystem = !$('#filterSystem').is(':checked');

    const filteredLines = filterChatlog(lines, {
      hideOoc,
      hideRadio,
      hideAds,
      hidePhone,
      hideTransactions,
      hideSystem,
      excludedSpeakers,
    });

    $textarea.val(filteredLines.join('\n'));
    closeFilterModal();
    processOutput();
  });

  function processOutput() {
    const chatText = $textarea.val();
    const chatLines = chatText
      .split('\n')
      .map(removeTimestamps)
      .map(stripColorPrefixes)
      .map(replaceDashes)
      .map(replaceCurlyApostrophes);

    const chatlogNames = extractNamesFromChatlog(chatLines);

    const dedupedLines = dedupeAmeLines(chatLines);

    const fragment = document.createDocumentFragment();

    let lastFoundIndex = -1;

    dedupedLines.forEach((line) => {
      if (line.startsWith('>')) {
        const charName = $characterNameInput.val().trim();
        const savedNames = JSON.parse(localStorage.getItem('characterNameList') || '[]');

        // Merge: active name + saved list + auto-detected from chatlog, longest-first
        const allNames = [
          ...new Set([...(charName ? [charName] : []), ...savedNames, ...chatlogNames]),
        ].sort((a, b) => b.length - a.length);

        line = splitAmeLine(line, allNames);
      }
      if (line.includes('Any abuse of the editor will result in harsh admin punishment.')) return;
      if (line.includes('was kicked for:') || line.includes('was banned for:')) return;
      if (line.startsWith('[ANTI-FALL]')) return;
      if (line.startsWith('[HATA]')) return;
      if (line.startsWith('(( Gelen PM') || line.startsWith('(( Giden PM')) return;
      if (line.startsWith('(( PM ←') || line.startsWith('(( PM →')) return;
      if (/^\(\(\s*\(\d+\)\s*.+\)\)$/.test(line)) return;

      if (hideSystemMessages) {
        if (line.includes('Panda Point kazandın')) return;
        if (line.includes('[XM Radio]')) return;
        if (line.startsWith('(( Dedektör')) return;
        if (
          line.includes('Mülkün kapısının kilidini açtın.') ||
          line.includes('Mülkün kapısını kilitledin.')
        )
          return;
        if (line.includes('Evinizdeki eşya için /stashinfo bilgisi belirtmediniz')) return;
        if (line.includes('/outfitname komutunu kullanabilirsin')) return;
        if (
          line.includes(
            'İmleci etkinleştirmek için F3 kullan. İmleç için /pc komutunu da kullanabilirsin.'
          )
        )
          return;
        if (line.includes('Mülküne hoş geldin.')) return;
        if (line.includes('/pattributes komutuyla mülkünün özelliklerini')) return;
        if (line.includes('edilmesi gereken detaylar) tarif edebilirsin')) return;
        if (line.includes('kullanıma sahiptir, karıştırmayınız.')) return;
        if (line.includes('Aracın yerini kolayca tespit edebilmen için haritanda işaretlendi.'))
          return;

        // Orijinal Animasyon / Komut Uyarıları
        if (line.includes('Use /anim stop to stop animations')) return;
        if (line.includes('[BİLGİ] If you will ever want to save that or other custom animations'))
          return;
        if (line.includes('Oyuncu(lar) bulunamadı.')) return;
        if (line.includes('Bu komutu kullanmak için iznin bulunmuyor.')) return;
        if (line.includes('(/tvv)olume')) return;
        if (line.startsWith('[ARKADAŞ]')) return;
        if (line.startsWith('Çevrimiçi arkadaşların:')) return;
        if (line.startsWith('⚠')) return;
        if (line.includes('sunucudan ayrıldı.')) return;
        if (line.includes('karakterini değiştirmek için çıkış yaptı.')) return;
        if (
          line.includes(
            'Animasyonları durdurmak ve elinde bulunan eşyaları kaldırmak için /anim stop komutunu kullanabilirsin.'
          )
        )
          return;
        if (
          line.includes('Animasyonların yanlış kullanımı sonucunda yasaklanabilirsin, dikkatli ol.')
        )
          return;
        if (line.includes('⚠️Artık dondurmanızı kaldırmak için K tuşuna basabilirsiniz')) return;
        if (
          line.includes("⚠️K'ye basarak dondurmanı açabilirsin. Bunu yaparken W'ye basılı tutma.")
        )
          return;
        if (
          line.includes(
            'Sahibi olmadığı için kilitli bir mülke girdin. Bu mülkü dilersen satın alabilirsin.'
          )
        )
          return;
        if (line.includes('[INFO] Animasyonları durdurmak ve elinde bulunan eşyaları')) return;
        if (line.includes('[BİLGİ] Ayrıca /anim list veya /anim2 ile modern ve gelişmiş')) return;
        if (line.includes('[HATA] Belirtilen animasyon bulunamadı.')) return;
        if (line.includes("Sohbeti yeniden başlatmak için F2'yi ve imleci görünür")) return;
        if (line.includes('Artık /vget komutunu kullanabilirsin.')) return;
        if (line.includes('(( BU KOMUTUN YANLIŞ KULLANIMI SONUCUNDA YASAKLANIRSIN. ))')) return;
        if (line.includes('[BİLGİ] Kaydettiğin favori şapkanı giymek için /şapka özel')) return;
        if (line.includes('[HATA] Bu telefon kilitli.')) return;
        if (line.includes('Eğer birlik üyelerini eski (sohbet) üzerinden görmek istiyorsan'))
          return;

        // -- YENİ EKLENEN FİLTRELER --
        if (line.includes('Panda Point kazandın')) return;
        if (line.startsWith('Welcome')) return;
        if (line.includes('[XM Radio]')) return;
        if (line.includes('Kapıyı kilitledin.') || line.includes('Kapının kilidini açtın.')) return;
        if (line.includes('Evinizdeki eşya için /stashinfo bilgisi belirtmediniz')) return;
        if (line.includes('/outfitname komutunu kullanabilirsin')) return;
        if (line.includes('Mülküne hoş geldin.')) return;
        if (line.includes('/pattributes komutuyla mülkünün özelliklerini')) return;
        if (line.includes('edilmesi gereken detaylar) tarif edebilirsin')) return;
        if (line.includes('kullanıma sahiptir, karıştırmayınız.')) return;
        if (line.includes('Aracın yerini kolayca tespit edebilmen için haritanda işaretlendi.'))
          return;

        if (line.startsWith('[ANTI-FALL]')) return;
        if (line.startsWith('[HATA]')) return;
        if (line.startsWith('[DATE:')) return;
        if (line.startsWith('[TV]')) return;
        if (line.includes('Eğer bunu daha sonrası için kaydedipve')) return;
        if (line.includes('Bu mülkün sahibi değilsin')) return;
        if (line.startsWith('Hiçbir arkadaşın çevirmiçi değil.')) return;
        if (line.startsWith('Üzerinde bir silah yok.')) return;
        if (line.startsWith('GTA World Türkiye')) return;
        if (line.startsWith('Oyuncu ID')) return;
        if (line.startsWith('[GALERI]')) return;
        if (line.startsWith('USAGE')) return;
        if (line.includes('GTAW Roleplay Oyuncu İstatistikleri')) return;
        if (line.includes('ALPR bildirimlerinin')) return;
        if (line.includes('Kapı zili ses seviyesini')) return;
        if (line.includes('Kapı tıklatma ses seviyesini')) return;
        if (line.includes('Sohbet yazı boyutu')) return;
        if (line.includes('Karakter | Nakit: $') || line.includes('Sağlık | Can:')) return;
        if (line.includes('Banka Hesap Numarası:')) return;
        if (line.includes('Şu anki işi:')) return;
        if (line.includes('Zaman | Toplam saat:')) return;
        if (line.includes('Çalışılan süre:')) return;
        if (line.includes('Mülkler |')) return;
        if (line.includes('Custom Number:')) return;
        if (line.includes('Main Phone Number:')) return;
        if (line.includes('Özel Numara:')) return;
        if (line.includes('Ana Telefon Numarası:')) return;
        if (line.startsWith('Your')) return;
        if (line.includes('şu an çevrimiçi | Çevrimiçi Uyarıları')) return;
        if (line.includes('Çevrimiçi Uyarıları')) return;
        if (line.includes('adlı oyuncunun ID')) return;
        if (line.includes('Premium:')) return;
        if (line.includes('Obje Slotu:')) return;
        if (line.includes('Kıyafet Slotu:')) return;
        if (line.includes('World Point:')) return;
        if (line.includes('Panda Point:')) return;
        if (line.includes('TARİH: Sunucu zamanı:')) return;
        if (line.includes('Son 15 günde geçirilen süre')) return;
        if (line.includes('Suç Puanı:')) return;
        if (line.includes('=========================================================')) return;
        if (line.includes('Bu komutla camları açıp kapatabilirsin.')) return;
        if (line.includes('/vwindow [cam]')) return;
        if (line.startsWith('[AFK')) return;
        if (line.startsWith('Admin')) return;
        if (line.includes('[buraya özel animasyon adını yaz]')) return;
        if (line.includes('karakter modelini değiştirmek için Y.')) return;
        if (line.includes('kWh başına fiyat | Kamu Kullanım Vergisi')) return;
        if (line.startsWith('/recharge')) return;
        if (line.startsWith('KULLANIM:')) return;
        if (line.startsWith('DIKKAT:')) return;
        if (line.startsWith('BAĞLANTI:')) return;
        if (line.startsWith('Kapı kilitli.')) return;
        if (line.startsWith('Bunu yapamazsın.')) return;
        if (line.startsWith('Mülk/araç girişine ışınlandın.')) return;
        if (line.startsWith('Şu an hiçbir online yönetici bulunmamaktadır.')) return;
        if (
          line.startsWith('[Güvenlik]') ||
          line.startsWith('[Genel]') ||
          line.startsWith('[Eklentiler]') ||
          line.startsWith('[Diğer]') ||
          line.startsWith('[Kir]')
        ) {
          return;
        }
        if (line.includes('BİLGİ:') && !/\[\d{1,2}\/[^\]\/\s]+\/\d{4}\]/.test(line)) return;
        if (
          line.includes(
            'Aracın ortalama benzin harcamasını görmek için /getfuelconsumption komutunu kullanabilirsin.'
          )
        )
          return;
        if (
          line.startsWith(
            'Artık /anim smoke1 - smoke8 veya /anim joint1 - joint6 aninmasyonlarını 10 dakika'
          )
        )
          return;

        if (line.startsWith('(( Gelen PM') || line.startsWith('(( Giden PM')) return;
        if (/^\(\(\s*\(\d+\)\s*.+\)\)$/.test(line)) return;
      }

      // 2. SATIR FORMATLAMA VE HTML OLUŞTURMA

      // Find the original index of this line in chatLines (to preserve textarea mapping)
      let originalLineIndex = -1;
      for (let i = lastFoundIndex + 1; i < chatLines.length; i++) {
        if (chatLines[i] === line) {
          originalLineIndex = i;
          lastFoundIndex = i;
          break;
        }
      }

      const div = document.createElement('div');
      div.className = 'generated';
      // Store original line text for stable color override matching
      div.setAttribute('data-source-line', line);
      if (originalLineIndex !== -1) {
        div.setAttribute('data-line-index', originalLineIndex as any);
      }

      // Check if this is a [!] line first, before any other processing
      if (line.startsWith('[!]')) {
        const currentCharacterName = $('#characterNameInput').val().trim();
        const lineWithoutExclamation = line.substring(3).trim();

        // Extract the speaker's name (before 'says' or colon, ignoring parentheticals like (kısık ses))
        const nameMatch = lineWithoutExclamation.match(
          /^([^:(]+?)(?:\s*\([^)]+\))*\s*(?:says\b|:)/
        );
        const speakerName = nameMatch ? nameMatch[1].trim() : '';

        // Check if the line contains (to CharacterName) format
        const toSectionPattern = /\(to [^)]+\)/i;
        const hasToSection = toSectionPattern.test(lineWithoutExclamation);

        const normCurrent = normalizeTurkishForSearch(currentCharacterName);
        const normSpeaker = normalizeTurkishForSearch(speakerName);

        let mainColor;
        if (disableCharacterNameColoring) {
          mainColor = 'white';
        } else if (hasToSection) {
          const toSectionMatch = lineWithoutExclamation.match(toSectionPattern);
          const targetName = toSectionMatch
            ? toSectionMatch[0].match(/\(to ([^)]+)\)/i)[1].trim()
            : '';
          const normTarget = normalizeTurkishForSearch(targetName);

          // If the target is the current character, color as white (directed at you)
          if (normTarget === normCurrent) {
            mainColor = 'white';
          } else {
            mainColor = normSpeaker === normCurrent ? 'white' : 'lightgrey';
          }
        } else {
          if (normSpeaker === normCurrent) {
            mainColor = 'white';
          } else {
            mainColor = 'lightgrey';
          }
        }

        // Add colorable class to make spans selectable for letter-by-letter coloring
        // Sanitize user input to prevent XSS
        const sanitizedLine = lineWithoutExclamation.replace(/[<>&"']/g, function (match) {
          return {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;',
          }[match];
        });
        const formattedHTML = `<span class="toyou colorable">[!]</span> <span class="${mainColor} colorable">${sanitizedLine}</span>`;
        div.innerHTML = addLineBreaksAndHandleSpans(formattedHTML);
        // Don't add no-colorable class since we want these spans to be colorable
      } else {
        let formattedLine = formatLineWithFilter(line);

        // Apply censorship after formatting to catch plain lines
        formattedLine = applyUserCensorship(formattedLine);
        div.innerHTML = addLineBreaksAndHandleSpans(formattedLine);
      }

      fragment.appendChild(div);

      const clearDiv = document.createElement('div');
      clearDiv.className = 'clear';
      fragment.appendChild(clearDiv);
    });

    saveColorOverrides();

    $output.html('');
    $output.append(fragment);
    cleanUp();

    makeTextColorable();

    restoreColorOverrides();
  }

  // Save user-applied colors to the colorOverrides Map
  // Uses source line (from textarea) + word content + position for stable matching
  function saveColorOverrides() {
    // Group by parent .generated div to get original line from data-source-line
    $output.find('.generated[data-source-line]').each(function () {
      const $generatedDiv = $(this);
      const sourceLine = $generatedDiv.attr('data-source-line');
      if (!sourceLine) return;

      let wordPositionInLine = 0;

      // Find ALL .colorable elements, not just ones with data-word-id
      $generatedDiv.find('.colorable').each(function () {
        const $el = $(this);
        const wordContent = $el.text().trim();
        if (!wordContent) return;

        if ($el.hasClass('user-colored')) {
          const classes = $el.attr('class') || '';
          const colorClass = classes
            .split(/\s+/)
            .find(
              (cls) =>
                cls !== 'colorable' &&
                cls !== 'unrecognized' &&
                cls !== 'selected-for-coloring' &&
                cls !== 'user-colored' &&
                [
                  'me',
                  'ame',
                  'darkgrey',
                  'grey',
                  'lightgrey',
                  'death',
                  'yellow',
                  'green',
                  'orange',
                  'blue',
                  'white',
                  'radioColor',
                  'radioColor2',
                  'depColor',
                  'vesseltraffic',
                  'toyou',
                ].includes(cls)
            );

          if (colorClass) {
            // Create a stable key based on: sourceLine|wordContent|position
            // sourceLine is the original textarea line, so it won't change when other lines change
            const stableKey = `${sourceLine}|${wordContent}|${wordPositionInLine}`;
            colorOverrides.set(stableKey, colorClass);
          }
        }

        wordPositionInLine++;
      });
    });
  }

  // Restore user-applied colors from the colorOverrides Map
  // Matches elements using source line (from data-source-line attribute)
  function restoreColorOverrides() {
    const elementsByKey = new Map();

    $output.find('.generated[data-source-line]').each(function () {
      const $generatedDiv = $(this);
      const sourceLine = $generatedDiv.attr('data-source-line');
      if (!sourceLine) return;

      let wordPositionInLine = 0;

      // Find ALL .colorable elements, not just ones with data-word-id
      $generatedDiv.find('.colorable').each(function () {
        const $el = $(this);
        const wordContent = $el.text().trim();
        if (!wordContent) return;

        // Use the same key format as saveColorOverrides
        const stableKey = `${sourceLine}|${wordContent}|${wordPositionInLine}`;
        elementsByKey.set(stableKey, $el);

        wordPositionInLine++;
      });
    });

    colorOverrides.forEach((colorClass, stableKey) => {
      const $el = elementsByKey.get(stableKey);
      if ($el && $el.length) {
        $el.removeClass(
          'me ame darkgrey grey lightgrey death yellow green orange blue white radioColor radioColor2 depColor vesseltraffic toyou'
        );
        $el.addClass(colorClass).addClass('user-colored');
      }
    });
  }

  // Make processOutput accessible to other modules
  ChatlogParser.processOutput = processOutput;

  function makeTextColorable() {
    let wordCounter = 0;

    $output.find('.generated').each(function (lineIndex) {
      const generatedDiv = $(this);

      // Artık satırları atlamıyoruz, çünkü her türlü HTML'in içinden geçebiliyoruz.
      if (generatedDiv.hasClass('no-colorable')) return;

      const textNodes = [];
      // TreeWalker: Sadece saf metin (text) node'larını bulur, HTML etiketlerini es geçer
      const walk = (document as any).createTreeWalker(
        generatedDiv[0],
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let n;
      while ((n = walk.nextNode())) {
        textNodes.push(n);
      }

      textNodes.forEach((textNode) => {
        const text = textNode.nodeValue;

        // Tamamen boşluktan oluşan alanları atla (kelime aralarındaki doğal boşluklar bozulmasın)
        if (!text.trim()) return;

        const parent = textNode.parentNode;

        // Eğer bu kelime zaten boyanabilir yapıldıysa veya sansürlüyse tekrar içine girme
        if (
          $(parent).hasClass('colorable') ||
          $(parent).hasClass('censored-content') ||
          $(parent).hasClass('unrecognized')
        ) {
          return;
        }

        // Ana HTML etiketinin class'larını miras al (örn: parent "blue" ise kelime de "blue" olarak boyanabilir kalsın)
        let parentClasses = '';
        if (parent.nodeName.toLowerCase() === 'span' && !$(parent).hasClass('generated')) {
          parentClasses = ($(parent).attr('class') || '').replace('colorable', '').trim();
        }

        const classString = parentClasses ? `${parentClasses} colorable` : 'colorable unrecognized';

        const tempDiv = document.createElement('div');
        const tokens = text.split(/(\s+)/g);

        const html = tokens
          .map((token) => {
            if (token === '') return '';
            if (/^\s+$/.test(token)) return token;

            // HTML karakterlerini (<, >, vs) bozmaması için güvenli hale getir
            const safeToken = token.replace(
              /[&<>"']/g,
              (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
            );
            const normalized = safeToken.replace(/[\u2018\u2019\u2032\u2035]/g, "'");

            // Separate trailing punctuation (e.g. word., word!, $16,000.)
            const punctMatch = normalized.match(/^(.*?)(([.,!?;:]+|\.{3}|…)+)$/);
            if (punctMatch && punctMatch[1].length > 0) {
              const wordPart = punctMatch[1];
              const punctPart = punctMatch[2];
              const wordId1 = `${lineIndex}-${wordCounter++}`;
              const wordId2 = `${lineIndex}-${wordCounter++}`;
              return `<span class="${classString}" data-word-id="${wordId1}">${wordPart}</span><span class="${classString}" data-word-id="${wordId2}">${punctPart}</span>`;
            }

            const wordId = `${lineIndex}-${wordCounter++}`;
            return `<span class="${classString}" data-word-id="${wordId}">${normalized}</span>`;
          })
          .join('');

        tempDiv.innerHTML = html;

        const fragment = document.createDocumentFragment();
        while (tempDiv.firstChild) {
          fragment.appendChild(tempDiv.firstChild);
        }

        parent.replaceChild(fragment, textNode);
      });
    });

    if (DEBUG_MODE)
      console.log(
        'Made text colorable - total colorable elements: ' + $output.find('.colorable').length
      );
  }

  // Make makeTextColorable accessible for the color palette
  ChatlogParser.makeTextColorable = makeTextColorable;
  ChatlogParser.removeTimestamps = removeTimestamps;
  ChatlogParser.stripColorPrefixes = stripColorPrefixes;
  ChatlogParser.replaceDashes = replaceDashes;
  ChatlogParser.replaceCurlyApostrophes = replaceCurlyApostrophes;

  function applyUserCensorship(line) {
    // Replace ÷ with a more reliable delimiter and handle edge cases
    try {
      const isOpsec = Boolean(ChatlogParser.opsecActive || $opsecBtn.hasClass('active'));
      const opsecClass = isOpsec ? ' opsec-censored' : '';
      return line.replace(/÷(.*?)÷/g, (match, p1) => {
        if (p1 && p1.trim()) {
          if (censorStyle === 'blur') {
            // Blur mode: colorable blurred text
            return `<span class="censored-content blur-mode colorable${opsecClass}" data-original="${p1.replace(/"/g, '&quot;')}">${p1}</span>`;
          }
          // Remove mode: invisible or opsec redaction bar
          return `<span class="censored-content censored-remove${opsecClass}" data-original="${p1.replace(/"/g, '&quot;')}">${p1}</span>`;
        }
        return match;
      });
    } catch (error) {
      // Fallback for browsers with regex issues
      console.warn('Censorship regex failed, using fallback method:', error);
      return line.replace(/÷/g, '÷');
    }
  }

  function removeTimestamps(line) {
    return line.replace(/\[\d{2}:\d{2}:\d{2}\] /g, '').trim();
  }

  function stripColorPrefixes(line) {
    return line.replace(/^!?\{#?[0-9A-Fa-f]{6}\}\s*(?=[*>])/i, '');
  }

  function formatLineWithFilter(line) {
    const cleanLine = line.replace(/÷(.*?)÷/g, '$1');
    const lowerLine = normalizeTurkishForSearch(cleanLine);

    const formattedLine = applySpecialFormatting(line, lowerLine);
    if (formattedLine) {
      return formattedLine;
    }

    const currentCharacterName = $('#characterNameInput').val().trim();
    const normCurrentCharacter = normalizeTurkishForSearch(currentCharacterName);
    if (normCurrentCharacter && normCurrentCharacter !== '' && /\bsays\b/.test(lowerLine)) {
      const lineWithoutExclamation = cleanLine.replace(/^\[!\]\s*/, '');

      // Extract the name before "says" and check if it matches the character name
      const nameMatch = lineWithoutExclamation.match(/^([^:]+?)\s+says/);
      const speakerName = nameMatch ? nameMatch[1].trim() : '';
      const normSpeaker = normalizeTurkishForSearch(speakerName);

      // Check if the line contains (to CharacterName) format
      const toSectionPattern = /\(to [^)]+\)/i;
      const hasToSection = toSectionPattern.test(lineWithoutExclamation);

      let mainColor;
      if (disableCharacterNameColoring) {
        mainColor = 'white';
      } else if (hasToSection) {
        const toSectionMatch = lineWithoutExclamation.match(toSectionPattern);
        const targetName = toSectionMatch
          ? toSectionMatch[0].match(/\(to ([^)]+)\)/i)[1].trim()
          : '';
        const normTarget = normalizeTurkishForSearch(targetName);

        // If the target is the current character, color as white (directed at you)
        if (normTarget === normCurrentCharacter) {
          mainColor = 'white';
        } else {
          mainColor = normSpeaker === normCurrentCharacter ? 'white' : 'lightgrey';
        }
      } else {
        if (normSpeaker === normCurrentCharacter) {
          mainColor = 'white';
        } else {
          mainColor = 'lightgrey';
        }
      }

      return wrapSpan(mainColor, line);
    }

    return formatLine(line);
  }

  function applySpecialFormatting(line, lowerLine) {
    const currentCharacterName = $('#characterNameInput').val().trim();
    const normCurrent = normalizeTurkishForSearch(currentCharacterName);

    // 1. ÖZEL CİHAZLAR & ÖNCELİKLİ FORMATLAR
    if (lowerLine.includes('interkom]:') || line.includes('İnterkom]:'))
      return formatIntercom(line);
    if (lowerLine.includes('[mikrofon]:')) return wrapSpan('yellow', line);
    if (lowerLine.includes('[megafon]:')) return wrapSpan('orange', line);

    // 2. HAVA DURUMU
    const weatherFormatted = formatWeatherLine(line);
    if (weatherFormatted) return weatherFormatted;

    // 3. SİSTEM MESAJLARI VE BİLGİ FORMATLARI
    if (line.startsWith('[ALERT] Lockdown activated!')) return wrapSpan('blue', line);
    if (line.startsWith('********** ACİL ÇAĞRI **********'))
      return `<span class="blue">${escapeHTML(line)}</span>`;

    if (lowerLine.includes('[telefon]')) {
      const match = line.match(/^(\[TELEFON\])\s*(.+)$/i);
      if (match) return wrapSpan('yellow', line);
    }

    // Tarihli Kapı / Mülk / Sistem Notu: [BİLGİ] : [05/MAY/2025] ... veya [INFO]: [05/MAY/2025] ...
    const infoDateMatch = line.match(
      /^(\[(?:B[İIiı]LG[İIiı]|INFO)\]\s*:?|(?:\b(?:B[İIiı]LG[İIiı]|INFO)\s*:))\s*(\[\d{1,2}\/[^\]/\s]+\/\d{4}\])\s*(.*)$/i
    );
    if (infoDateMatch) {
      const prefix = infoDateMatch[1].trim();
      const datePart = infoDateMatch[2].trim();
      const message = infoDateMatch[3].trim();
      return (
        wrapSpan('blue', prefix) +
        ' ' +
        wrapSpan('orange', datePart) +
        (message ? ' ' + wrapSpan('white', message) : '')
      );
    }

    if (line.startsWith('[BİLGİ]') || line.startsWith('BİLGİ:')) {
      const isBracket = line.startsWith('[BİLGİ]');
      const prefix = isBracket ? '[BİLGİ]' : 'BİLGİ:';
      let message = line.slice(prefix.length).trim();
      if (isBracket) message = message.replace(/\s+\(\(\d+\)\)$/, '');
      return wrapSpan('blue', prefix) + ' ' + wrapSpan('white', message);
    }

    if (line.startsWith('[GPS]'))
      return wrapSpan('green', '[GPS]') + wrapSpan('white', line.substring(5));

    if (lowerLine.startsWith('[info]')) {
      if (
        line.includes('contact') ||
        line.includes('shared your number') ||
        line.includes('/accept')
      ) {
        const specialInfo = colorInfoLine(line);
        if (specialInfo) return specialInfo;
      }
    }

    const clientLineRes = formatInGameClientLine(line);
    if (clientLineRes) return clientLineRes;

    // 4. KARAKTER DURUMLARI (Yaralı, Ölüm, Hapis vb.)
    if (line.includes('Şu an yaralı durumdasın.')) {
      const timeMatch = line.match(/^(\[\d{2}:\d{2}:\d{2}\]\s*|\d{2}:\d{2}:\d{2}\s*)/);
      const timePrefix = timeMatch ? timeMatch[1] : '';
      return (
        (timePrefix ? wrapSpan('white', timePrefix) : '') +
        wrapSpan('white', 'Şu an ') +
        wrapSpan('death', 'yaralı') +
        wrapSpan('white', ' durumdasın. İki dakika bekledikten sonra ') +
        wrapSpan('yellow', '/acceptdeath') +
        wrapSpan(
          'white',
          ' komutunu kullanıp ölümü kabul edebilir ya da birinin sana yardım etmesini bekleyebilirsin. Eğer yaralarını diğer oyunculara belirtmek istiyorsan '
        ) +
        wrapSpan('yellow', '/setinjuries') +
        wrapSpan('white', ' komutunu kullanabilirsin.')
      );
    }
    if (line.includes('Öldürüldünüz. 10 dakikanın ardından')) {
      return `<span class="death">Öldürüldünüz.</span> <span class="white">10 dakikanın ardından otomatik olarak tekrar doğabilir ya da iki dakika bekledikten sonra <span class="yellow">/respawn</span> komutunu kullanabilirsiniz.</span>`;
    }
    if (line === 'Injuries:') return wrapSpan('blue', line);

    // HİBRİT TETİKLEYİCİ: Hapishane (TR & EN)
    if (lowerLine.includes('left in jail') || lowerLine.includes('hapisten çıkmana')) {
      const jailRes = formatJailTime(line);
      if (jailRes) return jailRes;
    }

    const corpseDamageMatch = line.match(/^(.+?) \((ID)\) damages:/);
    if (corpseDamageMatch)
      return `<span class="blue">${escapeHTML(corpseDamageMatch[1])}</span><span class="white">${escapeHTML(line.slice(corpseDamageMatch[1].length))}</span>`;

    const youBeenShotMatch = line.match(
      /(.+?)\s+bölgesinden\s+(.+?)\s+tarafından\s+(.+?)\s+silahıyla\s+([\d.]+)\s+hasar\s+aldın\.\s+\(\(Can:\s+([\d.]+)\)\)/
    );
    if (youBeenShotMatch)
      return `<span class="death">${escapeHTML(youBeenShotMatch[1])}</span> <span class="white">bölgesinden</span> <span class="death">${escapeHTML(youBeenShotMatch[2])}</span> <span class="white">tarafından</span> <span class="death">${escapeHTML(youBeenShotMatch[3])}</span> <span class="white">silahıyla</span> <span class="death">${escapeHTML(youBeenShotMatch[4])}</span> <span class="white">hasar aldın. ((Can:</span> <span class="white">${escapeHTML(youBeenShotMatch[5])}</span><span class="white">))</span>`;

    // 5. İLETİŞİM (Telsiz, SMS, Fısıltı, Telefon)
    if (isRadioLine(line)) {
      if (!currentCharacterName) return wrapSpan('radioColor', line);
      return normCurrent && lowerLine.includes(normCurrent)
        ? wrapSpan('radioColor', line)
        : wrapSpan('radioColor2', line);
    }

    if (lowerLine.includes('(telefon) *')) return wrapSpan('me', line);
    if (lowerLine.includes('says (phone):') || lowerLine.includes('says (loudspeaker):'))
      return handleCellphone(line);
    if (line.includes('(Telefon - Hoparlör):') || line.includes('(telefon - Hoparlör):'))
      return wrapSpan('yellow', line);
    if (enableWhisperColoring) {
      if (line.includes('(kısık ses) (Telefon):') || line.includes('(kısık ses) (telefon):')) {
        return normCurrent && lowerLine.includes(normCurrent)
          ? wrapSpan('lightgrey', line)
          : wrapSpan('yellow', line);
      }
    }
    if (line.includes('(telefon):'))
      return normCurrent && lowerLine.includes(normCurrent)
        ? wrapSpan('white', line)
        : wrapSpan('yellow', line);

    if (enableWhisperColoring) {
      if (
        lowerLine.includes('(alçak ses)') ||
        lowerLine.includes('(alçak sesle)') ||
        lowerLine.includes('alçak sesle')
      ) {
        return normCurrent && lowerLine.includes(normCurrent)
          ? wrapSpan('grey', line)
          : wrapSpan('darkgrey', line);
      }
      if (
        lowerLine.includes('(kısık ses)') ||
        lowerLine.includes('(kısık sesle)') ||
        lowerLine.includes('kısık sesle')
      ) {
        return normCurrent && lowerLine.includes(normCurrent)
          ? wrapSpan('lightgrey', line)
          : wrapSpan('grey', line);
      }
      if (lowerLine.includes('says (kısık ses) (to')) {
        const saysIndex = lowerLine.indexOf('says');
        const nameBeforeSays = lowerLine.substring(0, saysIndex);
        if (normCurrent && nameBeforeSays.includes(normCurrent)) return wrapSpan('lightgrey', line);
        return wrapSpan('grey', line);
      }
      if (
        (lowerLine.includes('fısıldar') && !line.startsWith('*') && !line.startsWith('>')) ||
        line.startsWith('(Araç İçi)')
      ) {
        return handleWhispers(line);
      }
    }

    // SMS ve Çağrı
    if (lowerLine.includes('grubundan gelen mesaj:')) return wrapSpan('yellow', line);
    if (/\([^\)]+\) [^:]+ kişisine gönderilen mesaj: .+/.test(line))
      return formatOutgoingSmsMessage(line);
    if (/\([^\)]+\) [^:]+ kişisinden mesaj: .+/.test(line)) return formatSmsMessage(line);
    if (/\([^\)]+\) [^:]+ .+/.test(line)) return formatSmsReminderMessage(line);
    if (
      /\([^\)]+\) Incoming call from .+/.test(line) ||
      lowerLine.includes('adlı kişiden gelen arama') ||
      lowerLine.includes('tarafından gelen çağrı')
    )
      return formatIncomingCall(line);
    if (lowerLine.includes("you've set your main phone to")) return formatPhoneSet(line);
    if (lowerLine === 'çağrı cevaplandı.') return wrapSpan('yellow', line);
    if (lowerLine === 'aramayı sonlandırdın.' || lowerLine === 'karşı tarafı aramayı sonlandırdı.')
      return wrapSpan('white', line);
    if (lowerLine === 'aramayı kapattın.' || lowerLine === 'karşı tarafı aramayı kapattı.')
      return wrapSpan('white', line);

    const emergencyDetailMatch = line.match(
      /^\*\s*(Çağrı Numarası|Telefon Numarası|Konum|Durum):\s*(.*)$/
    );
    if (emergencyDetailMatch)
      return `<span class="blue">* ${escapeHTML(emergencyDetailMatch[1])}: </span><span class="white">${escapeHTML(emergencyDetailMatch[2])}</span>`;

    if (lowerLine.includes('[ch: vts - vessel traffic service]')) return formatVesselTraffic(line);

    // 6. BANKA / STATS / İSTATİSTİK PANELLERİ
    if (lowerLine.includes('nakit: $') && lowerLine.includes('banka: $')) {
      return `<span class="yellow">${escapeHTML(line)}</span>`;
    }

    if (/^\d+:\s/.test(line) && line.includes('[$')) {
      const safeLine = escapeHTML(line);
      const coloredLine = safeLine.replace(/(\[\$[\d,]+\])/g, '<span class="green">$1</span>');
      return `<span class="yellow">${coloredLine}</span>`;
    }

    if (lowerLine.includes('hava durumu:')) return wrapSpan('white', line);

    const cleanStatsLine = line.replace(/!?\{#?[0-9A-Fa-f]{6}\}/gi, '').trim();
    const lowerCleanStatsLine = normalizeTurkishForSearch(cleanStatsLine);

    const isStatsMenuLine =
      lowerCleanStatsLine.includes('istatistikler:') ||
      cleanStatsLine.startsWith('Cüzdan:') ||
      cleanStatsLine.startsWith('Sağlık |') ||
      cleanStatsLine.startsWith('Banka:') ||
      cleanStatsLine.startsWith('Toplam Varlık:') ||
      cleanStatsLine.startsWith('Oluşum:') ||
      cleanStatsLine.startsWith('Banka Hesap Numarası:') ||
      cleanStatsLine.startsWith('Mevcut İş:') ||
      cleanStatsLine.startsWith('Süre |') ||
      lowerCleanStatsLine.includes('işletme') ||
      cleanStatsLine.startsWith('Vardiya süresi:') ||
      cleanStatsLine.startsWith('Mülk') ||
      cleanStatsLine.startsWith('Araç') ||
      cleanStatsLine.startsWith('Ev ') ||
      cleanStatsLine.startsWith('Daire ') ||
      cleanStatsLine.startsWith('Özel Numara:') ||
      cleanStatsLine.startsWith('Ana Telefon Numarası:') ||
      cleanStatsLine.startsWith('Premium:') ||
      cleanStatsLine.startsWith('Obje Slotu:') ||
      cleanStatsLine.startsWith('Kıyafet Slotu:') ||
      cleanStatsLine.startsWith('World Point:') ||
      cleanStatsLine.startsWith('Panda Point:') ||
      cleanStatsLine.startsWith('Mevcut Saat:') ||
      cleanStatsLine.startsWith('Aylık ') ||
      cleanStatsLine.startsWith('Son 15 günde geçirilen süre') ||
      cleanStatsLine.startsWith('Suç Puanı:') ||
      (cleanStatsLine.startsWith('==============') && cleanStatsLine.length > 20);

    if (isStatsMenuLine) {
      let safeLine = escapeHTML(cleanStatsLine);
      safeLine = safeLine.replace(
        /(GTAW Roleplay Oyuncu İstatistikleri)/g,
        '<span class="yellow">$1</span>'
      );
      safeLine = safeLine.replace(
        /(^|\s)([a-zA-ZÇĞİÖŞÜçğıöşü]+)\s*\|/g,
        '$1<span class="yellow">$2</span> |'
      );
      safeLine = safeLine.replace(
        /([a-zA-ZÇĞİÖŞÜçğıöşü][a-zA-ZÇĞİÖŞÜçğıöşü0-9\s()<>=\-&;]*?)(?=:)/g,
        function (match) {
          return `<span class="yellow">${match}</span>`;
        }
      );
      safeLine = safeLine.replace(/(\$[\d,]+)/g, '<span class="green">$1</span>');
      return `<span>${safeLine}</span>`;
    }

    // 7. HİBRİT SİSTEMLER (TR & EN ORTAK)
    let hybRes;

    if (
      lowerLine.includes('etkilerini yakında hissedeceksin') ||
      lowerLine.includes('feel the effects')
    ) {
      hybRes = formatDrugEffect(line);
      if (hybRes) return hybRes;
    }

    if (
      lowerLine.includes('gösterdi') ||
      lowerLine.includes('gösterdin') ||
      lowerLine.includes('has shown you their')
    ) {
      hybRes = formatShown(line);
      if (hybRes) return hybRes;
    }

    if (
      lowerLine.includes('verdi') ||
      lowerLine.includes('verdin') ||
      lowerLine.startsWith('transfer başarıyla') ||
      lowerLine.includes('you gave') ||
      lowerLine.includes('paid you') ||
      lowerLine.includes('you paid') ||
      lowerLine.includes('you received')
    ) {
      if (!lowerLine.includes('gösterdi') && !lowerLine.includes('gösterdin')) {
        hybRes = handleTransaction(line);
        if (hybRes) return hybRes;
      }
    }

    if (
      lowerLine.startsWith('info:') ||
      (lowerLine.includes('içerisinden') && lowerLine.includes('aldın'))
    ) {
      if (
        line.includes('card reader') ||
        line.includes('card payment') ||
        line.includes('swiped your card')
      )
        return formatCardReader(line);
      hybRes = formatInfo(line);
      if (hybRes) return hybRes;
    }

    // 8. DİĞER ENVANTER / AKSİYONLAR
    if (lowerLine.includes('maske taktın.')) return wrapSpan('green', line);
    if (lowerLine.includes('maskeni çıkardın.')) return wrapSpan('death', line);

    if (/^You(?:'ve| have) unlocked (?:the )?.+ to .+\.?$/i.test(line))
      return wrapSpan('green', line);
    if (line.startsWith('You seized')) {
      const match = line.match(/^(You seized )(.+?)( from )(.+)$/);
      if (match) return wrapSpan('green', line);
    }
    if (line.includes("'s attempt has")) {
      if (line.includes('succeeded')) {
        const parts = line.match(/^(\* .+?'s attempt has )(succeeded\. )(\(\()(\d+%)(\)\))$/);
        if (parts)
          return (
            wrapSpan('me', parts[1]) +
            wrapSpan('green', parts[2]) +
            wrapSpan('white', parts[3] + parts[4] + parts[5])
          );
      }
      if (line.includes('failed')) {
        const parts = line.match(/^(\* .+?'s attempt has )(failed\. )(\(\()(\d+%)(\)\))$/);
        if (parts)
          return (
            wrapSpan('me', parts[1]) +
            wrapSpan('death', parts[2]) +
            wrapSpan('white', parts[3] + parts[4] + parts[5])
          );
      }
    }
    if (line.startsWith('You collected') || line.startsWith('You added')) {
      const match = line.match(
        /^(You (?:collected|added) )(\$\d+(?:,\d{3})*)((?:\s+from|\s+in) the property\.)$/
      );
      if (match)
        return (
          wrapSpan('white', match[1]) + wrapSpan('green', match[2]) + wrapSpan('white', match[3])
        );
    }
    if (line.startsWith('You have withdrawn') || line.startsWith('You have deposited')) {
      if (line.match(/^You have (withdrawn|deposited) \$\d+(?:,\d{3})*\.?$/))
        return wrapSpan('green', line.endsWith('.') ? line : line + '.');
    }
    if (line.startsWith('You have bought a total of')) {
      const match = line.match(
        /^(You have bought a total of )(\d+)( items for )(\$\d+(?:,\d{3})*)( total\.)$/
      );
      if (match)
        return (
          wrapSpan('white', match[1]) +
          wrapSpan('white', match[2]) +
          wrapSpan('white', match[3]) +
          wrapSpan('green', match[4]) +
          wrapSpan('white', match[5])
        );
    }
    if (line.startsWith('You have bought')) {
      const match = line.match(
        /^(You have bought )(X\d+)( PAYG Credit for )(\$\d+(?:,\d{3})*)(\.)$/i
      );
      if (match)
        return (
          wrapSpan('white', match[1]) +
          wrapSpan('blue', match[2] + ' PAYG Credit') +
          wrapSpan('white', ' for ') +
          wrapSpan('green', match[4]) +
          wrapSpan('white', match[5])
        );
    }
    if (lowerLine.startsWith("you've used")) return wrapSpan('green', line);
    if (lowerLine.startsWith("you've cut")) return formatDrugCut(line);
    if (lowerLine.startsWith('you placed') || lowerLine.startsWith('you took'))
      return wrapSpan('orange', line);
    if (lowerLine.startsWith('you dropped')) return wrapSpan('death', line);
    if (/^you took.*from the property\.$/i.test(line)) return wrapSpan('death', line);
    if (lowerLine.includes('from the property')) return wrapSpan('death', line);
    if (lowerLine.includes('you have shown your inventory')) return wrapSpan('green', line);
    if (lowerLine.includes('konum gönderildi')) return wrapSpan('green', line);
    if (lowerLine.includes('you received a location from')) return colorLocationLine(line);
    if (lowerLine.includes('you have received $')) return colorMoneyLine(line);

    // 9. MESLEK & SUÇ BİLDİRİMLERİ (MDC, Hapishane, Telsiz)
    if (/^\*\* \[PRISON PA\].*\*\*$/.test(line)) return formatPrisonPA(line);
    if (line.includes('[POLICE MDC]')) return formatPoliceMDC(line);

    if (line.includes(' -> ') && line.startsWith('**') && line.endsWith('**')) {
      return `<span class="depColor">${escapeHTML(line)}</span>`;
    }
    if (/\[[^\]]+ -> [^\]]+\]/.test(line)) return wrapSpan('depColor', line);

    if (line.includes('[CASHTAP]')) return formatCashTap(line);
    if (lowerLine.includes('[drug lab]')) return formatDrugLab();
    if (lowerLine.includes('[property robbery]')) return formatPropertyRobbery(line);
    if (lowerLine.includes('[ck]') || lowerLine.includes('[character kill]'))
      return formatCharacterKill(line);
    if (lowerLine.includes("you're being robbed, use /arob")) return formatRobbery(line);
    if (line.match(/(.+) üstünü aradı\./)) return wrapSpan('green', line);
    const panicMatch = line.match(
      /^\[(LSSD|LSPD|PHMC|SADCR) PANIC ALARM\] (.+) activated their panic alarm at (.+)$/i
    );
    if (panicMatch)
      return (
        wrapSpan('blue', `[${panicMatch[1]} PANIC ALARM]`) +
        wrapSpan('white', ` ${panicMatch[2]} activated their panic alarm at`) +
        wrapSpan('blue', ` ${panicMatch[3]}`)
      );

    // 10. DİĞER KISA SİSTEM FORMATLARI
    if (/^\(\(.*\[ID: \d+\].*\)\)$/.test(line)) return wrapSpan('yellow', line);
    if (line.includes('[ID: +%d')) {
      if (line.match(/^(\[ID: \+%d\]\s+)(.+?)(?:\s+\(\(\d+\)\))?$/))
        return wrapSpan('yellow', line);
    }
    if (/(?:^\[\d{2}:\d{2}:\d{2}\] )?CHAT LOG: > .+/.test(line))
      return wrapSpan('ame', line.replace(/^(?:\[\d{2}:\d{2}:\d{2}\] )?CHAT LOG: /, ''));
    if (
      line.match(/^___Açıklama Sahibi: .+___$/) ||
      line.match(/^___Tattoos description of .+___$/)
    )
      return wrapSpan('blue', line);
    if (line.startsWith('Yaş Aralığı:'))
      return (
        wrapSpan('blue', 'Yaş Aralığı:') + wrapSpan('white', line.substring('Yaş Aralığı:'.length))
      );
    if (line.startsWith('->'))
      return wrapSpan('blue', '->') + wrapSpan('white', line.substring('->'.length));
    if (
      line.match(/\|------ .+kişisinin eşyaları \d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}:\d{2} ------\|/)
    )
      return wrapSpan('green', line);

    if (lowerLine.includes('is wearing:') && line.includes('(')) {
      const safeLine = escapeHTML(line);
      let coloredLine = safeLine.replace(
        /(is wearing:\s*)(.*?)(\s*\()/i,
        '$1<span class="green">$2</span>$3'
      );
      if (coloredLine.startsWith('-&gt;')) {
        coloredLine =
          coloredLine.replace(/^(-&gt;\s*)/, '<span class="blue">$1</span><span class="white">') +
          '</span>';
      }
      return `<span>${coloredLine}</span>`;
    }

    if (line.match(/^(?:\[\d{2}:\d{2}:\d{2}\]\s+)?\d+: .+/)) {
      if (line.includes('PH:')) {
        const phoneMatch = line.trim().match(/^(\d+: .+? x\d+ \(.+?\) -) (PH: \d+)$/);
        if (phoneMatch)
          return wrapSpan('yellow', phoneMatch[1]) + ' ' + wrapSpan('green', phoneMatch[2]);
      }
      if (line.includes('Para ($')) {
        const moneyMatch = line.match(/^(\d+: Para \()(\$\d+(?:,\d{3})*)(\) \(\d+g\))$/);
        if (moneyMatch)
          return (
            wrapSpan('yellow', moneyMatch[1]) +
            wrapSpan('green', moneyMatch[2]) +
            wrapSpan('yellow', moneyMatch[3])
          );
      }
      return wrapSpan('yellow', line);
    }

    if (lowerLine.startsWith('toplam ağırlık:')) return wrapSpan('yellow', line);
    if (lowerLine.startsWith('elinizdeki para:')) return wrapSpan('green', line);
    if (line.startsWith('[INTERVIEW]')) return wrapSpan('green', line);
    if (lowerLine.startsWith('use /phonecursor')) return formatPhoneCursor(line);
    if (line.includes('You have received an invitation to join the')) {
      const parts = line.split('join the ');
      if (parts[1])
        return (
          parts[0] +
          'join the ' +
          wrapSpan('yellow', parts[1].split(',')[0]) +
          ', type /faccept to confirm'
        );
    }
    if (line.includes("You're now a member of")) {
      const parts = line.split('member of ');
      if (parts[1])
        return (
          parts[0] +
          'member of ' +
          wrapSpan('yellow', parts[1].split(' you')[0]) +
          ' you may need to /switchfactions to set it as your active faction!'
        );
    }
    if (lowerLine.includes('(goods)') || line.match(/(.+?)\s+x(\d+)\s+\((\d+g)\)/))
      return handleGoods(line);

    if (line.includes('[STREET]')) {
      if (line.includes(' / ')) {
        const parts = line.match(
          /\[STREET\] Sokak [İi]smi:\s*(.+?)\s*\/\s*(.+?)\s*\|\s*Zone:\s*([^.]+)(\.?)/i
        );
        if (parts) {
          return `${wrapSpan('blue', '[STREET]')} Sokak İsmi: ${wrapSpan('orange', parts[1])} / ${wrapSpan('orange', parts[2])} | Zone: ${wrapSpan('orange', parts[3])}${parts[4] || ''}`;
        }
      } else {
        const parts = line.match(/\[STREET\] Sokak [İi]smi:\s*(.+?)\s*\|\s*Zone:\s*([^.]+)(\.?)/i);
        if (parts) {
          return `${wrapSpan('blue', '[STREET]')} Sokak İsmi: ${wrapSpan('orange', parts[1])} | Zone: ${wrapSpan('orange', parts[2])}${parts[3] || ''}`;
        }
      }
      return wrapSpan('blue', line);
    }
    if (line.startsWith('*') || /^!?\{#?[0-9A-Fa-f]{6}\}\s*\*/i.test(line)) {
      const cleanLine = line.replace(/^!?\{#?[0-9A-Fa-f]{6}\}\s*/i, '');
      return wrapSpan('me', cleanLine);
    }
    if (line.startsWith('>') || /^!?\{#?[0-9A-Fa-f]{6}\}\s*>/i.test(line)) {
      const cleanLine = line.replace(/^!?\{#?[0-9A-Fa-f]{6}\}\s*/i, '');
      return wrapSpan('ame', cleanLine);
    }

    // 11. TR GENEL İŞLEM FİİLLERİ (Fallback catch)
    if (lowerLine.startsWith('mülke')) {
      if (line.match(/^\s*Mülke .+ yerleştirdin\.?\s*$/i)) return wrapSpan('orange', line);
    }
    if (lowerLine.startsWith('mülkün içerisinden')) {
      if (line.match(/^\s*Mülkün içerisinden .+ aldın\.?\s*$/i)) return wrapSpan('death', line);
    }
    if (lowerLine.startsWith('mülkün içerisinde')) {
      const match = line.match(/^\s*Mülkün içerisinde (.+?) buldun\.?\s*$/i);
      if (match)
        return (
          wrapSpan('blue', 'Mülkün içerisinde ') +
          wrapSpan('white', match[1]) +
          wrapSpan('blue', ' buldun.')
        );
    }
    if (lowerLine.startsWith('araca')) {
      if (line.match(/^\s*Araca .+ yerleştirdin\.?\s*$/i)) return wrapSpan('orange', line);
    }
    if (lowerLine.startsWith('araçtan')) {
      if (line.match(/^\s*Araçtan .+ aldın\.?\s*$/i)) return wrapSpan('orange', line);
    }

    const noTimeLine = lowerLine.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');
    if (!noTimeLine.includes(':')) {
      if (/\byerleştirdin\b/i.test(line)) return wrapSpan('orange', line);
      if (/\bmülkün içerisinden\b.+\baldın\b/i.test(line)) return wrapSpan('death', line);
      if (/^\s*araçtan\b.+\baldın\b/i.test(line)) return wrapSpan('orange', line);
    }

    // 12. SAYS (KONUŞMA) FALLBACK KONTROLÜ
    if (lowerLine.includes('(bağırır):') || lowerLine.includes('shouts (to')) {
      return wrapSpan('white', line);
    }

    if (
      lowerLine.includes(':') &&
      !line.startsWith('(Araç İçi)') &&
      (enableWhisperColoring
        ? !lowerLine.includes('(kısık ses)') &&
          !lowerLine.includes('kısık sesle') &&
          !lowerLine.includes('(alçak ses)') &&
          !lowerLine.includes('alçak sesle') &&
          !lowerLine.includes('fısıldar')
        : true) &&
      !lowerLine.includes('(telefon)') &&
      !lowerLine.includes('(hoparlör)')
    ) {
      return formatSaysLine(line, currentCharacterName);
    }

    return null;
  }

  function formatLine(line) {
    const lowerLine = normalizeTurkishForSearch(line);

    if (line.includes('Equipped Weapons')) {
      return wrapSpan('green', line);
    }

    if (lowerLine.includes('tarafından el koyuldu')) {
      return wrapSpan('death', line);
    }

    if (line.match(/\|------ .+'s Items \d{2}\/[A-Z]{3}\/\d{4} - \d{2}:\d{2}:\d{2} ------\|/)) {
      return wrapSpan('green', line);
    }

    if (line.match(/^(?:\[\d{2}:\d{2}:\d{2}\]\s+)?\d+: .+/)) {
      if (line.includes('PH:')) {
        const phoneMatch = line.trim().match(/^(\d+: .+? x\d+ \(.+?\) -) (PH: \d+)$/);
        if (phoneMatch) {
          const [_, itemPart, phonePart] = phoneMatch;
          return wrapSpan('yellow', itemPart) + ' ' + wrapSpan('green', phonePart);
        }
      }

      if (line.includes('Money ($')) {
        const moneyMatch = line.match(/^(\d+: Money \()(\$\d+(?:,\d{3})*)(\) \(\d+g\))$/);
        if (moneyMatch) {
          const [_, prefix, amount, suffix] = moneyMatch;
          return (
            wrapSpan('yellow', prefix) + wrapSpan('green', amount) + wrapSpan('yellow', suffix)
          );
        }
      }
      return wrapSpan('yellow', line);
    }

    return replaceColorCodes(line);
  }

  function formatJailTime(line) {
    const enMatch = line.match(/(You have) (.*?) (left in jail\.)/i);
    if (enMatch)
      return `<span class="white">${escapeHTML(enMatch[1])}</span> <span class="green">${escapeHTML(enMatch[2])}</span> <span class="white">${escapeHTML(enMatch[3])}</span>`;

    const trMatch = line.match(/^\s*Hapisten çıkmana (.+?) kaldı\.?\s*$/i);
    if (trMatch)
      return (
        wrapSpan('white', 'Hapisten çıkmana ') +
        wrapSpan('green', trMatch[1]) +
        wrapSpan('white', ' kaldı.')
      );

    return null;
  }

  // Make formatLineWithFilter accessible for history panel
  ChatlogParser.formatLineWithFilter = formatLineWithFilter;

  function escapeHTML(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  const INLINE_COLOR_MAP = {
    dodgerblue: '#1E90FF',
    white: '#FFFFFF',
    yellow: '#FBF724',
    green: '#56D64B',
    red: '#F00000',
    death: '#F00000',
    blue: '#3896F3',
    orange: '#EDA841',
    grey: '#939799',
    gray: '#939799',
    darkgrey: '#5A5A5B',
    darkgray: '#5A5A5B',
    lightgrey: '#C6C4C4',
    lightgray: '#C6C4C4',
    purple: '#C2A3DA',
    pink: '#FF00BC',
  };

  function resolveColorCode(code) {
    if (!code) return null;
    const clean = code.replace(/^[!#{}]+|[{}]+$/g, '').trim();
    if (/^[0-9A-Fa-f]{6}$/.test(clean) || /^[0-9A-Fa-f]{3}$/.test(clean)) {
      return '#' + clean;
    }
    const lower = clean.toLowerCase();
    if (INLINE_COLOR_MAP[lower]) {
      return INLINE_COLOR_MAP[lower];
    }
    if (/^[a-zA-Z]+$/.test(clean)) {
      return clean;
    }
    return null;
  }

  function wrapSpan(className, content) {
    // Normalize apostrophes and escape HTML to prevent tag injection
    content = escapeHTML(content.replace(/['''']/g, "'"))
      .replace(/~y~/g, '')
      .replace(/~h~/g, '')
      .replace(/~s~/g, '')
      .replace('CHAT LOG:', '');

    // Pre-process matched pairs for emote and italic using special control characters
    // \x01: Start Emote, \x02: End Emote
    // \x03: Start Italic, \x04: End Italic
    content = content.replace(/\*([^\*]+)\*/g, '\x01$1\x02');

    if (enableItalicParsing) {
      // Protect URLs and dates (e.g. 9/11 or 12/05/2024) from being mangled by italic slash regex
      const placeholders = [];
      content = content.replace(/(https?:\/\/[^\s]+|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b)/g, (m) => {
        placeholders.push(m);
        return `\x05${placeholders.length - 1}\x06`;
      });

      content = content.replace(/(^|[\s\(\[\{])\/([^\/]+)\/(?=$|[\s.,!?\)\]\}])/g, '$1\x03$2\x04');

      // eslint-disable-next-line no-control-regex -- \x05/\x06 are intentional in-memory placeholders
      content = content.replace(/\x05(\d+)\x06/g, (_, idx) => placeholders[Number(idx)]);
    }

    // Split by !{#HEXCODE}, !{HEXCODE}, {#HEXCODE}, {HEXCODE}, or !{ColorName}
    const parts = content.split(/!?\{#?([0-9A-Fa-f]{6}|[a-zA-Z]+)\}/i);

    let html = '';
    let censoring = false;
    let isEmote = false;
    let isItalic = false;
    let censorBuffer = '';
    let visibleBuffer = '';
    let activeInlineColor = null;

    const flushCensor = () => {
      if (censorBuffer.length > 0) {
        const styles = [];
        if (activeInlineColor) styles.push(`color: ${activeInlineColor};`);
        if (isItalic) styles.push(`font-style: italic;`);
        const styleAttr = styles.length > 0 ? ` style="${styles.join(' ')}"` : '';

        const currentClass = isEmote ? 'ame' : className;
        const isOpsec = Boolean(ChatlogParser.opsecActive || $opsecBtn.hasClass('active'));
        const opsecClass = isOpsec ? ' opsec-censored' : '';

        if (censorStyle === 'blur') {
          html += `<span class="${currentClass} censored-content blur-mode colorable${opsecClass}" data-original="${censorBuffer}"${styleAttr}>${censorBuffer}</span>`;
        } else {
          html += `<span class="${currentClass} censored-content censored-remove${opsecClass}" data-original="${censorBuffer}"${styleAttr}>${censorBuffer}</span>`;
        }
        censorBuffer = '';
      }
    };

    const flushVisible = () => {
      if (visibleBuffer.length > 0) {
        const styles = [];
        if (activeInlineColor) styles.push(`color: ${activeInlineColor};`);
        if (isItalic) styles.push(`font-style: italic;`);
        const styleAttr = styles.length > 0 ? ` style="${styles.join(' ')}"` : '';
        const currentClass = isEmote ? 'ame' : className;

        html += `<span class="${currentClass} colorable"${styleAttr}>${visibleBuffer}</span>`;
        visibleBuffer = '';
      }
    };

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) {
        const resolved = resolveColorCode(parts[i]);
        if (resolved) {
          flushCensor();
          flushVisible();
          activeInlineColor = resolved;
        }
        continue;
      }

      const textSegment = parts[i];
      if (!textSegment) continue;

      const tokens = textSegment.split(/(\s+)/g);

      tokens.forEach((token) => {
        if (token === '') return;
        if (/^\s+$/.test(token)) {
          // On whitespace, flush any visible buffer and pass whitespace through
          if (censoring) {
            censorBuffer += token;
          } else {
            flushVisible();
            html += token;
          }
          return;
        }

        // Process non-whitespace token character-by-character to handle censorship toggles
        for (const char of token) {
          if (char === '÷') {
            if (censoring) {
              // closing delimiter
              flushCensor();
              censoring = false;
            } else {
              // opening delimiter
              flushVisible();
              censoring = true;
            }
          } else if (char === '\x01') {
            if (censoring) flushCensor();
            else flushVisible();
            isEmote = true;
          } else if (char === '\x02') {
            if (censoring) flushCensor();
            else flushVisible();
            isEmote = false;
          } else if (char === '\x03') {
            if (censoring) flushCensor();
            else flushVisible();
            isItalic = true;
          } else if (char === '\x04') {
            if (censoring) flushCensor();
            else flushVisible();
            isItalic = false;
          } else if (censoring) {
            censorBuffer += char;
          } else {
            visibleBuffer += char;
          }
        }
        // At end of token (word), flush visible as a single word span
        if (!censoring) {
          flushVisible();
        }
      });
    }

    if (censoring) {
      // unmatched delimiter, append as plain text
      html += censorBuffer;
    }

    // Also append unmatched styles
    if (visibleBuffer.length > 0) flushVisible();

    return html;
  }

  function formatWeatherLine(line) {
    const lowerLine = line.toLowerCase();

    if (
      !lowerLine.includes('sıcaklık:') &&
      !lowerLine.includes('wind:') &&
      !lowerLine.includes('rüzgar:')
    ) {
      return null;
    }

    const cleanLine = line.replace(/^[\s*]+/, '');

    if (
      cleanLine.includes('Sıcaklık:') &&
      (cleanLine.includes('Rüzgar:') || cleanLine.includes('Wind:'))
    ) {
      const match = cleanLine.match(
        /Sıcaklık:\s*(.+?),\s*(?:it is currently|şu anda hava)\s*(.+?)\.\s*(?:Rüzgar|Wind):\s*(.+?),\s*(?:humidity|nem):\s*(.+?),\s*(?:rain precipitation|yağış):\s*(.+?)\.\s*(?:Current time|Zaman):\s*(.+)/i
      );

      if (match) {
        return (
          wrapSpan('white', 'Sıcaklık: ') +
          wrapSpan('green', match[1]) +
          wrapSpan('white', ', it is currently ') +
          wrapSpan('green', match[2]) +
          wrapSpan('white', '. Rüzgar: ') +
          wrapSpan('green', match[3]) +
          wrapSpan('white', ', humidity: ') +
          wrapSpan('green', match[4]) +
          wrapSpan('white', ', rain precipitation: ') +
          wrapSpan('green', match[5]) +
          wrapSpan('white', '. Current time: ') +
          wrapSpan('white', match[6])
        );
      }
    }
    if (cleanLine.startsWith('Sıcaklık:')) {
      const match = cleanLine.match(
        /Sıcaklık:\s*(.+?)\.\s*(?:Şu anda hava|it is currently)\s*(.+?)\.?$/i
      );
      if (match) {
        return (
          wrapSpan('white', 'Sıcaklık: ') +
          wrapSpan('green', match[1]) +
          wrapSpan('white', '. Şu anda hava ') +
          wrapSpan('green', match[2]) +
          '.'
        );
      }

      return (
        wrapSpan('white', 'Sıcaklık: ') +
        wrapSpan('green', cleanLine.replace('Sıcaklık:', '').trim())
      );
    }
    if (cleanLine.startsWith('Wind:') || cleanLine.startsWith('Rüzgar:')) {
      const prefixMatch = cleanLine.match(/^(Wind|Rüzgar):/i);
      const prefix = prefixMatch ? prefixMatch[1] : 'Rüzgar';

      const match = cleanLine.match(
        /(?:Wind|Rüzgar):\s*(.+?),\s*(?:humidity|nem):\s*(.+?),\s*(?:rain precipitation|yağış):\s*(.+?)\.?$/i
      );
      if (match) {
        return (
          wrapSpan('white', prefix + ': ') +
          wrapSpan('green', match[1]) +
          wrapSpan('white', ', Nem: ') +
          wrapSpan('green', match[2]) +
          wrapSpan('white', ', Yağış: ') +
          wrapSpan('green', match[3]) +
          '.'
        );
      }
      return (
        wrapSpan('white', prefix + ': ') +
        wrapSpan('green', cleanLine.replace(new RegExp(`^${prefix}:`, 'i'), '').trim())
      );
    }

    return null;
  }

  function isRadioLine(line) {
    return /\[S: \d+ \| CH: .+\]/.test(line);
  }

  function handleWhispers(line) {
    if (line.startsWith('(Araç İçi)')) {
      return wrapSpan('yellow', line);
    }

    const groupWhisperPattern = /^[A-Z][a-z]+\s[A-Z][a-z]+\swhispers to \d+\speople/i;
    const match = line.match(groupWhisperPattern);
    if (match) {
      const splitIndex = match.index + match[0].length;
      return `<span class="orange">${escapeHTML(line.slice(0, splitIndex))}</span><span class="whisper">${escapeHTML(line.slice(splitIndex))}</span>`;
    }

    return wrapSpan('whisper', line);
  }

  function handleCellphone(line) {
    const hasExclamation = line.startsWith('!');
    const cleanLine = hasExclamation ? line.slice(1) : line;
    return wrapSpan(hasExclamation ? 'yellow' : 'white', cleanLine);
  }

  function handleGoods(line) {
    return wrapSpan('yellow', line.replace(/(\$\d+)/, '<span class="green">$1</span>'));
  }

  function handleTransaction(line) {
    const cleanLine = line.replace(/\s*\(\d{2}\/[A-Z]{3}\/\d{4}\s+-\s+\d{2}:\d{2}:\d{2}\)\.?/, '');
    const lowerLine = cleanLine.toLowerCase();

    const noTimeLine = lowerLine.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');
    if (!noTimeLine.includes(':')) {
      if (
        (lowerLine.includes('sana') &&
          lowerLine.includes('verdi') &&
          !lowerLine.includes('gösterdi')) ||
        (lowerLine.includes('verdin') &&
          (lowerLine.includes('kişiye') || lowerLine.includes('kişisine'))) ||
        (lowerLine.includes('adlı kişi sana') && lowerLine.includes('verdi')) ||
        (lowerLine.includes('adlı kişiye') && lowerLine.includes('verdin')) ||
        lowerLine.startsWith('transfer başarıyla tamamlandı')
      ) {
        return wrapSpan('green', cleanLine);
      }
    }

    if (
      lowerLine.includes('you gave') ||
      lowerLine.includes('paid you') ||
      lowerLine.includes('you paid') ||
      lowerLine.includes('you received')
    ) {
      return wrapSpan('green', cleanLine + (cleanLine.endsWith('.') ? '' : '.'));
    }

    return null;
  }

  function formatInfo(line) {
    const lowerLine = line.toLowerCase();

    if (lowerLine.includes('info:')) {
      const moneyMatch = line.match(/\$(\d+)/);
      const itemMatch = line.match(/took\s(.+?)\s\((\d+)\)\sfrom\s(the\s.+)\.$/i);

      if (moneyMatch) {
        const objectMatch = line.match(/from the (.+)\.$/i);
        if (objectMatch)
          return `<span class="orange">Info:</span> <span class="white">You took</span> <span class="green">$${escapeHTML(moneyMatch[1])}</span> <span class="white">from the ${escapeHTML(objectMatch[1])}</span>.`;
      }
      if (itemMatch) {
        return `<span class="orange">Info:</span> <span class="white">You took</span> <span class="white">${escapeHTML(itemMatch[1])}</span> <span class="white">(${escapeHTML(itemMatch[2])})</span> <span class="white">from ${escapeHTML(itemMatch[3])}</span>.`;
      }
    }

    if (lowerLine.includes('bİlgİ:') || lowerLine.includes('bilgi:')) {
      const trItemMatch = line.match(/^(BİLGİ:\s+)?(.+?)\s+içerisinden\s+(.+?)\s+aldın\.?$/i);
      if (trItemMatch) {
        return (
          wrapSpan('orange', (trItemMatch[1] || '').trim()) +
          ' ' +
          wrapSpan('white', trItemMatch[2] + ' içerisinden ') +
          wrapSpan('white', trItemMatch[3]) +
          wrapSpan('white', ' aldın.')
        );
      }
    }

    return null;
  }

  function formatSmsMessage(line) {
    // Match the pattern: (phone) Message from sender: content
    const match = line.match(
      /^(\([^)]+\))\s+([^\s]+)\s+(kişisinden mesaj|grubundan gelen mesaj):\s*(.+)$/
    );

    if (match) {
      const phone = match[1];
      const sender = match[2];
      const messageType = match[3];
      const message = match[4];

      // Remove brackets only from the phone identifier, preserve them in the message
      const cleanPhone = phone.replace(/[\[\]]/g, '');

      return wrapSpan('yellow', `${cleanPhone} ${sender} ${messageType}: ${message}`);
    }

    // Fallback: if pattern doesn't match, just remove brackets from the whole line
    line = line.replace(/[\[\]]/g, '');
    return wrapSpan('yellow', line);
  }

  function formatSmsReminderMessage(line) {
    const match = line.match(/\[SMS\] %[A-Za-z0-9]+ okunmamış mesajın var\./i);

    if (match) {
      const info = match[1];
      const count = match[2];

      return wrapSpan('yellow', `${info}`);
    }

    // Fallback: if pattern doesn't match, just remove brackets from the whole line
    line = line.replace(/[\[\]]/g, '');
    return wrapSpan('yellow', line);
  }

  function formatOutgoingSmsMessage(line) {
    // Match the pattern: (phone) Message from sender: content
    const match = line.match(/^(\([^)]+\))\s+([^\s]+)\s+kişisine mesaj gönderildi:\s*(.+)$/);

    if (match) {
      const phone = match[1];
      const sender = match[2];
      const message = match[3];

      // Remove brackets only from the phone identifier, preserve them in the message
      const cleanPhone = phone.replace(/[\[\]]/g, '');

      return wrapSpan('orange', `${cleanPhone} ${sender} kişisine mesaj gönderildi: ${message}`);
    }

    // Fallback: if pattern doesn't match, just remove brackets from the whole line
    line = line.replace(/[\[\]]/g, '');
    return wrapSpan('orange', line);
  }

  function formatPhoneSet(line) {
    line = line.replace(/\[(?!BİLGİ\])|\](?!)/g, '');

    line = line.replace('[BİLGİ]', '<span class="green">[BİLGİ]</span>');

    const infoTag = '<span class="green">[BİLGİ]</span>';
    const restOfLine = escapeHTML(line.replace(/\[BİLGİ\]/, '').trim());
    return infoTag + ' <span class="white">' + restOfLine + '</span>';
  }

  function formatIncomingCall(line) {
    line = line.replace(/[\[\]]/g, '').trim();

    // Try to match the full format with commands
    const fullMatch = line.match(/\(([^)]+)\)\s+(.+?)\s+adlı kişiden gelen arama(.+)/i);
    if (fullMatch) {
      const parenthetical = escapeHTML(fullMatch[1]);
      const caller = escapeHTML(fullMatch[2]);
      const restofcall = escapeHTML(fullMatch[3]);

      return (
        '<span class="yellow">(' +
        parenthetical +
        ') ' +
        caller +
        '</span> <span class="white">tarafından gelen çağrı</span>' +
        '<span class="white">' +
        restofcall
      );
    }

    // Try to match the simple format: (Phone) Incoming call from Name.
    const simpleMatch = line.match(/\(([^)]+)\) Incoming call from (.+)\.$/);
    if (simpleMatch) {
      const parenthetical = escapeHTML(simpleMatch[1]);
      const caller = escapeHTML(simpleMatch[2]);

      return (
        '<span class="yellow">(' +
        parenthetical +
        ')</span> <span class="white">Incoming call from </span><span class="yellow">' +
        caller +
        '</span><span class="white">.</span>'
      );
    }

    // Fallback for unmatched patterns
    return '<span class="white">' + escapeHTML(line) + '</span>';
  }

  function colorInfoLine(line) {
    line = line.replace(/\[(?!INFO\])|(?<!INFO)\]/g, '');
    line = line.replace('[INFO]', '<span class="blue">[INFO]</span>');

    if (line.includes('You have received a contact')) {
      if (line.includes('/acceptnumber')) {
        return applyPhoneRequestFormatting(line);
      } else if (line.includes('/acceptcontact')) {
        return applyContactShareFormatting(line);
      }
    } else if (line.includes('You have shared your number with')) {
      return applyNumberShareFormatting(line);
    } else if (line.includes('You have shared')) {
      return applyContactSharedFormatting(line);
    }

    return '<span class="white">' + line + '</span>';
  }

  function formatInGameClientLine(line) {
    if (!line) return null;
    const rawLine = line.trim();

    // Radar line: [RADAR] ...
    const radarMatch = rawLine.match(/^(\[RADAR\])\s*(.*)$/i);
    if (radarMatch) {
      const tag = radarMatch[1];
      const message = radarMatch[2];
      return wrapSpan('dodgerblue', tag) + (message ? ' ' + wrapSpan('white', message) : '');
    }

    // Info line: [INFO], INFO:, [ИНФО], ИНФО:, [BİLGİ], BİLGİ:
    const infoMatch = rawLine.match(
      /^(\[(?:INFO|ИНФО|B[İIiı]LG[İIiı])\]|(?:INFO|ИНФО|B[İIiı]LG[İIiı])\s*:)\s*(.*)$/i
    );
    if (infoMatch) {
      const tag = infoMatch[1];
      const message = infoMatch[2];
      return wrapSpan('dodgerblue', tag) + (message ? ' ' + wrapSpan('white', message) : '');
    }

    // Error line: [ERROR], ERROR:, [ОШИБКА], ОШИБКА:, [HATA], HATA:
    const errorMatch = rawLine.match(
      /^(\[(?:ERROR|ОШИБКА|HATA)\]|(?:ERROR|ОШİБКА|ОШИБКА|HATA)\s*:)\s*(.*)$/i
    );
    if (errorMatch) {
      const tag = errorMatch[1];
      const message = errorMatch[2];
      return wrapSpan('death', tag) + (message ? ' ' + wrapSpan('white', message) : '');
    }

    return null;
  }

  function applyPhoneRequestFormatting(line) {
    const pattern =
      /\[INFO\] You have received a contact \((.+), ([^\)]+)\) from (.+)\. Use (\/acceptnumber) to accept it\./;

    const match = line.match(pattern);

    if (match) {
      const contactName = escapeHTML(match[1]);
      const numbers = escapeHTML(match[2]);
      const sender = escapeHTML(match[3]);
      const acceptCommand = escapeHTML(match[4]);

      return (
        '<span class="blue">[INFO]</span> <span class="white">You have received a contact (' +
        contactName +
        ', ' +
        numbers +
        ') from ' +
        sender +
        '. Use ' +
        acceptCommand +
        ' to accept it.</span>'
      );
    } else {
      return line;
    }
  }

  function applyContactShareFormatting(line) {
    const pattern =
      /\[INFO\] You have received a contact \((.+), ([^\)]+)\) from (.+)\. Use (\/acceptcontact) to accept it\./;

    const match = line.match(pattern);

    if (match) {
      const contactName = escapeHTML(match[1]);
      const numbers = escapeHTML(match[2]);
      const sender = escapeHTML(match[3]);
      const acceptCommand = escapeHTML(match[4]);

      return (
        '<span class="blue">[INFO]</span> <span class="white">You have received a contact (' +
        contactName +
        ', ' +
        numbers +
        ') from ' +
        sender +
        '. Use ' +
        acceptCommand +
        ' to accept it.</span>'
      );
    } else {
      return line;
    }
  }

  function applyNumberShareFormatting(line) {
    const pattern = /\[INFO\] You have shared your number with (.+) under the name (.+)\./;

    const match = line.match(pattern);

    if (match) {
      const receiver = escapeHTML(match[1]);
      const name = escapeHTML(match[2]);

      return (
        '<span class="blue">[INFO]</span> <span class="white">You have shared your number with ' +
        receiver +
        ' under the name ' +
        name +
        '.</span>'
      );
    } else {
      return line;
    }
  }

  function applyContactSharedFormatting(line) {
    const pattern = /\[INFO\] You have shared (.+) \(([^\)]+)\) with (.+)\./;

    const match = line.match(pattern);

    if (match) {
      const contactName = escapeHTML(match[1]);
      const numbers = escapeHTML(match[2]);
      const receiver = escapeHTML(match[3]);

      return (
        '<span class="blue">[INFO]</span> <span class="white">You have shared ' +
        contactName +
        ' (' +
        numbers +
        ') with ' +
        receiver +
        '.</span>'
      );
    } else {
      return line;
    }
  }

  function formatVesselTraffic(line) {
    const vesselTrafficPattern = /\*\*\s*\[CH: VTS - Vessel Traffic Service\]/;

    if (vesselTrafficPattern.test(line)) {
      return `<span class="vesseltraffic">${escapeHTML(line)}</span>`;
    }

    return line;
  }

  function formatIntercom(line) {
    const match = line.match(/\[(.*?)\s*İnterkom\]:\s*(.*)/i);
    if (match) {
      const location = escapeHTML(match[1]);
      const message = escapeHTML(match[2]);
      return `<span class="blue">[${location} İnterkom]: ${message}</span>`;
    }
    return line;
  }

  function formatPhoneCursor(_line) {
    return '<span class="white">Use <span class="yellow">/phonecursor (/pc)</span> to activate the cursor to use the phone.</span>';
  }

  function formatShown(line) {
    const enMatch = line.match(/^(.+) has shown you their (.+)\.$/i);
    if (enMatch)
      return `<span class="green">${escapeHTML(enMatch[1])} has shown you their <span class="white">${escapeHTML(enMatch[2])}</span>.</span>`;

    const trMatch1 = line.match(/^(.+? sana )(.+?)( gösterdi\.?)$/i);
    if (trMatch1)
      return (
        wrapSpan('green', trMatch1[1]) +
        wrapSpan('white', trMatch1[2]) +
        wrapSpan('green', trMatch1[3])
      );

    const trMatch2 = line.match(/^\s*(.+?) kişisine (.+?) gösterdin\.?\s*$/i);
    if (trMatch2)
      return (
        wrapSpan('blue', trMatch2[1] + ' kişisine ') +
        wrapSpan('white', trMatch2[2]) +
        wrapSpan('blue', ' gösterdin.')
      );

    return null;
  }

  function replaceColorCodes(str) {
    // Validate and sanitize hex color codes
    return str
      .replace(/!?\{#?([A-Fa-f0-9]{6})\}/gi, (_match, p1) => {
        // p1 is already validated by regex to be 6 hex chars, but sanitize anyway
        const safeColor = p1.replace(/[^A-Fa-f0-9]/g, '').substring(0, 6);
        return '<span style="color: #' + safeColor + ';">';
      })
      .replace(/!?\{\/#?([A-Fa-f0-9]{6})\}/gi, '</span>');
  }

  function colorMoneyLine(line) {
    const moneyMatch = line.match(/You have received (\$\d+(?:,\d{3})*(?:\.\d{1,3})?)/);
    const fromMatch = line.match(/from (.+) on your bank account\./);

    if (moneyMatch && fromMatch) {
      const amount = escapeHTML(moneyMatch[1]);
      const source = escapeHTML(fromMatch[1]);
      return (
        '<span class="white">You have received </span><span class="green">' +
        amount +
        '</span><span class="white"> from </span><span class="white">' +
        source +
        '</span><span class="white"> on your bank account.</span>'
      );
    }
    return line;
  }

  function colorLocationLine(line) {
    const match = line.match(
      /(You received a location from) (#\d+)(. Use )(\/removelocation)( to delete the marker\.)/
    );
    if (match) {
      return (
        '<span class="green">' +
        escapeHTML(match[1]) +
        ' </span>' +
        '<span class="yellow">' +
        escapeHTML(match[2]) +
        '</span>' +
        '<span class="green">' +
        escapeHTML(match[3]) +
        '</span>' +
        '<span class="death">' +
        escapeHTML(match[4]) +
        '</span>' +
        '<span class="green">' +
        escapeHTML(match[5]) +
        '</span>'
      );
    }
    return line;
  }

  function formatRobbery(line) {
    const match = line.match(/You're being robbed, use (.+?) to show your inventory/);
    if (match) {
      const command = escapeHTML(match[1]);
      return (
        '<span class="white">You\'re being robbed, use </span><span class="blue">' +
        command +
        '</span><span class="white"> to show your inventory</span>'
      );
    }
    return line;
  }

  function formatDrugLab() {
    return '<span class="orange">[DRUG LAB]</span> <span class="white">Drug production has started.</span>';
  }

  function formatCharacterKill(line) {
    if (line.includes('[CK]')) {
      return (
        '<span class="blue">[CK]</span> <span class="death">' +
        escapeHTML(line.slice(4)) +
        '</span>'
      );
    } else if (line.includes('[Character Kill]')) {
      return (
        '<span class="blue">[Character Kill]</span> <span class="death">' +
        escapeHTML(line.slice(16)) +
        '</span>'
      );
    }
    return line;
  }

  function formatDrugCut(line) {
    const drugCutPattern = /You've cut (.+?) x(\d+) into x(\d+)\./i;
    const match = line.match(drugCutPattern);

    if (match) {
      const drugName = escapeHTML(match[1]);
      const firstAmount = escapeHTML(match[2]);
      const secondAmount = escapeHTML(match[3]);

      return (
        `<span class="white">You've cut </span>` +
        `<span class="blue">${drugName}</span>` +
        `<span class="blue"> x${firstAmount}</span>` +
        `<span class="white"> into </span><span class="blue">x${secondAmount}</span>` +
        `<span class="blue">.</span>`
      );
    }
    return line;
  }

  function formatPropertyRobbery(line) {
    const robberyPattern = /\[PROPERTY ROBBERY\](.*?)(\$[\d,]+)(.*)/;
    const match = line.match(robberyPattern);

    if (match) {
      const textBeforeAmount = escapeHTML(match[1]);
      const amount = escapeHTML(match[2]);
      const textAfterAmount = escapeHTML(match[3]);

      return `<span class="green">[PROPERTY ROBBERY]</span>${textBeforeAmount}<span class="green">${amount}</span>${textAfterAmount}`;
    }

    return line;
  }

  function formatDrugEffect(line) {
    const enMatch = line.match(
      /You've just taken (.+?)! You will feel the effects of the drug soon\./i
    );
    if (enMatch)
      return `<span class="white">You've just taken </span><span class="green">${escapeHTML(enMatch[1])}</span><span class="white">! You will feel the effects of the drug soon.</span>`;

    const trMatch = line.match(
      /^(.+?)\s*(kullandın|aldın|içtin)\s*,\s*etkilerini yakında hissedeceksin\.?$/i
    );
    if (trMatch)
      return `<span class="green">${escapeHTML(trMatch[1])}</span> <span class="white">${escapeHTML(trMatch[2])}, etkilerini yakında hissedeceksin.</span>`;

    return null;
  }

  function formatPrisonPA(line) {
    const pattern = /^\*\* \[PRISON PA\].*\*\*$/;
    if (pattern.test(line)) {
      return `<span class="blue">${escapeHTML(line)}</span>`;
    }
    return line;
  }

  function formatCashTap(line) {
    if (line.includes('[CASHTAP]')) {
      const parts = line.split('[CASHTAP]');
      if (parts.length === 2) {
        const before = escapeHTML(parts[0]);
        const after = escapeHTML(parts[1]);
        return (
          '<span class="white">' +
          before +
          '</span><span class="green">[CASHTAP]</span><span class="white">' +
          after +
          '</span>'
        );
      }
    }
    return line;
  }

  // MDC = Mobile Data Computer
  function formatPoliceMDC(line) {
    if (line.includes('[POLICE MDC]')) {
      const parts = line.split('[POLICE MDC]');
      if (parts.length === 2) {
        const before = escapeHTML(parts[0]);
        const after = escapeHTML(parts[1]);
        return (
          '<span class="white">' +
          before +
          '</span><span class="blue">[POLICE MDC]</span><span class="white">' +
          after +
          '</span>'
        );
      }
    }
    return line;
  }

  function formatCardReader(line) {
    const [_prefix, rest] = line.split(':');
    const moneyMatch = rest.match(/\$\d+/);
    const money = moneyMatch ? moneyMatch[0] : '';

    if (line.includes('offers you a card reader')) {
      const nameEnd = rest.indexOf(' offers');
      const name = rest.substring(0, nameEnd);
      const middlePart = rest.substring(nameEnd, rest.lastIndexOf(money));

      return (
        wrapSpan('orange', 'Info:') +
        wrapSpan('yellow', name) +
        escapeHTML(middlePart) +
        wrapSpan('green', money) +
        '!'
      );
    }

    if (line.includes('swiped your card through the reader')) {
      const businessStart = rest.indexOf('reader of ') + 'reader of '.length;
      const businessEnd = rest.indexOf(' for an amount');
      const business = rest.substring(businessStart, businessEnd);
      const prefixPart = rest.substring(0, businessStart);

      return (
        wrapSpan('orange', 'Info:') +
        escapeHTML(prefixPart) +
        wrapSpan('yellow', business) +
        ' for an amount of ' +
        wrapSpan('green', money) +
        '!'
      );
    }

    if (line.includes('offered your card reader to')) {
      const nameStart = rest.indexOf('reader to ') + 'reader to '.length;
      const nameEnd = rest.indexOf(' for an amount');
      const name = rest.substring(nameStart, nameEnd);
      const prefixPart = rest.substring(0, nameStart);

      return (
        wrapSpan('orange', 'Info:') +
        escapeHTML(prefixPart) +
        wrapSpan('yellow', name) +
        ' for an amount of ' +
        wrapSpan('green', money) +
        '. Wait for them to accept!'
      );
    }

    if (line.includes('accepted the card payment of')) {
      const nameStart = rest.indexOf('payment of ') + 'payment of '.length;
      const nameEnd = rest.indexOf(' for an amount');
      const name = rest.substring(nameStart, nameEnd);
      const prefixPart = rest.substring(0, nameStart);

      return (
        wrapSpan('orange', 'Info:') +
        escapeHTML(prefixPart) +
        wrapSpan('yellow', name) +
        ' for an amount of ' +
        wrapSpan('green', money) +
        '!'
      );
    }
  }

  function addLineBreaksAndHandleSpans(text) {
    const maxLineLength: any = (document.getElementById('lineLengthInput') as HTMLInputElement)
      .value;
    const currentFontSize = parseFloat($('#font-label').val()) || 12;
    let result = '';
    let currentLineLength = 0;
    const openSpans = [];

    // This compensates for the fact that larger fonts take up more visual space
    let fontSizeAdjustment;
    if (currentFontSize <= 12) {
      fontSizeAdjustment = 1.0;
    } else {
      // Scale line capacity down as fonts grow (clamped 0.3-1.0)
      fontSizeAdjustment = Math.max(0.3, Math.min(1.0, 12 / currentFontSize));
    }

    const adjustedMaxLineLength = Math.floor(maxLineLength * fontSizeAdjustment);

    function addLineBreak() {
      if (openSpans.length > 0) {
        // Close all open spans, insert a break, then reopen them
        for (let i = openSpans.length - 1; i >= 0; i--) {
          result += '</span>';
        }
        result += '<br>';
        for (const span of openSpans) {
          result += span;
        }
      } else {
        result += '<br>';
      }
      currentLineLength = 0;
    }

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '<' && text.substring(i, i + 5) === '<span') {
        const spanEnd = text.indexOf('>', i);
        const spanTag = text.substring(i, spanEnd + 1);
        openSpans.push(spanTag);
        result += spanTag;
        i = spanEnd;
      } else if (text[i] === '<' && text.substring(i, i + 7) === '</span>') {
        result += '</span>';
        i += 6;
        openSpans.pop();
      } else if (text[i] === '<' && text.substring(i, i + 4) === '<br') {
        const brEnd = text.indexOf('>', i);
        const brTag = text.substring(i, brEnd + 1);
        result += brTag;
        i = brEnd;
        currentLineLength = 0;
      } else {
        result += text[i];
        currentLineLength++;

        if (currentLineLength >= adjustedMaxLineLength && text[i] === ' ') {
          addLineBreak();
        }
      }
    }

    return result;
  }

  function cleanUp() {
    const isOpsec = Boolean(ChatlogParser.opsecActive || $opsecBtn.hasClass('active'));
    $output.toggleClass('opsec-active', isOpsec);

    $output.find('.generated').each(function () {
      let html = $(this).html();
      html = html.replace(/<br>\s*<br>/g, '<br>');
      html = html.replace(/^<br>|<br>$/g, '');
      html = html.replace(/<span[^>]*>\s*<\/span>/g, '');
      $(this).html(html);
    });
    applyStyles();
  }

  function applyStyles() {
    $('.generated:first').css({
      'margin-top': '0',
      'padding-top': '1px',
    });
    $('.generated:last').css({
      'padding-bottom': '1px',
      'margin-bottom': '0',
    });
    $('.generated').css('background-color', 'transparent');

    if (applyBackground) {
      const red = parseInt(backgroundColor.slice(1, 3), 16);
      const green = parseInt(backgroundColor.slice(3, 5), 16);
      const blue = parseInt(backgroundColor.slice(5, 7), 16);
      $('.generated').css(
        'background-color',
        `rgba(${red}, ${green}, ${blue}, ${backgroundOpacity})`
      );
    }
  }

  function toggleSystemMessages() {
    hideSystemMessages = !hideSystemMessages;
    localStorage.setItem('chatlogHideSystemMessages', hideSystemMessages ? 'true' : 'false');
    updateSystemMessagesUI();
    processOutput();
  }

  function updateSystemMessagesUI() {
    if (!$toggleSystemMessagesBtn.length) return;

    if (hideSystemMessages) {
      $toggleSystemMessagesBtn.removeClass('inactive').addClass('active');
      $toggleSystemMessagesBtn.attr(
        'title',
        getI18nText('ui.sysmsgHidden', 'Sistem Bildirimleri: Gizli')
      );
      $toggleSystemMessagesBtn.html(
        `<i class="fas fa-filter-circle-xmark" aria-hidden="true"></i> <span class="sysmsg-text">${getI18nText('ui.sysmsgHidden', 'Sistem Bildirimleri: Gizli')}</span>`
      );
    } else {
      $toggleSystemMessagesBtn.removeClass('active').addClass('inactive');
      $toggleSystemMessagesBtn.attr(
        'title',
        getI18nText('ui.sysmsgVisible', 'Sistem Bildirimleri: Açık')
      );
      $toggleSystemMessagesBtn.html(
        `<i class="fas fa-filter" aria-hidden="true"></i> <span class="sysmsg-text">${getI18nText('ui.sysmsgVisible', 'Sistem Bildirimleri: Açık')}</span>`
      );
    }
  }

  document.addEventListener('cm:locale-changed', function () {
    updateBackgroundUI();
    updateCharacterNameColoringUI();
    updateItalicParsingUI();
    updateWhisperColoringUI();
    updateCensorStyleUI();
    updateContrastStyleUI();
    updateSystemMessagesUI();
  });

  function copyCensorChar() {
    if (typeof copyToClipboard === 'function') {
      copyToClipboard('÷', this);
    } else {
      const censorChar = '÷';
      try {
        const textarea = document.createElement('textarea');
        textarea.value = censorChar;

        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (successful) {
          const $btn = $(this);
          const originalBg = $btn.css('background-color');
          const originalText = $btn.text();

          $btn.css('background-color', '#a8f0c6').html('<i class="fas fa-clone"></i>');

          setTimeout(() => {
            $btn.css('background-color', originalBg).text(originalText);
          }, 800);
        }
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    }
  }

  processOutput();
});
