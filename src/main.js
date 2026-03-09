document.querySelector('.btn-primary').addEventListener('click', (e) => {
  e.preventDefault();
  const features = document.querySelector('.features');
  features.scrollIntoView({ behavior: 'smooth' });
});

// Simple intersection observer for scroll animations
const observerOptions = {
  threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.card').forEach(card => {
  observer.observe(card);
});
