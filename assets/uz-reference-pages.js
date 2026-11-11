(function () {
  'use strict';

  var root = document.querySelector('.vd');
  if (!root) return;

  var tabs = root.querySelectorAll('[data-news-category]');
  var cards = root.querySelectorAll('#news-route-grid .news-route-card');
  var empty = root.querySelector('#news-empty');
  if (!tabs.length || !cards.length) return;

  function selectCategory(category) {
    var visibleCount = 0;

    tabs.forEach(function (tab) {
      var selected = tab.getAttribute('data-news-category') === category;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-pressed', String(selected));
    });

    cards.forEach(function (card) {
      var visible = category === 'all' || card.getAttribute('data-category') === category;
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (empty) empty.hidden = visibleCount > 0;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      selectCategory(tab.getAttribute('data-news-category'));
    });
  });
})();
