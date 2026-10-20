const menuCards = document.querySelectorAll('[data-category]');
const filterButtons = document.querySelectorAll('[data-filter]');

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    let visibleCount = 0;
    menuCards.forEach((card) => {
      const isVisible =
        button.dataset.filter === 'all' ||
        card.dataset.category === button.dataset.filter;
      card.classList.toggle('d-none', !isVisible);
      if (isVisible) visibleCount += 1;
    });
    filterButtons.forEach((filter) => {
      const isActive = filter === button;
      filter.classList.toggle('btn-primary', isActive);
      filter.classList.toggle('btn-outline-primary', !isActive);
      filter.setAttribute('aria-pressed', String(isActive));
    });
    document.querySelector('#menuStatus').textContent =
      `Showing ${visibleCount} menu sections.`;
  });
});
