(function(){
  try {
    var root = document.body;
    if (root) {
      window.currentUserCode = root.getAttribute('data-user-code') || '';
    }
  } catch (_) {}

  // Update selected sketch name next to the custom upload button
  try {
    var up = document.getElementById('upload-croquis');
    var nameHolder = document.getElementById('upload-croquis-name');
    if (up && nameHolder) {
      up.addEventListener('change', function(){
        nameHolder.textContent = up.files && up.files[0] ? 'Croquis choisi' : 'Aucun croquis choisi';
      });
    }
  } catch (_) {}

  // Home dynamic: daily brief, alerts, widgets
  try {
    var brief = document.getElementById('daily-brief');
    var alerts = document.getElementById('alerts');
    var refresh = document.getElementById('refresh-brief');
    var wOps = document.getElementById('w-ops');
    var wTrust = document.getElementById('w-trust');
    var wRumors = document.getElementById('w-rumors');

    if (brief && alerts) {
      var seedBrief = function(){
        var items = [
          'Opération ORION: fenêtre T-12h pour extraction.',
          'Signal faible sur canal ZETA, triangulation en cours.',
          'Convergence de rumeurs sur secteur Nord-Est.'
        ];
        brief.innerHTML = items.map(function(t){return '<li>'+t+'</li>';}).join('');
      };
      seedBrief();
      if (refresh) refresh.addEventListener('click', function(e){ e.preventDefault(); seedBrief(); });

      var seedWidgets = function(){
        if (wOps) wOps.textContent = String(Math.floor(Math.random()*3)+1);
        if (wTrust) wTrust.textContent = ['Bas','Moyen','Elevé'][Math.floor(Math.random()*3)];
        if (wRumors) wRumors.textContent = ['Calme','Agité','Tempête'][Math.floor(Math.random()*3)];
      };
      seedWidgets();

      var addAlert = function(level, text){
        var li = document.createElement('li');
        li.textContent = text;
        li.className = 'alert-' + level;
        if (alerts.firstElementChild && alerts.firstElementChild.classList.contains('hint')) alerts.innerHTML='';
        alerts.prepend(li);
      };

      if (window.io) {
        var s = window.io();
        s.on('alert', function(payload){
          addAlert(payload.level||'info', payload.text||'Alerte');
        });
      }
    }
  } catch (_) {}
})();
