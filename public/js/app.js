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

  // Minimal terminal click sound on brand click
  try {
    var brand = document.querySelector('.topbar .brand');
    if (brand && window.AudioContext) {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var playClick = function() {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 1600;
        g.gain.value = 0.02;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        setTimeout(function(){ o.stop(); }, 40);
      };
      brand.addEventListener('click', function(){
        // On first user gesture, resume suspended context in some browsers
        if (ctx.state === 'suspended') { ctx.resume(); }
        playClick();
      });
    }
  } catch (_) {}
})();
