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

  // (removed brand click sound)

})();
