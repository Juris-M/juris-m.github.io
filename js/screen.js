function setStartBoxHighlight() {
    if (location.href.indexOf('#start') > -1) {
        var browserConnectors = document.getElementById('browser-connectors');
        browserConnectors.classList.add('add-border');
    }
}
