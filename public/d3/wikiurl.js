$( document ).ready(function() {
    var termName = document.getElementById('termname').getAttribute('value');
    var wikiName = termName.replace(/ /g,"_").replace(/-/g, '_');
    $('#wikiurl').attr('href', 'http://en.wikipedia.org/wiki/' + wikiName);
    });