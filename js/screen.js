function setStartBoxHighlight() {
    alert('Hello, doing setStartBoxHighlight() OK');
    alert('Hello, location.search='+location.search);
    alert('Hello, href='+location.href);
    if (location.search.indexOf('#start') > -1) {
        var browserConnectors = document.getElementById('browser-connectors');
        browserConnectors.classList.add('add-border');
    }
}
