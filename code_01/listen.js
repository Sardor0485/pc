const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

app.post('/submit', (req, res) => {
  console.log(req.body);
  res.json({ message: 'Данные получены' });
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));