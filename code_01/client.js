document.getElementById('myForm').addEventListener('submit', function(e) {
    e.preventDefault();
    fetch('http://localhost:3000/submit', {
      method: 'POST',
      body: new FormData(this)
    })
    .then(response => response.json())
    .then(data => console.log(data))
    .catch(error => console.error('Error:', error));
  });