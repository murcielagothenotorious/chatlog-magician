declare var jQuery: any;
declare var ChatlogParser: any;

interface Window {
  ColorPalette?: any;
}

(function ($) {
  'use strict';

  const DEBUG_MODE = false;
  const CONFIG = {
    DRAG_DISTANCE_THRESHOLD_PX: 5,
    DRAG_FLAG_RESET_MS: 150,
    CLICK_DURATION_THRESHOLD_MS: 200,
    COLOR_FEEDBACK_DURATION_MS: 1000,
    TOAST_DURATION_MS: 1500,
    TOAST_FADEOUT_MS: 300,
  };

  let coloringMode = false;
  let selectedElements = [];

  let isDragging = false;
  let dragStartElement = null;
  let dragDistance = 0;
  let dragStartPosition = null;
  let justFinishedDragging = false;
  let mouseDownTime = 0;
  let mouseUpTime = 0;

  let $colorPalette;
  let $output;
  let $toggleColorPaletteBtn;

  const COLOR_CLASSES = [
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
    'dodgerblue',
    'white',
    'radioColor',
    'radioColor2',
    'depColor',
    'vesseltraffic',
    'toyou',
  ];

  function init() {
    $colorPalette = $('#colorPalette');
    $output = $('#output');
    $toggleColorPaletteBtn = $('#toggleColorPalette');

    $toggleColorPaletteBtn.off('click.colorPalette').on('click.colorPalette', toggleColoringMode);

    $colorPalette
      .off('click.colorPalette')
      .on('click.colorPalette', '.color-item', applyColorToSelection);

    $output
      .off('click.colorPalette')
      .on('click.colorPalette', '.colorable', handleTextElementClick);

    $output.off('mousedown.colorPalette').on('mousedown.colorPalette', handleDragStart);
    $output.off('mouseup.colorPalette').on('mouseup.colorPalette', handleDragEnd);
    $output.off('mouseup.nativeSelection').on('mouseup.nativeSelection', handleNativeTextSelection);
    $output.off('mousemove.colorPalette').on('mousemove.colorPalette', handleMouseMoveDrag);
    $output
      .off('mouseover.colorPalette')
      .on('mouseover.colorPalette', '.colorable', handleDragOver);

    $(document).off('mouseup.colorPalette').on('mouseup.colorPalette', handleGlobalMouseUp);

    $output
      .off('click.clearOutside.colorPalette')
      .on('click.clearOutside.colorPalette', function (e) {
        if (!coloringMode) {
          return;
        }

        if (justFinishedDragging) {
          return;
        }

        const clickedColorable =
          $(e.target).hasClass('colorable') || $(e.target).closest('.colorable').length > 0;

        if (!clickedColorable) {
          clearAllSelections();
        }
      });

    $output.off('mouseleave.colorPalette').on('mouseleave.colorPalette', function () {
      if (!coloringMode) {
        return;
      }

      if (isDragging) {
        isDragging = false;
        dragStartElement = null;
        dragDistance = 0;
        dragStartPosition = null;
        justFinishedDragging = false;
      }
    });

    setupClosePaletteHandler();

    updateSelectionCounter();

    if (DEBUG_MODE) {
      console.log('Outputta eşleşen elemanlar:', selectedElements);
    }
  }

  function toggleColoringMode() {
    if (!coloringMode) {
      enterColoringMode();
      return;
    }

    coloringMode = false;
    $toggleColorPaletteBtn.toggleClass('btn-dark', false);
    $output.removeClass('coloring-mode');
    $colorPalette.hide();
    clearAllSelections();

    isDragging = false;
    dragStartElement = null;
    dragDistance = 0;
    dragStartPosition = null;
    justFinishedDragging = false;
    mouseDownTime = 0;
    mouseUpTime = 0;

    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    (document.body.style as any).mozUserSelect = '';
    (document.body.style as any).msUserSelect = '';

    setupClosePaletteHandler();
  }

  function enterColoringMode(preselectedElements = []) {
    coloringMode = true;
    $toggleColorPaletteBtn.toggleClass('btn-dark', true);
    $output.addClass('coloring-mode');
    clearAllSelections();
    isDragging = false;
    dragStartElement = null;
    $colorPalette.show();

    selectedElements = [...new Set(preselectedElements)].filter((element) =>
      $output[0].contains(element)
    );
    selectedElements.forEach((element) => $(element).addClass('selected-for-coloring'));
    updateSelectionCounter();

    justFinishedDragging = true;
    setTimeout(function () {
      justFinishedDragging = false;
    }, CONFIG.DRAG_FLAG_RESET_MS);

    setTimeout(function () {
      makeTextColorable();
      updateColorPalettePosition();
    }, 100);

    $(document).off('click.closePalette');
  }

  function handleNativeTextSelection() {
    if (typeof window.getSelection !== 'function') return;

    const selection = window.getSelection();
    const outputElement = $output[0];
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !outputElement) {
      return;
    }
    if (
      !outputElement.contains(selection.anchorNode) ||
      !outputElement.contains(selection.focusNode)
    ) {
      return;
    }

    const range = selection.getRangeAt(0);
    const matchedElements = $output
      .find('.colorable')
      .toArray()
      .filter((element) => {
        if (element.querySelector('.colorable') !== null) return false;
        try {
          return range.intersectsNode(element);
        } catch (_error) {
          return false;
        }
      });

    if (matchedElements.length === 0) return;

    justFinishedDragging = true;
    setTimeout(function () {
      justFinishedDragging = false;
    }, CONFIG.DRAG_FLAG_RESET_MS);

    if (!coloringMode) {
      enterColoringMode(matchedElements);
    } else {
      matchedElements.forEach((element) => {
        if (!selectedElements.includes(element)) {
          selectedElements.push(element);
        }
        $(element).addClass('selected-for-coloring');
      });
      updateSelectionCounter();
    }

    try {
      selection.removeAllRanges();
    } catch (_e) {
      // Ignore
    }
  }

  function handleTextElementClick(e) {
    if (!coloringMode) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const clickedElement = e.currentTarget;

    if (!(clickedElement instanceof HTMLElement)) {
      return;
    }

    if (e.ctrlKey) {
      const index = selectedElements.indexOf(clickedElement);

      if (index > -1) {
        selectedElements.splice(index, 1);

        $(clickedElement).removeClass('selected-for-coloring');
      } else {
        selectedElements.push(clickedElement);

        $(clickedElement).addClass('selected-for-coloring');
      }
    } else {
      if (!justFinishedDragging) {
        clearAllSelections();
      }

      if (!selectedElements.includes(clickedElement)) {
        selectedElements.push(clickedElement);
      }

      $(clickedElement).addClass('selected-for-coloring');
    }

    updateSelectionCounter();
  }

  function handleDragStart(e) {
    if (!coloringMode) {
      return;
    }

    isDragging = true;
    const closestColorable = e.target.closest ? e.target.closest('.colorable') : null;
    dragStartElement = closestColorable || e.currentTarget;

    dragStartPosition = {
      x: e.clientX,
      y: e.clientY,
    };

    dragDistance = 0;
    mouseDownTime = Date.now();

    if (!e.ctrlKey) {
      clearAllSelections();
    }

    if (
      dragStartElement instanceof HTMLElement &&
      dragStartElement.querySelector('.colorable') === null &&
      !selectedElements.includes(dragStartElement)
    ) {
      selectedElements.push(dragStartElement);
      $(dragStartElement).addClass('selected-for-coloring');
    }

    updateSelectionCounter();
  }

  function handleMouseMoveDrag(e) {
    if (!isDragging || !coloringMode) {
      return;
    }

    if (dragStartPosition) {
      const dx = e.clientX - dragStartPosition.x;
      const dy = e.clientY - dragStartPosition.y;
      dragDistance = Math.sqrt(dx * dx + dy * dy);
    }

    if (typeof window.getSelection === 'function') {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        $output.find('.colorable').each(function () {
          if (this.querySelector('.colorable') !== null) return;
          try {
            if (range.intersectsNode(this) && !selectedElements.includes(this)) {
              selectedElements.push(this);
              $(this).addClass('selected-for-coloring');
            }
          } catch (_error) {
            // Ignore node intersection errors
          }
        });
        updateSelectionCounter();
        return;
      }
    }

    // Fallback: element directly under cursor
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      const colorable = el.closest('.colorable');
      if (
        colorable &&
        colorable.querySelector('.colorable') === null &&
        !selectedElements.includes(colorable)
      ) {
        selectedElements.push(colorable);
        $(colorable).addClass('selected-for-coloring');
        updateSelectionCounter();
      }
    }
  }

  function handleDragOver(e) {
    if (!isDragging || !coloringMode) {
      return;
    }

    if (dragStartPosition) {
      const dx = e.clientX - dragStartPosition.x;
      const dy = e.clientY - dragStartPosition.y;
      dragDistance = Math.sqrt(dx * dx + dy * dy);
    }

    const currentElement = e.currentTarget;
    if (!(currentElement instanceof HTMLElement)) {
      return;
    }

    if (currentElement.querySelector('.colorable') !== null) {
      return;
    }

    if (!selectedElements.includes(currentElement)) {
      selectedElements.push(currentElement);
      $(currentElement).addClass('selected-for-coloring');
      updateSelectionCounter();
    }
  }

  function handleDragEnd(_e) {
    if (!coloringMode) {
      return;
    }

    mouseUpTime = Date.now();
    const clickDuration = mouseUpTime - mouseDownTime;

    isDragging = false;
    dragStartElement = null;

    handleNativeTextSelection();

    if (dragDistance > CONFIG.DRAG_DISTANCE_THRESHOLD_PX) {
      justFinishedDragging = true;

      setTimeout(function () {
        justFinishedDragging = false;

        if (DEBUG_MODE) {
          console.log('Drag flag reset:', selectedElements.length);
        }
      }, CONFIG.DRAG_FLAG_RESET_MS);
    } else if (clickDuration < CONFIG.CLICK_DURATION_THRESHOLD_MS) {
      justFinishedDragging = false;
    }

    dragDistance = 0;
    dragStartPosition = null;
  }

  function handleGlobalMouseUp() {
    if (!coloringMode) {
      return;
    }

    if (isDragging) {
      isDragging = false;
      dragStartElement = null;
      dragDistance = 0;
      dragStartPosition = null;
    }
  }

  function applyColorToSelection(e) {
    if (!coloringMode || selectedElements.length === 0) {
      return;
    }

    const colorClass = $(e.currentTarget).data('color');

    if (!colorClass) {
      return;
    }

    applyColorToSelectionByClass(colorClass);
  }

  function applyColorToSelectionByClass(colorClass) {
    if (!coloringMode || selectedElements.length === 0) {
      return;
    }

    selectedElements = selectedElements.filter(function (element) {
      const isDomElement = element instanceof HTMLElement;

      if (!isDomElement) {
        console.warn('DOM elemanı olmayan değer silindi:', element);
      }

      return isDomElement;
    });

    selectedElements.forEach(function (element) {
      $(element)
        .removeClass(COLOR_CLASSES.join(' '))
        .addClass('colorable')
        .addClass(colorClass)
        .addClass('user-colored');

      /*
       * element artık kesin olarak DOM elemanı.
       * Bu nedenle element.style hata vermez.
       */
      element.style.color = '';
    });

    showColorAppliedFeedback(colorClass);
  }

  function clearAllSelections() {
    if (selectedElements.length > 0) {
      selectedElements.forEach(function (element) {
        $(element).removeClass('selected-for-coloring');
      });

      selectedElements = [];
      updateSelectionCounter();
    }
  }

  function updateSelectionCounter() {
    const count = selectedElements.filter(function (element) {
      return element instanceof HTMLElement;
    }).length;

    $('.selection-counter').text(count + ' seçildi');
  }

  function showColorAppliedFeedback(colorClass) {
    $('.color-applied-feedback').remove();

    const feedback = $('<div class="color-applied-feedback">' + colorClass + ' uygulandı.</div>');

    $('body').append(feedback);

    setTimeout(function () {
      feedback.fadeOut(CONFIG.TOAST_FADEOUT_MS, function () {
        $(this).remove();
      });
    }, CONFIG.COLOR_FEEDBACK_DURATION_MS);
  }

  function setupClosePaletteHandler() {
    $(document)
      .off('click.closePalette')
      .on('click.closePalette', function (e) {
        if (!coloringMode) {
          return;
        }

        const clickedInsidePalette =
          $(e.target).closest('#colorPalette, #toggleColorPalette').length > 0;

        if (clickedInsidePalette) {
          return;
        }

        /*
         * Paletin dışına tıklanınca paleti
         * kapatmak istemiyorsan boş bırak.
         */
      });
  }

  function updateColorPalettePosition() {
    const windowHeight = $(window).height();

    const paletteHeight = $colorPalette.outerHeight();

    if (paletteHeight + 20 > windowHeight) {
      $colorPalette.css({
        'max-height': windowHeight - 40 + 'px',
        bottom: '20px',
      });
    } else {
      $colorPalette.css({
        'max-height': '',
        bottom: '20px',
      });
    }
  }

  function makeTextColorable() {
    if (
      typeof ChatlogParser !== 'undefined' &&
      typeof ChatlogParser.makeTextColorable === 'function'
    ) {
      ChatlogParser.makeTextColorable();
    } else {
      $output.find('span').addClass('colorable');
    }
  }

  function destroy() {
    $toggleColorPaletteBtn.off('click.colorPalette');
    $colorPalette.off('click.colorPalette');
    $output.off('click.colorPalette');
    $output.off('mousedown.colorPalette');
    $output.off('mouseup.colorPalette');
    $output.off('mouseup.nativeSelection');
    $output.off('mousemove.colorPalette');
    $output.off('mouseover.colorPalette');
    $output.off('click.clearOutside.colorPalette');
    $output.off('mouseleave.colorPalette');
    $(document).off('mouseup.colorPalette');
    $(document).off('keydown.colorPalette');
    $output.off('selectstart.colorPalette');
    $(document).off('click.closePalette');
    $(window).off('resize.colorPalette');

    coloringMode = false;
    selectedElements = [];

    isDragging = false;
    dragStartElement = null;
    dragDistance = 0;
    dragStartPosition = null;
    justFinishedDragging = false;
    mouseDownTime = 0;
    mouseUpTime = 0;

    $colorPalette.hide();

    $output.removeClass('coloring-mode').css({
      'user-select': '',
      '-webkit-user-select': '',
      '-moz-user-select': '',
      '-ms-user-select': '',
    });

    if (DEBUG_MODE) {
      console.log('ColorPalette temizlendi.');
    }
  }

  window.ColorPalette = {
    init: init,
    toggleColoringMode: toggleColoringMode,
    clearSelections: clearAllSelections,
    destroy: destroy,
  };
})(jQuery);
