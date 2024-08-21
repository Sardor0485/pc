const express = require('express');
const fs = require("fs")
const  path = require("path")


const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './index.html'));
});

app.get('/form', (req, res) => {
    res.sendFile(path.join(__dirname, './form.html'));
  });

  app.get('/server', (req, res) => {
    res.sendFile(path.join(__dirname, './server.html'));
  });


app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});