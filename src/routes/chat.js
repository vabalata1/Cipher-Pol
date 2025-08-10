const express = require('express');
const router = express.Router();
router.get('/', async (req, res) => {
  const messages = [];
  res.render('chat/index', { title: 'Fil clandestin', messages });
});

module.exports = router;


