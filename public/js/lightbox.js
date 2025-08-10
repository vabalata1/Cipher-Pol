// Lightbox functionality
document.addEventListener('DOMContentLoaded', function() {
  // Create lightbox HTML structure
  const lightboxHTML = `
    <div id="lightbox" class="lightbox">
      <span class="lightbox-close">&times;</span>
      <img class="lightbox-content" id="lightbox-img">
    </div>
  `;
  
  // Add lightbox to body
  document.body.insertAdjacentHTML('beforeend', lightboxHTML);
  
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.querySelector('.lightbox-close');
  
  // Function to open lightbox
  function openLightbox(imageSrc) {
    lightboxImg.src = imageSrc;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
  }
  
  // Function to close lightbox
  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }
  
  // Add click listeners to all images in file cards
  function attachImageListeners() {
    const images = document.querySelectorAll('.file-thumb img');
    images.forEach(img => {
      img.addEventListener('click', function(e) {
        e.preventDefault();
        openLightbox(this.src);
      });
    });
  }
  
  // Initial attachment
  attachImageListeners();
  
  // Close lightbox when clicking close button
  closeBtn.addEventListener('click', closeLightbox);
  
  // Close lightbox when clicking outside the image
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
  
  // Close lightbox with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox();
    }
  });
  
  // Re-attach listeners when content is dynamically loaded
  window.attachImageListeners = attachImageListeners;
});
