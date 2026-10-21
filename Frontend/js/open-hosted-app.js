const link = document.querySelector('#hostedAppLink');
if (link) {
  const destination = new URL(link.href);
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  window.location.replace(destination.href);
}
