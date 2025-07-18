window.addEventListener('scroll', function () {
  var pic = document.getElementById('profile-pic');
  if (!pic) return;
  if (window.scrollY > 200) {
    pic.classList.add('shrink');
  } else {
    pic.classList.remove('shrink');
  }
});
